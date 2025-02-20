
from flask import Flask, render_template
import cv2
import numpy as np
import mediapipe as mp
import ssl
import base64
from flask_socketio import SocketIO

app = Flask(__name__)
socketio = SocketIO(app, cors_allowed_origins="*")  # Habilitar WebSockets con CORS permitid

# Inicializar MediaPipe
mp_hands = mp.solutions.hands
mp_draw = mp.solutions.drawing_utils
hands = mp_hands.Hands(static_image_mode=False, max_num_hands=2, 
                       min_detection_confidence=0.7, min_tracking_confidence=0.6)

mp_face_mesh = mp.solutions.face_mesh
face_mesh = mp_face_mesh.FaceMesh(min_detection_confidence=0.7, min_tracking_confidence=0.6)

mp_pose = mp.solutions.pose
pose = mp_pose.Pose(min_detection_confidence=0.7, min_tracking_confidence=0.6)

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
    if hand_results.multi_hand_landmarks:
        for handLm in hand_results.multi_hand_landmarks:
            mp_draw.draw_landmarks(image, handLm, mp_hands.HAND_CONNECTIONS)

    # Detección de rostro (máscara)
    face_results = face_mesh.process(RGBframe)
    if face_results.multi_face_landmarks:
        for face_landmarks in face_results.multi_face_landmarks:
            # Dibujar máscara en la cara
            h, w, _ = image.shape
            points = [(int(p.x * w), int(p.y * h)) for p in face_landmarks.landmark]
            cv2.fillPoly(image, [np.array(points, np.int32)], (0, 255, 0))  # Máscara verde

    # Detección de brazos (usando pose)
    pose_results = pose.process(RGBframe)
    if pose_results.pose_landmarks:
        mp_draw.draw_landmarks(image, pose_results.pose_landmarks, mp_pose.POSE_CONNECTIONS)

    # Convertir la imagen procesada a base64
    _, buffer = cv2.imencode('.jpg', image)
    encoded_image = base64.b64encode(buffer).decode('utf-8')

    # Enviar imagen procesada al cliente
    socketio.emit('processed_frame', encoded_image)

if __name__ == '__main__':
    context = ssl.SSLContext(ssl.PROTOCOL_TLS_SERVER)
    context.load_cert_chain(certfile='server.crt', keyfile='server.key')
app.run(host='0.0.0.0', port=5000, debug=True, ssl_context=context)