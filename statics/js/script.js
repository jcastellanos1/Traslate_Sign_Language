const socket = io();
const video = document.getElementById('video-stream');
const processedFrame = document.getElementById('processed-frame');
const textBox = document.getElementById('text-box');
const btnCamera = document.getElementById('btnCamera');
const btnMic = document.getElementById('btnMic');
const btnDetection = document.getElementById('btnDetection');

let stream = null;
let isStreaming = false;
let isAudioOn = true;
let isDetectionOn = true;

async function startCamera() {
    try {
        stream = await navigator.mediaDevices.getUserMedia({ video: true, audio: true });
        video.srcObject = stream;
        isStreaming = true;
        btnCamera.classList.remove("off");
    } catch (error) {
        console.error('Error al acceder a la cámara:', error);
    }
}

function stopCamera() {
    if (stream) {
        stream.getTracks().forEach(track => track.stop());
        video.srcObject = null;
        isStreaming = false;
        btnCamera.classList.add("off");
    }
}

function toggleCamera() {
    isStreaming ? stopCamera() : startCamera();
}

function toggleAudio() {
    if (stream) {
        let audioTrack = stream.getAudioTracks()[0];
        audioTrack.enabled = !audioTrack.enabled;
        isAudioOn = audioTrack.enabled;
        btnMic.classList.toggle("off", !isAudioOn);
    }
}

socket.on('processed_frame', (data) => {
    if (isDetectionOn) processedFrame.src = `data:image/jpeg;base64,${data}`;
});

socket.on('detection_data', (data) => {
    textBox.innerHTML = `<strong>Información detectada:</strong><br>${data}`;
});

setInterval(() => {
    if (isStreaming && isDetectionOn) socket.emit('frame', video);
}, 100);

startCamera();
