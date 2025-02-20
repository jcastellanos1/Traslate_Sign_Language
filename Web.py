from flask import Flask, request, jsonify, render_template, Response
import cv2
import numpy as np
import mediapipe as mp
import ssl
import base64
from flask_socketio import SocketIO

app = Flask(__name__)
socketio = SocketIO(app, cors_allowed_origins="*")  # Habilitar WebSockets con CORS permitido

# Inicializar MediaPipe
mp_hands = mp.solutions.hands
mp_draw = mp.solutions.drawing_utils
hands = mp_hands.Hands(static_image_mode=False, max_num_hands=2, 
                       min_detection_confidence=0.7, min_tracking_confidence=0.6)

mp_face_detection = mp.solutions.face_detection
face_detection = mp_face_detection.FaceDetection(min_detection_confidence=0.7)

@app.route('/')
def index():
    return render_template('index.html')

# Manejar los frames recibidos desde el cliente
@socketio.on('frame')
def handle_frame(data):
    """Recibe un frame del cliente, lo procesa y devuelve el resultado."""
    image_bytes = base64.b64decode(data)  # Decodificar base64
    np_arr = np.frombuffer(image_bytes, np.uint8)
    image = cv2.imdecode(np_arr, cv2.IMREAD_COLOR)

    # Convertir imagen a RGB para MediaPipe
    RGBframe = cv2.cvtColor(image, cv2.COLOR_BGR2RGB)

    # Procesar manos
    hand_results = hands.process(RGBframe)
    if hand_results.multi_hand_landmarks:
        for handLm in hand_results.multi_hand_landmarks:
            mp_draw.draw_landmarks(image, handLm, mp_hands.HAND_CONNECTIONS)

    # Procesar rostros
    face_results = face_detection.process(RGBframe)
    if face_results.detections:
        for detection in face_results.detections:
            bboxC = detection.location_data.relative_bounding_box
            h, w, _ = image.shape
            x, y, w_box, h_box = int(bboxC.xmin * w), int(bboxC.ymin * h), \
                                 int(bboxC.width * w), int(bboxC.height * h)
            cv2.rectangle(image, (x, y), (x + w_box, y + h_box), (0, 0, 255), 2)

    # Convertir la imagen procesada a base64
    _, buffer = cv2.imencode('.jpg', image)
    encoded_image = base64.b64encode(buffer).decode('utf-8')

    # Enviar imagen procesada al cliente
    socketio.emit('processed_frame', encoded_image)

if __name__ == '__main__':
    context = ssl.SSLContext(ssl.PROTOCOL_TLS_SERVER)
    context.load_cert_chain(certfile='server.crt', keyfile='server.key')
    app.run(host='0.0.0.0', port=5000, debug=True, ssl_context=context)