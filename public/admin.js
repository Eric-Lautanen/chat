let token = localStorage.getItem('token');
let selectedRoomId = null;

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

async function fetchUsers() {
  const data = await fetchApi('/admin/users');
  const userList = document.getElementById('user-list');
  if (data.error) {
    userList.innerHTML = `<li>Error: ${data.error}</li>`;
    return;
  }
  userList.innerHTML = '';
  data.data.forEach(user => {
    const li = document.createElement('li');
    li.textContent = `${user.username} (${user.role}${user.isGuest ? ', Guest' : ''})`;
    userList.appendChild(li);
  });
}

async function fetchRooms() {
  const data = await fetchApi('/rooms');
  const roomList = document.getElementById('room-list');
  if (data.error) {
    roomList.innerHTML = `<li>Error: ${data.error}</li>`;
    return;
  }
  roomList.innerHTML = '';
  data.data.forEach(room => {
    const li = document.createElement('li');
    const deleteButton = document.createElement('button');
    deleteButton.textContent = 'Delete';
    deleteButton.className = 'delete-room-btn';
    deleteButton.dataset.roomId = room.id;
    const selectButton = document.createElement('button');
    selectButton.textContent = 'Select';
    selectButton.onclick = () => selectedRoomId = room.id;
    li.textContent = `${room.name} (Talk Limit: ${room.talkTimeLimit || 30000}ms) `;
    li.appendChild(deleteButton);
    li.appendChild(selectButton);
    roomList.appendChild(li);
  });
  document.querySelectorAll('.delete-room-btn').forEach(button => {
    button.addEventListener('click', () => {
      const roomId = button.dataset.roomId;
      deleteRoom(roomId);
    });
  });
}

async function deleteRoom(roomId) {
  const data = await fetchApi(`/admin/rooms/${roomId}`, 'DELETE');
  if (data.data?.success) fetchRooms();
}

async function setTalkTime() {
  if (!selectedRoomId) {
    alert('Please select a room first');
    return;
  }
  const talkTimeLimit = parseInt(document.getElementById('talk-time-input').value) || 30000;
  const data = await fetchApi(`/admin/rooms/${selectedRoomId}/talk-time`, 'PUT', { talkTimeLimit });
  if (data.data?.success) fetchRooms();
}

function logout() {
  localStorage.removeItem('token');
  token = null;
  window.location.reload();
}

if (token) {
  document.getElementById('admin-panel').style.display = 'block';
  fetchUsers();
  fetchRooms();
  document.getElementById('logout-btn').addEventListener('click', logout);
  document.getElementById('set-talk-time-btn').addEventListener('click', setTalkTime); // Added
} else {
  document.getElementById('auth').style.display = 'block';
}