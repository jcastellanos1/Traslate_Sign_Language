# modelos/modelo_letras.py

import tensorflow as tf
import numpy as np
import cv2

# Cargar el modelo entrenado de letras
model = tf.keras.models.load_model('modelo_2209_miguel.h5')
abc = 'ABCDEFGHIKLMNOPQRSTUVWXY'  # ASL estático

def predecir_letra(frame_bgr, umbral_confianza=0.7):
    k = 2
    frame_rgb = cv2.cvtColor(frame_bgr, cv2.COLOR_BGR2RGB)
    resized = cv2.resize(frame_rgb, (28 * k, 28 * k)) / 255.0
    input_tensor = resized.reshape(1, 28 * k, 28 * k, 3)
    pred = model.predict(input_tensor, verbose=0)
    confianza = np.max(pred)

    if confianza < umbral_confianza:
        return None, confianza

    letra = abc[np.argmax(pred)]
    return letra, confianza

