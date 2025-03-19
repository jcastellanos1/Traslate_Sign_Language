
from flask import Flask, render_template
import cv2
import numpy as np
import mediapipe as mp
import ssl
import base64
from flask_socketio import SocketIO

app = Flask(__name__)
socketio = SocketIO(app, cors_allowed_origins="*", async_mode="threading")

# Inicializar MediaPipe
mp_hands = mp.solutions.hands
mp_draw = mp.solutions.drawing_utils
hands = mp_hands.Hands(static_image_mode=False, max_num_hands=2, 
                       min_detection_confidence=0.7, min_tracking_confidence=0.6)

mp_face_mesh = mp.solutions.face_mesh
face_mesh = mp_face_mesh.FaceMesh(min_detection_confidence=0.7, min_tracking_confidence=0.6)

mp_pose = mp.solutions.pose
pose = mp_pose.Pose(min_detection_confidence=0.7, min_tracking_confidence=0.6)

# Mapeo de dedos a letras
def get_letter(finger_count):
    letters = "ABCDEFGHIJKLMNOPQRSTUVWXYZ"
    return letters[finger_count - 1] if 1 <= finger_count <= 26 else ""

@app.route('/')
def index():
    return render_template('index.html')

@socketio.on('frame')
def handle_frame(data):
    """Recibe un frame del cliente, lo procesa y devuelve el resultado."""
    image_bytes = base64.b64decode(data)  
    np_arr = np.frombuffer(image_bytes, np.uint8)
    image = cv2.imdecode(np_arr, cv2.IMREAD_COLOR)

    # Convertir imagen a RGB para MediaPipe
    RGBframe = cv2.cvtColor(image, cv2.COLOR_BGR2RGB)

    # Detección de manos
    hand_results = hands.process(RGBframe)
    detected_letter = ""
    
    if hand_results.multi_hand_landmarks:
        for handLm in hand_results.multi_hand_landmarks:
            mp_draw.draw_landmarks(image, handLm, mp_hands.HAND_CONNECTIONS)
            
            # Contar dedos levantados
            finger_count = 0
            finger_tips = [8, 12, 16, 20]  # Índices de las puntas de los dedos
            landmarks = handLm.landmark
            if landmarks[4].x > landmarks[3].x:  # Pulgar
                finger_count += 1
            for tip in finger_tips:
                if landmarks[tip].y < landmarks[tip - 2].y:
                    finger_count += 1
            
            detected_letter = get_letter(finger_count)
    
    # Detección de rostro
    face_results = face_mesh.process(RGBframe)
    if face_results.multi_face_landmarks:
        for face_landmarks in face_results.multi_face_landmarks:
            mp_draw.draw_landmarks(image, face_landmarks, mp_face_mesh.FACEMESH_CONTOURS)
    
    # Detección de hombros y brazos usando pose
    pose_results = pose.process(RGBframe)
    if pose_results.pose_landmarks:
        mp_draw.draw_landmarks(image, pose_results.pose_landmarks, mp_pose.POSE_CONNECTIONS)
    
    # Enviar la letra detectada al frontend
    socketio.emit('detection_data', detected_letter)

    # Convertir la imagen procesada a base64
    _, buffer = cv2.imencode('.jpg', image)
    encoded_image = base64.b64encode(buffer).decode('utf-8')

    # Enviar imagen procesada al cliente
    socketio.emit('processed_frame', encoded_image)

if __name__ == '__main__':
    context = ssl.SSLContext(ssl.PROTOCOL_TLS_SERVER)
    context.load_cert_chain(certfile='server.crt', keyfile='server.key')
    socketio.run(app, host='0.0.0.0', port=5000, debug=True, ssl_context=context)
