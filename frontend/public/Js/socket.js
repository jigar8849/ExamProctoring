const socket = io('/');
const peerConfig = {
  host: '0.peerjs.com',
  port: 443,
  secure: true,
  path: '/'
};
const myPeer = new Peer(undefined, peerConfig);
let myStream;
const peers = {};

const localVideo = document.getElementById('local-video');
const canvas = document.getElementById('whiteboard');
const ctx = canvas.getContext('2d');
const canvasContainer = document.getElementById('canvas-container');
const subtitleDisplay = document.getElementById('subtitle-display');

canvas.width = canvasContainer.offsetWidth;
canvas.height = canvasContainer.offsetHeight;


let constraints;
const connection = navigator.connection || navigator.mozConnection || navigator.webkitConnection;
if (ROLE === 'examinee') {
  constraints = { audio: true, video: false };
} else {
  if (connection && (connection.effectiveType === '2g' || connection.effectiveType === 'slow-2g' || connection.effectiveType === '3g')) {
    constraints = { audio: true, video: { width: { ideal: 320 }, height: { ideal: 240 } } };
  } else {
    constraints = { audio: true, video: { width: { ideal: 1280 }, height: { ideal: 720 } } };
  }
}

navigator.mediaDevices.getUserMedia(constraints)
  .then(stream => {
    myStream = stream;
    
    if (ROLE !== 'examinee') {
      localVideo.srcObject = stream;
      localVideo.play();
    } else {
      localVideo.style.display = 'none';
    }
    
    myPeer.on('call', call => {
      call.answer(stream);
      const remoteVideo = document.createElement('video');
      remoteVideo.classList.add('remote-video');
      call.on('stream', userVideoStream => {
        addVideoStream(remoteVideo, userVideoStream);
      });
    });

    socket.on('user-connected', ({ userID, socketId }) => {
      connectToNewUser(userID, stream);
    });
  })
  .catch(err => console.error('Error accessing media devices:', err));

socket.on('user-disconnected', userId => {
  if (peers[userId]) peers[userId].close();
});

myPeer.on('open', id => {
  socket.emit('join-chapter', { chapterID: ROOM_ID, userID: id });
});

function connectToNewUser(userId, stream) {
  const call = myPeer.call(userId, stream);
  const video = document.createElement('video');
  video.classList.add('remote-video');
  call.on('stream', userVideoStream => {
    addVideoStream(video, userVideoStream);
  });
  call.on('close', () => {
    video.remove();
  });
  peers[userId] = call;
}

function addVideoStream(video, stream) {
  video.srcObject = stream;
  video.addEventListener('loadedmetadata', () => {
    video.play();
  });
  const remoteContainer = document.getElementById('remote-video-container');
  if (!remoteContainer.querySelector('video')) {
    remoteContainer.appendChild(video);
  } else {
   
  }
}

let drawing = false;
let currentTool = 'pen';

if (ROLE !== 'examinee') {
  canvas.addEventListener('mousedown', startDrawing);
  canvas.addEventListener('mouseup', stopDrawing);
  canvas.addEventListener('mousemove', draw);
}

function startDrawing(e) {
  if (currentTool === 'pen') {
    drawing = true;
    draw(e);
  }
}

function stopDrawing() {
  if (currentTool === 'pen') {
    drawing = false;
    ctx.beginPath();
  }
}

function draw(e) {
  if (!drawing || currentTool !== 'pen') return;
  ctx.lineWidth = 2;
  ctx.lineCap = 'round';
  ctx.strokeStyle = '#000';
  ctx.lineTo(e.offsetX, e.offsetY);
  ctx.stroke();
  ctx.beginPath();
  ctx.moveTo(e.offsetX, e.offsetY);
  socket.emit('drawing', { x: e.offsetX, y: e.offsetY, room: ROOM_ID });
}

socket.on('drawing', data => {
  ctx.lineTo(data.x, data.y);
  ctx.stroke();
  ctx.beginPath();
  ctx.moveTo(data.x, data.y);
});

if (ROLE !== 'examinee') {
  const clearBtn = document.getElementById('clear-btn');
  clearBtn.addEventListener('click', () => {
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    socket.emit('clear', { room: ROOM_ID });
  });
}
socket.on('clear', () => {
  ctx.clearRect(0, 0, canvas.width, canvas.height);
});

const chatInput = document.getElementById('chat-input');
const chatMessages = document.getElementById('chat-messages');

chatInput.addEventListener('keypress', e => {
  if (e.key === 'Enter' && chatInput.value.trim()) {
    const message = chatInput.value.trim();
    socket.emit('chat-message', { message: message, room: ROOM_ID });
    addMessage('You', message);
    chatInput.value = '';
  }
});

socket.on('chat-message', data => {
  addMessage('User', data.message);
});

function addMessage(sender, message) {
  const messageElement = document.createElement('div');
  messageElement.innerHTML = `<strong>${sender}:</strong> ${message}`;
  chatMessages.appendChild(messageElement);
  chatMessages.scrollTop = chatMessages.scrollHeight;
}

if (ROLE !== 'examinee') {
  document.getElementById('camera-btn').addEventListener('click', toggleCamera);
  document.getElementById('mic-btn').addEventListener('click', toggleMic);
  document.getElementById('pen-btn').addEventListener('click', () => setTool('pen'));
  document.getElementById('text-btn').addEventListener('click', () => setTool('text'));
}

let cameraActive = true; 
let micActive = true;  

async function toggleCamera() {
  try {
    if (cameraActive) {
      myStream.getVideoTracks().forEach(track => track.enabled = false);
      cameraActive = false;
      document.getElementById('camera-btn').classList.add('active');
    } else {
      myStream.getVideoTracks().forEach(track => track.enabled = true);
      cameraActive = true;
      document.getElementById('camera-btn').classList.remove('active');
    }
  } catch (error) {
    console.error('Error toggling camera:', error);
  }
}

async function toggleMic() {
  try {
    if (micActive) {
      myStream.getAudioTracks().forEach(track => track.enabled = false);
      micActive = false;
      document.getElementById('mic-btn').classList.add('active');
    } else {
      myStream.getAudioTracks().forEach(track => track.enabled = true);
      micActive = true;
      document.getElementById('mic-btn').classList.remove('active');
    }
  } catch (error) {
    console.error('Error toggling mic:', error);
  }
}

function setTool(tool) {
  currentTool = tool;
  const penBtn = document.getElementById('pen-btn');
  const textBtn = document.getElementById('text-btn');
  
  if (tool === 'pen') {
    penBtn.classList.add('active');
    textBtn.classList.remove('active');
    canvas.style.cursor = 'crosshair';
    removeCanvasTextInput();
  } else if (tool === 'text') {
    textBtn.classList.add('active');
    penBtn.classList.remove('active');
    canvas.style.cursor = 'text';
    canvas.addEventListener('click', handleTextInput);
  }
}

function removeCanvasTextInput() {
  canvas.removeEventListener('click', handleTextInput);
}

function handleTextInput(e) {
  removeExistingTextInput();
  const input = document.createElement('input');
  input.type = 'text';
  input.className = 'canvas-text-input';
  const rect = canvas.getBoundingClientRect();
  input.style.left = (e.clientX - rect.left) + 'px';
  input.style.top = (e.clientY - rect.top) + 'px';
  canvasContainer.appendChild(input);
  input.focus();

  input.addEventListener('keydown', function(event) {
    if (event.key === 'Enter') {
      drawTextFromInput(input);
    }
  });
  input.addEventListener('blur', function() {
    drawTextFromInput(input);
  });
}

function removeExistingTextInput() {
  const existing = document.querySelector('.canvas-text-input');
  if (existing) {
    existing.parentNode.removeChild(existing);
  }
}

function drawTextFromInput(input) {
  const text = input.value.trim();
  if (text) {
    const x = parseInt(input.style.left);
    const y = parseInt(input.style.top) + 16;
    ctx.font = '16px Arial';
    ctx.fillStyle = '#000';
    ctx.fillText(text, x, y);
    socket.emit('text', { text: text, x: x, y: y, room: ROOM_ID });
  }
  input.parentNode.removeChild(input);
  if (currentTool !== 'text') {
    canvas.removeEventListener('click', handleTextInput);
  }
}

socket.on('text', data => {
  ctx.font = '16px Arial';
  ctx.fillStyle = '#000';
  ctx.fillText(data.text, data.x, data.y);
});
