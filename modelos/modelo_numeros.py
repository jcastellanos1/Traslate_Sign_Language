# modelos/modelo_numeros.py

import tensorflow as tf
import numpy as np
import cv2

# Cargar el modelo entrenado de números
model = tf.keras.models.load_model('modelmiguelnumber.h5')
numeros = '0123456789'

def predecir_numero(frame_bgr, umbral_confianza=0.7):
    """
    Recibe una imagen (np.array en formato BGR) y devuelve el número detectado si la predicción es confiable.
    """
    k = 2
    frame_rgb = cv2.cvtColor(frame_bgr, cv2.COLOR_BGR2RGB)
    resized = cv2.resize(frame_rgb, (28 * k, 28 * k)) / 255.0
    input_tensor = resized.reshape(1, 28 * k, 28 * k, 3)
    pred = model.predict(input_tensor, verbose=0)
    confianza = np.max(pred)

    if confianza < umbral_confianza:
        return None

    numero = numeros[np.argmax(pred)]
    return numero
