
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


def detect_letter_from_hand(landmarks):
    thumb_tip = landmarks.landmark[4]
    thumb_ip = landmarks.landmark[3]
    index_tip = landmarks.landmark[8]
    index_mcp = landmarks.landmark[5]
    middle_tip = landmarks.landmark[12]
    middle_mcp = landmarks.landmark[9]
    ring_tip = landmarks.landmark[16]
    ring_mcp = landmarks.landmark[13]
    pinky_tip = landmarks.landmark[20]
    pinky_mcp = landmarks.landmark[17]

    # Función para saber si un dedo está doblado
    def is_folded(tip, mcp): return tip.y > mcp.y + 0.05
    def is_thumb_folded(): return thumb_tip.x < thumb_ip.x  # pulgar hacia adentro

    is_index_folded = is_folded(index_tip, index_mcp)
    is_middle_folded = is_folded(middle_tip, middle_mcp)
    is_ring_folded = is_folded(ring_tip, ring_mcp)
    is_pinky_folded = is_folded(pinky_tip, pinky_mcp)

    # --- LETRA A ---
    if is_index_folded and is_middle_folded and is_ring_folded and is_pinky_folded and not is_thumb_folded():
        return "A"

    # --- LETRA B ---
    if not is_index_folded and not is_middle_folded and not is_ring_folded and not is_pinky_folded and is_thumb_folded():
        return "B"

    # --- LETRA C ---
    if (
        not is_index_folded and not is_middle_folded and not is_ring_folded and not is_pinky_folded
        and abs(index_tip.x - pinky_tip.x) > 0.2
        and abs(index_tip.y - pinky_tip.y) < 0.2
        and abs(index_tip.z - middle_tip.z) > 0.02  # curvatura
    ):
        return "C"

    # --- LETRA D ---
    if not is_index_folded and is_middle_folded and is_ring_folded and is_pinky_folded:
        return "D"

    # --- LETRA E ---
    if is_index_folded and is_middle_folded and is_ring_folded and is_pinky_folded and is_thumb_folded():
        return "E"

    return None


@app.route('/')
def index():
    return render_template('index.html')


@socketio.on('frame')
def handle_frame(data):
    image_bytes = base64.b64decode(data)
    np_arr = np.frombuffer(image_bytes, np.uint8)
    image = cv2.imdecode(np_arr, cv2.IMREAD_COLOR)


    RGBframe = cv2.cvtColor(image, cv2.COLOR_BGR2RGB)


    hand_results = hands.process(RGBframe)

    if hand_results.multi_hand_landmarks:
        for handLm in hand_results.multi_hand_landmarks:
            mp_draw.draw_landmarks(image, handLm, mp_hands.HAND_CONNECTIONS)
            letter = detect_letter_from_hand(handLm)
            if letter:
                socketio.emit('letter_detected', letter)

    face_results = face_mesh.process(RGBframe)
    if face_results.multi_face_landmarks:
        for face_landmarks in face_results.multi_face_landmarks:
            h, w, _ = image.shape
            points = [(int(p.x * w), int(p.y * h)) for p in face_landmarks.landmark]
            cv2.fillPoly(image, [np.array(points, np.int32)], (0, 255, 0))

    pose_results = pose.process(RGBframe)
    if pose_results.pose_landmarks:
        mp_draw.draw_landmarks(image, pose_results.pose_landmarks, mp_pose.POSE_CONNECTIONS)

    _, buffer = cv2.imencode('.jpg', image)
    encoded_image = base64.b64encode(buffer).decode('utf-8')
    
    socketio.emit('processed_frame', encoded_image)


if __name__ == '__main__':
    context = ssl.SSLContext(ssl.PROTOCOL_TLS_SERVER)
    context.load_cert_chain(certfile='server.crt', keyfile='server.key')
    app.run(host='0.0.0.0', port=5000, debug=True, ssl_context=context)
