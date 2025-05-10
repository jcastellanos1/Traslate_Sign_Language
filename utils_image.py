# utils_image.py
# Preprocesamiento de imágenes para entrada al modelo

import cv2
import numpy as np

def preprocess_frame(frame):
    """
    Recorta el ROI del centro de la imagen (opcional),
    redimensiona a 56x56 y normaliza a [0,1].
    """
    resized = cv2.resize(frame, (56, 56))
    normalized = resized.astype('float32') / 255.0
    return normalized
