from flask import Flask, render_template
from flask_socketio import SocketIO
import cv2
import numpy as np
import base64
import ssl
import os
from modelos.modelo_letras import predecir_letra
from modelos.modelo_numeros import predecir_numero
from collections import deque

app = Flask(__name__)
socketio = SocketIO(app, cors_allowed_origins="*", async_mode='threading')

@app.route('/')
def index():
    return render_template('index.html')


historial_letras = deque(maxlen=5)
ultima_letra_emitida = None

@socketio.on('frame')
def handle_frame(data):
    global ultima_letra_emitida

    imagen_base64 = data['imagen']
    modo = data['modo']

    # Decodificar imagen desde el frontend
    image_bytes = base64.b64decode(imagen_base64)
    np_arr = np.frombuffer(image_bytes, np.uint8)
    image = cv2.imdecode(np_arr, cv2.IMREAD_COLOR)

    # ROI centrado
    top, bottom = 60, 300
    left, right = 100, 340
    roi = image[top:bottom, left:right]

    if roi.shape[0] > 0 and roi.shape[1] > 0:
        try:
            if modo == 'letras':
                letra, confianza = predecir_letra(roi)
                if letra:
                    historial_letras.append(letra)
                    repeticiones = historial_letras.count(letra)
                    print(f"Letra detectada: {letra}, confianza: {confianza:.2f}, repeticiones: {repeticiones}")

                    if repeticiones >= 3 and letra != ultima_letra_emitida:
                        socketio.emit('letter_detected', letra)
                        ultima_letra_emitida = letra
                else:
                    historial_letras.clear()
                    ultima_letra_emitida = None
            elif modo == 'numeros':
                numero = predecir_numero(roi)
                if numero:
                    socketio.emit('number_detected', numero)
        except Exception as e:
            print("Error al predecir:", e)

    # Enviar imagen procesada (con recuadro)
    cv2.rectangle(image, (left, top), (right, bottom), (0, 255, 0), 2)

    _, buffer = cv2.imencode('.jpg', image)
    encoded_image = base64.b64encode(buffer).decode('utf-8')
    socketio.emit('processed_frame', encoded_image)


if __name__ == '__main__':
 
        base_path = os.path.dirname(os.path.abspath(__file__))
        cert_path = os.path.join(base_path, 'server.crt')
        key_path = os.path.join(base_path, 'server.key')

        context = ssl.SSLContext(ssl.PROTOCOL_TLS_SERVER)
        context.load_cert_chain(certfile=cert_path, keyfile=key_path)

        socketio.run(app, host='0.0.0.0', port=5000, debug=True, ssl_context=context)