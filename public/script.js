let token = localStorage.getItem('token');
let currentRoomId = null;
const ws = token ? new WebSocket(`ws://localhost:3000?token=${token}`) : null;
let localStream = null;
const peerConnections = new Map(); // userId -> RTCPeerConnection
const userNames = new Map(); // userId -> username
let currentUserId = null;
let currentUsername = null;

if (ws) {
  initializeWebSocket();
}

function showChat() {
  document.getElementById('auth').style.display = 'none';
  const chatElement = document.getElementById('chat');
  if (chatElement) chatElement.style.display = 'block';
  if (token) fetchRooms();
  if (token) {
    const storedData = JSON.parse(localStorage.getItem('authData') || '{}');
    currentUserId = storedData.userId;
    currentUsername = storedData.username;
    userNames.set(currentUserId, currentUsername); // Seed with self
  }
}

if (token) {
  showChat();
}

async function fetchApi(endpoint, method = 'GET', body = null) {
  const headers = { 'Content-Type': 'application/json' };
  if (token) headers['Authorization'] = `Bearer ${token}`;
  const response = await fetch(`http://localhost:3000/api${endpoint}`, {
    method,
    headers,
    body: body ? JSON.stringify(body) : null
  });
  return response.json();
}

async function register() {
  const username = document.getElementById('username').value;
  const password = document.getElementById('password').value;
  const data = await fetchApi('/register', 'POST', { username, password });
  if (data.data?.token) {
    token = data.data.token;
    currentUserId = data.data.userId;
    currentUsername = username;
    localStorage.setItem('token', token);
    localStorage.setItem('authData', JSON.stringify({ userId: currentUserId, username: currentUsername }));
    window.location.reload();
  } else {
    alert(data.error);
  }
}

async function login() {
  const username = document.getElementById('username').value;
  const password = document.getElementById('password').value;
  const data = await fetchApi('/login', 'POST', { username, password });
  if (data.data?.token) {
    token = data.data.token;
    currentUserId = data.data.userId;
    currentUsername = username;
    localStorage.setItem('token', token);
    localStorage.setItem('authData', JSON.stringify({ userId: currentUserId, username: currentUsername }));
    window.location.reload();
  } else {
    alert(data.error);
  }
}

async function guestLogin() {
  const preferredName = document.getElementById('guest-name').value || 'Guest';
  const data = await fetchApi('/guest', 'POST', { preferredName });
  if (data.data?.token) {
    token = data.data.token;
    currentUserId = data.data.userId;
    currentUsername = preferredName;
    localStorage.setItem('token', token);
    localStorage.setItem('authData', JSON.stringify({ userId: currentUserId, username: currentUsername }));
    window.location.reload();
  } else {
    alert('Guest login failed');
  }
}

async function fetchRooms() {
  const data = await fetchApi('/rooms');
  const roomList = document.getElementById('room-list');
  roomList.innerHTML = '';
  data.data.forEach(room => {
    const li = document.createElement('li');
    li.innerHTML = `${room.name} (${room.userCount} users) <button class="join-room-btn" data-room-id="${room.id}">Join</button>`;
    roomList.appendChild(li);
  });
  document.querySelectorAll('.join-room-btn').forEach(button => {
    button.addEventListener('click', () => {
      const roomId = button.getAttribute('data-room-id');
      joinRoom(roomId);
    });
  });
}

async function createRoom() {
  const name = document.getElementById('room-name').value;
  const data = await fetchApi('/rooms', 'POST', { name, isPublic: true });
  if (data.data) fetchRooms();
}

async function joinRoom(roomId) {
  currentRoomId = roomId;
  ws.send(JSON.stringify({ type: 'join', roomId }));
  const data = await fetchApi(`/rooms/${roomId}/history`);
  const messages = document.getElementById('messages');
  messages.innerHTML = '';
  data.data.forEach(msg => addMessage(msg));
  const messageInput = document.getElementById('message-input');
  messageInput.addEventListener('keypress', function(event) {
    if (event.key === 'Enter') {
      event.preventDefault();
      sendMessage();
    }
  });
  ws.send(JSON.stringify({ type: 'webrtc-register', roomId }));
  startAudio();
}

function sendMessage() {
  const content = document.getElementById('message-input').value;
  if (currentRoomId && content) {
    ws.send(JSON.stringify({ type: 'message', roomId: currentRoomId, content }));
    document.getElementById('message-input').value = '';
  }
}

function initializeWebSocket() {
  ws.onmessage = (event) => {
    const message = JSON.parse(event.data);
    if (message.type === 'activeUsers') {
      // Sync all users immediately from activeUsers
      userNames.clear(); // Reset
      userNames.set(currentUserId, currentUsername); // Re-add self
      let peerIndex = 0;
      message.users.forEach(username => {
        if (username !== currentUsername) { // Skip self
          const peerIds = Array.from(peerConnections.keys()).filter(id => id !== currentUserId);
          const userId = peerIds[peerIndex] || `${username}-${Date.now()}`;
          userNames.set(userId, username); // Map server usernames to peer IDs
          peerIndex++;
        }
      });
      updateActiveUsers(); // Refresh on activeUsers
    } else if (message.userId && message.content) {
      userNames.set(message.userId, message.username || 'Guest'); // Fallback from messages
      addMessage(message);
      updateActiveUsers(); // Refresh on message
    } else if (message.type === 'webrtc-signal') {
      handleSignal(message.fromUserId, message.signal);
    } else if (message.type === 'webrtc-peer-update') {
      handlePeerUpdate(message.userId, message.connect, message.hasVideo);
    }
  };
}

function addMessage(msg) {
  const messages = document.getElementById('messages');
  const div = document.createElement('div');
  div.textContent = `${msg.username || 'Guest'}: ${msg.content}`;
  messages.appendChild(div);
  messages.scrollTop = messages.scrollHeight;
}

function updateActiveUsers() {
  const activeUsersList = document.getElementById('active-users');
  if (!activeUsersList) return; // Guard against null
  activeUsersList.innerHTML = ''; // Clear list
  const allUsers = Array.from(peerConnections.keys()).concat(currentUserId); // All peers + self
  const uniqueUsers = [...new Set(allUsers)]; // Dedupe
  uniqueUsers.forEach(userId => {
    const username = userNames.get(userId) || 'Guest'; // Default to Guest if unmapped
    const li = document.createElement('li');
    li.className = 'user-item';
    li.textContent = username;
    if (userId !== currentUserId) { // No controls for self
      const audio = document.getElementById(`audio-${userId}`);
      const volumeSlider = document.createElement('input');
      volumeSlider.type = 'range';
      volumeSlider.min = '0';
      volumeSlider.max = '1';
      volumeSlider.step = '0.1';
      volumeSlider.value = audio ? audio.volume : '1';
      volumeSlider.className = 'volume-slider';
      volumeSlider.id = `volume-${userId}`;
      volumeSlider.oninput = () => {
        const audio = document.getElementById(`audio-${userId}`);
        if (!audio) return;
        audio.volume = volumeSlider.value;
        console.log(`Set volume for ${userId} to ${audio.volume}`); 
      };
      li.appendChild(volumeSlider);
    }
    activeUsersList.appendChild(li);
  });
}

async function startAudio() {
  try {
    if (!localStream) {
      localStream = await navigator.mediaDevices.getUserMedia({ audio: true, video: false });
      console.log('Local audio track initialized, enabled: true'); 
    }
    const audio = document.createElement('audio');
    audio.id = `audio-local-${currentUserId}`;
    audio.srcObject = localStream;
    audio.autoplay = true;
    audio.muted = true;
    document.body.appendChild(audio);
    peerConnections.forEach(pc => addStreamToPeer(pc, false));
    updateActiveUsers(); // Initial list
    console.log('Audio started, tracks added to peers, local audio element added');
  } catch (error) {
    console.error('Failed to start audio:', error);
  }
}

function addStreamToPeer(pc, includeVideo = false) {
  if (!localStream) return;
  pc.getSenders().forEach(sender => pc.removeTrack(sender)); 
  const tracks = includeVideo ? localStream.getTracks() : localStream.getAudioTracks();
  tracks.forEach(track => {
    const sender = pc.addTrack(track, localStream);
    console.log(`Added ${track.kind} track to peer ${pc.userId || 'unknown'}, enabled: ${track.enabled}, sender: ${sender ? 'added' : 'failed'}`); 
  });
}

function handlePeerUpdate(userId, connect, hasVideo) {
  if (connect) {
    createPeerConnection(userId, true, hasVideo);
  } else {
    const pc = peerConnections.get(userId);
    if (pc) {
      pc.close();
      peerConnections.delete(userId);
      const audio = document.getElementById(`audio-${userId}`);
      if (audio) audio.remove();
    }
  }
  updateActiveUsers(); // Always refresh
}

function createPeerConnection(userId, initiator = false, hasVideo = false) {
  const pc = new RTCPeerConnection({ iceServers: [{ urls: 'stun:stun.l.google.com:19302' }] });
  pc.userId = userId;
  peerConnections.set(userId, pc);

  pc.onicecandidate = (event) => {
    if (event.candidate) {
      ws.send(JSON.stringify({ type: 'webrtc-signal', toUserId: userId, signal: event.candidate, roomId: currentRoomId }));
      console.log(`Sent ICE candidate to ${userId}`); 
    }
  };

  pc.ontrack = (event) => {
    console.log(`Received track from ${userId}: ${event.track.kind}, enabled: ${event.track.enabled}`); 
    if (event.track.kind === 'audio') {
      const audio = document.createElement('audio'); 
      audio.id = `audio-${userId}`;
      audio.srcObject = new MediaStream([event.track]);
      audio.autoplay = true;
      audio.volume = 1.0;
      document.body.appendChild(audio); 
      updateActiveUsers(); // Refresh UI
    }
  };

  if (localStream) addStreamToPeer(pc, hasVideo);

  if (initiator) {
    pc.createOffer()
      .then(offer => pc.setLocalDescription(offer))
      .then(() => {
        ws.send(JSON.stringify({ type: 'webrtc-signal', toUserId: userId, signal: pc.localDescription, roomId: currentRoomId }));
        console.log(`Sent offer to ${userId}`); 
      })
      .catch(error => console.error('Offer creation failed:', error));
  }

  return pc;
}

async function handleSignal(fromUserId, signal) {
  let pc = peerConnections.get(fromUserId);
  if (!pc) pc = createPeerConnection(fromUserId, false, signal.type === 'video-on');

  try {
    if (signal.type === 'offer') {
      await pc.setRemoteDescription(new RTCSessionDescription(signal));
      const answer = await pc.createAnswer();
      await pc.setLocalDescription(answer);
      ws.send(JSON.stringify({ type: 'webrtc-signal', toUserId: fromUserId, signal: answer, roomId: currentRoomId }));
      console.log(`Sent answer to ${fromUserId}`); 
    } else if (signal.type === 'answer') {
      await pc.setRemoteDescription(new RTCSessionDescription(signal));
      console.log(`Set remote answer from ${fromUserId}`); 
    } else if (signal.candidate) {
      await pc.addIceCandidate(new RTCIceCandidate(signal));
      console.log(`Added ICE candidate from ${fromUserId}`); 
    }
  } catch (error) {
    console.error('Signal handling failed:', error);
  }
}

function logout() {
  localStorage.removeItem('token');
  localStorage.removeItem('authData');
  token = null;
  if (localStream) {
    localStream.getTracks().forEach(track => track.stop());
    localStream = null;
  }
  peerConnections.forEach(pc => pc.close());
  peerConnections.clear();
  userNames.clear();
  if (ws) ws.close();
  window.location.reload();
}

// Event listeners simplified for all devices
document.getElementById('register-btn').addEventListener('click', (e) => register());
document.getElementById('guest-btn').addEventListener('click', (e) => guestLogin());
document.getElementById('auth-form').addEventListener('submit', (event) => {
  event.preventDefault(); // Keep control
  login();
});
document.getElementById('create-room-btn').addEventListener('click', (e) => createRoom());
document.getElementById('send-message-btn').addEventListener('click', (e) => sendMessage());
document.getElementById('logout-btn').addEventListener('click', (e) => logout());