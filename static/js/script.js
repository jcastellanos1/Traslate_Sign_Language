const socket = io();
const video = document.getElementById('video-stream');
const processedFrame = document.getElementById('processed-frame');
const textBox = document.getElementById('text-box');
const subtitleText = document.getElementById('subtitle-text');
const btnCamera = document.getElementById('btnCamera');
const btnMic = document.getElementById('btnMic');

const recognition = new (window.SpeechRecognition || window.webkitSpeechRecognition)();
recognition.lang = 'es-ES';
recognition.continuous = true;
recognition.interimResults = true;

let modoSeleccionado = 'letras';
const selectModo = document.getElementById("modo");
selectModo.addEventListener('change', () => {
    modoSeleccionado = selectModo.value;
});

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
    } else if (window.matchMedia('(prefers-color-scheme: dark)').matches) {
        document.body.classList.add('dark-mode');
    }

    const micCheckbox = document.getElementById('checkbox');
    micCheckbox.addEventListener('change', function () {
        if (micCheckbox.checked) recognition.stop();
        else recognition.start();
    });

    const detectionCheckbox = document.getElementById('checkboxDetection');
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
    if (isRecognitionActive) recognition.stop();
    else recognition.start();
    isRecognitionActive = !isRecognitionActive;
    btnMic.classList.toggle("off", !isRecognitionActive);
}
recognition.start();

let videoStream = null;
let isStreaming = false;
let isDetectionOn;

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
        iconCamera.setAttribute('name', 'videocam-outline');
    } else {
        startCamera();
        iconCamera.setAttribute('name', 'videocam');
    }
}

function actualizarDeteccion() {
    isDetectionOn = document.getElementById('checkboxDetection').checked;
    processedFrame.style.display = isDetectionOn ? 'block' : 'none';
    video.style.display = isDetectionOn ? 'none' : 'block';
    if (!isDetectionOn) processedFrame.src = '';
}

socket.on('processed_frame', (data) => {
    if (isDetectionOn) {
        processedFrame.src = `data:image/jpeg;base64,${data}`;
    }
});

let currentValue = null;
let clearTimeoutRef = null;
function actualizarDeteccionTexto(tipo, valor) {
    const prefijo = tipo === 'letra' ? '(Letra) ' : '(Número) ';
    const contenido = `${prefijo}${valor}`;
    if (contenido !== currentValue) {
        currentValue = contenido;
        textBox.innerHTML = `<strong>Letra/Número detectado:</strong> <span style="font-size: 24px">${contenido}</span>`;
        const utterance = new SpeechSynthesisUtterance(valor);
        utterance.lang = 'es-ES';
        window.speechSynthesis.speak(utterance);
        if (clearTimeoutRef) clearTimeout(clearTimeoutRef);
        clearTimeoutRef = setTimeout(() => {
            currentValue = null;
            textBox.innerHTML = `<strong>Letra/Número detectado:</strong> <span style="font-size: 20px; color: gray;">(sin gesto)</span>`;
        }, 1000);
    } else {
        if (clearTimeoutRef) clearTimeout(clearTimeoutRef);
        clearTimeoutRef = setTimeout(() => {
            currentValue = null;
            textBox.innerHTML = `<strong>Letra/Número detectado:</strong> <span style="font-size: 20px; color: gray;">(sin gesto)</span>`;
        }, 1000);
    }
}

socket.on('letter_detected', (letra) => {
    actualizarDeteccionTexto('letra', letra);
});
socket.on('number_detected', (numero) => {
    actualizarDeteccionTexto('numero', numero);
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
                socket.emit('frame', {
                    imagen: base64data,
                    modo: modoSeleccionado
                });
            };
        }, 'image/jpeg', 0.6);
    }
}, 100);

document.addEventListener('touchstart', () => {
    if (window.innerWidth <= 768) {
        showControls();
    }
});

let timeout;
function showControls() {
    const container = document.querySelector('.btn-container');
    if (!container) return;
    container.classList.add('show');
    clearTimeout(timeout);
    timeout = setTimeout(() => {
        container.classList.remove('show');
        container.classList.add('fade-out');
    }, 3000);
}

startCamera();
