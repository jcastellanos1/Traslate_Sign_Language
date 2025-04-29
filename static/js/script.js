const socket = io();
const video = document.getElementById('video-stream');
const processedFrame = document.getElementById('processed-frame');
const textBox = document.getElementById('text-box');
const subtitleText = document.getElementById('subtitle-text');
const btnCamera = document.getElementById('btnCamera');
const btnMic = document.getElementById('btnMic');
const btnDetection = document.getElementById('btnDetection');

const recognition = new (window.SpeechRecognition || window.webkitSpeechRecognition)();
recognition.lang = 'es-ES';
recognition.continuous = true;
recognition.interimResults = true;



const themeToggle = document.getElementById('theme-toggle');

function toggleTheme() {
    const isDark = document.body.classList.toggle('dark-mode');
    localStorage.setItem('theme', isDark ? 'dark' : 'light');
}


themeToggle.addEventListener('click', toggleTheme);

window.addEventListener('DOMContentLoaded', () => {
    const savedTheme = localStorage.getItem('theme');
    if (savedTheme) {
        document.body.classList.toggle('dark-mode', savedTheme === 'dark');
    } else {
        if (window.matchMedia('(prefers-color-scheme: dark)').matches) {
            document.body.classList.add('dark-mode');
        }
    }

    // === Micrófono ===

    const micCheckbox = document.getElementById('checkbox');
micCheckbox.addEventListener('change', function () {
    if (micCheckbox.checked) {
        recognition.stop();
    } else {
        recognition.start();
    }
});

const detectionCheckbox = document.getElementById('checkboxDetection');

// INICIALIZAR isDetectionOn correctamente aquí    
function actualizarDeteccion() {
    isDetectionOn = detectionCheckbox.checked;

    if (isDetectionOn) {
        processedFrame.style.display = 'block';  // Mostrar IA procesada
        video.style.display = 'none';            // Ocultar video normal
    } else {
        processedFrame.style.display = 'none';   // Ocultar IA
        video.style.display = 'block';            // Mostrar cámara normal
       processedFrame.src = ''; // Limpiar la imagen procesada  
    }
}


// Sincronizar estado inicial
actualizarDeteccion();

detectionCheckbox.addEventListener('change', actualizarDeteccion);
});


recognition.onresult = (event) => {
    let finalTranscript = '';
    for (let i = event.resultIndex; i < event.results.length; i++) {
        if (event.results[i].isFinal) {
            finalTranscript += event.results[i][0].transcript + ' ';
        }
    }
    subtitleText.innerText = finalTranscript;
};

let isRecognitionActive = true;
function toggleAudio() {
    if (isRecognitionActive) {
        recognition.stop();
    } else {
        recognition.start();
    }
    isRecognitionActive = !isRecognitionActive;
    btnMic.classList.toggle("off", !isRecognitionActive);
}

recognition.start();

let videoStream = null;
let isStreaming = false;
let isDetectionOn;// Variable para controlar el estado de detección

async function startCamera() {
    try {
        videoStream = await navigator.mediaDevices.getUserMedia({
            video: { width: 640, height: 480 },
            audio: false
        });
        video.srcObject = videoStream;
        isStreaming = true;
        btnCamera.classList.remove("off");
        document.getElementById('loading-spinner').style.display = 'none';
    } catch (error) {
        console.error('Error al acceder a la cámara:', error);
    }
}

function stopCamera() {
    if (videoStream) {
        videoStream.getTracks().forEach(track => track.stop());
        video.srcObject = null;
        isStreaming = false;
        btnCamera.classList.add("off");
    }
}

function toggleCamera() {
    const iconCamera = document.getElementById('iconCamera');

    if (isStreaming) {
        stopCamera();
        iconCamera.setAttribute('name', 'videocam-outline'); // Cámara apagada
    } else {
        startCamera();
        iconCamera.setAttribute('name', 'videocam'); // Cámara encendida
    }
}


socket.on('processed_frame', (data) => {
    if (isDetectionOn) {
        processedFrame.src = `data:image/jpeg;base64,${data}`;
    }
});

let currentLetter = null;
let letterTimeout = null;

socket.on('letter_detected', (letter) => {
    // Si la letra detectada es diferente a la anterior, actualiza
    if (letter !== currentLetter) {
        currentLetter = letter;

        // Mostrar la letra
        textBox.innerHTML = `<strong>Letra detectada:</strong> <span style="font-size: 24px">${letter}</span>`;

        // Decir la letra
        const utterance = new SpeechSynthesisUtterance(letter);
        utterance.lang = 'es-ES';
        window.speechSynthesis.speak(utterance);

        // Reiniciar temporizador para quitar letra si no se detecta otra pronto
        if (letterTimeout) clearTimeout(letterTimeout);
        letterTimeout = setTimeout(() => {
            currentLetter = null;
            textBox.innerHTML = `<strong>Letra detectada:</strong> <span style="font-size: 20px; color: gray;">(sin gesto)</span>`;
        }, 1000); // 1 segundo sin letra nueva => limpiar
    } else {
        // Si es la misma letra, reinicia el timeout
        if (letterTimeout) clearTimeout(letterTimeout);
        letterTimeout = setTimeout(() => {
            currentLetter = null;
            textBox.innerHTML = `<strong>Letra detectada:</strong> <span style="font-size: 20px; color: gray;">(sin gesto)</span>`;
        }, 1000);
    }
});

setInterval(() => {
    if (isStreaming) {
        const canvas = document.createElement('canvas');
        canvas.width = video.videoWidth;
        canvas.height = video.videoHeight;
        const context = canvas.getContext('2d');
        context.drawImage(video, 0, 0, canvas.width, canvas.height);

        canvas.toBlob((blob) => {
            const reader = new FileReader();
            reader.readAsDataURL(blob);
            reader.onloadend = () => {
                const base64data = reader.result.split(',')[1];
                socket.emit('frame', base64data);
            };
        }, 'image/jpeg', 0.6);
    }
}, 100);

let timeout;

function showControls() {
    const container = document.querySelector('.btn-container');
    
    // Si estaba ocultándose, cancelamos eso
    container.classList.remove('fade-out');
    
    // Mostramos
    container.classList.add('show');

    // Limpiamos timeout anterior si existe
    clearTimeout(timeout);
    timeout = setTimeout(() => {
        container.classList.remove('show');
        container.classList.add('fade-out'); // <- animación de salida
    }, 3000); // Oculta tras 3 segundos
}

document.addEventListener('touchstart', () => {
    if (window.innerWidth <= 768) {
        showControls();
    }
});


startCamera();
