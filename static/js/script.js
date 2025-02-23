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


recognition.onresult = (event) => {
    let finalTranscript = '';
    for (let i = event.resultIndex; i < event.results.length; i++) {
        if (event.results[i].isFinal) {
            finalTranscript += event.results[i][0].transcript + ' ';
        }
    }
    document.getElementById('subtitle-text').innerText = finalTranscript;
    

};



recognition.start();

let videoStream = null;
let audioStream = null;
let isStreaming = false;
let isAudioOn = false;

async function startCamera() {
try {
videoStream = await navigator.mediaDevices.getUserMedia({
    video: { width: 640, height: 480 },
    audio: false
});
video.srcObject = videoStream;
isStreaming = true;
btnCamera.classList.remove("off");

// Ocultar el spinner de carga
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
if (isStreaming) {
stopCamera();
} else {
startCamera();
}
}

async function toggleAudio() {
    if (!audioStream) {
        try {
            audioStream = await navigator.mediaDevices.getUserMedia({ audio: true });
            isAudioOn = true;
            recognition.start(); // Inicia el reconocimiento al encender el micrófono
        } catch (error) {
            console.error('Error al acceder al micrófono:', error);
            return;
        }
    } else {
        let audioTrack = audioStream.getAudioTracks()[0];
        if (audioTrack) {
            audioTrack.enabled = !audioTrack.enabled;
            isAudioOn = audioTrack.enabled;
            if (isAudioOn) {
                recognition.start(); // Asegura que se reinicie si el micrófono estaba apagado
            } else {
                recognition.stop();
            }
            btnMic.classList.toggle("off", !isAudioOn);
        }
    }
}




window.onload = function() {
    // Al cargar la página, mostrar la vista procesada por defecto
    isDetectionOn = true;
    processedFrame.style.display = 'block';
    video.style.display = 'none';
}

function toggleDetection() {
    isDetectionOn = !isDetectionOn;
    btnDetection.classList.toggle("off", !isDetectionOn);
    
    if (isDetectionOn) {
        processedFrame.style.display = 'block';
        video.style.display = 'none';
    } else {
        processedFrame.style.display = 'none';
        video.style.display = 'block';
    }
}

let isButtonContainerVisible = false;
let hideTimeout;

function toggleButtonContainer() {
    const btnContainer = document.querySelector('.btn-container');
    
    if (!isButtonContainerVisible) {
        // Mostrar los botones solo si no están visibles
        btnContainer.classList.add('show');
        isButtonContainerVisible = true;
        
        // Ocultar los botones después de 6 segundos
        clearTimeout(hideTimeout);
        hideTimeout = setTimeout(() => {
            btnContainer.classList.remove('show');
            isButtonContainerVisible = false;
        }, 6000); // 6 segundos
    }
}

// Detectamos el toque en la pantalla en dispositivos móviles
document.body.addEventListener('touchstart', toggleButtonContainer);

// Aseguramos que los botones no desaparezcan en pantallas de PC
if (window.innerWidth > 768) {
    document.querySelector('.btn-container').style.display = 'flex';
}

function sendFrameToServer() {
    if (!isStreaming || !isDetectionOn) return;

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

socket.on('processed_frame', (data) => {
    if (isDetectionOn) {
        processedFrame.src = `data:image/jpeg;base64,${data}`; // Actualiza la imagen procesada
    }
});

socket.on('detection_data', (data) => {
    textBox.innerHTML = `<strong>Información detectada:</strong><br>${data}`; // Muestra la información detectada
});

socket.on('subtitles', (text) => {
    subtitleText.innerText = text; // Muestra los subtítulos en tiempo real
});

setInterval(sendFrameToServer, 100);
startCamera();

src="https://cdn.jsdelivr.net/npm/bootstrap@5.3.0/dist/js/bootstrap.bundle.min.js"