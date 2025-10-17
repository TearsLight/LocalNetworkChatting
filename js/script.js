let ws = null;
let nickname = 'Anonymous';

const loginScreen = document.getElementById('loginScreen');
const chatScreen = document.getElementById('chatScreen');
const nicknameInput = document.getElementById('nicknameInput');
const serverInput = document.getElementById('serverInput');
const joinBtn = document.getElementById('joinBtn');
const messagesContainer = document.getElementById('messagesContainer');
const messageInput = document.getElementById('messageInput');
const sendBtn = document.getElementById('sendBtn');
const onlineCount = document.getElementById('onlineCount');
const connectionStatus = document.getElementById('connectionStatus');
const errorMsg = document.getElementById('errorMsg');

joinBtn.addEventListener('click', connectToServer);
nicknameInput.addEventListener('keypress', (e) => {
    if (e.key === 'Enter') connectToServer();
});

function connectToServer() {
    nickname = nicknameInput.value.trim() || 'Anonymous';
    const serverUrl = serverInput.value.trim();

    if (!serverUrl.startsWith('ws://') && !serverUrl.startsWith('wss://')) {
        showError('服务器地址必须以 ws:// 或 wss:// 开头');
        return;
    }

    joinBtn.disabled = true;
    joinBtn.textContent = '连接中...';
    errorMsg.style.display = 'none';

    try {
        ws = new WebSocket(serverUrl);

        ws.onopen = () => {
            console.log('WebSocket 连接成功');
            connectionStatus.textContent = '已连接';
            connectionStatus.className = 'connection-status connected';
            
            ws.send(JSON.stringify({
                type: 'join',
                nickname: nickname
            }));

            loginScreen.classList.add('hidden');
            chatScreen.classList.add('active');
            messageInput.focus();
        };

        ws.onmessage = (event) => {
            const data = JSON.parse(event.data);
            handleMessage(data);
        };

        ws.onerror = (error) => {
            console.error('WebSocket 错误:', error);
            showError('连接失败，请检查服务器地址是否正确');
            joinBtn.disabled = false;
            joinBtn.textContent = '加入聊天室';
        };

        ws.onclose = () => {
            console.log('WebSocket 连接关闭');
            connectionStatus.textContent = '已断开';
            connectionStatus.className = 'connection-status disconnected';
            sendBtn.disabled = true;
            messageInput.disabled = true;
            addSystemMessage('连接已断开');
        };

    } catch (error) {
        showError('连接失败: ' + error.message);
        joinBtn.disabled = false;
        joinBtn.textContent = '加入聊天室';
    }
}

function showError(message) {
    errorMsg.textContent = message;
    errorMsg.style.display = 'block';
}

function handleMessage(data) {
    if (data.type === 'system') {
        addSystemMessage(data.message);
        if (data.online_count !== undefined) {
            onlineCount.textContent = `👥 ${data.online_count} 人在线`;
        }
    } else if (data.type === 'message') {
        addUserMessage(data.nickname, data.message, data.timestamp);
    }
}

function addSystemMessage(text) {
    const messageDiv = document.createElement('div');
    messageDiv.className = 'message system';
    messageDiv.textContent = text;
    messagesContainer.appendChild(messageDiv);
    scrollToBottom();
}

function addUserMessage(nick, content, time) {
    const messageDiv = document.createElement('div');
    messageDiv.className = 'message user';
    messageDiv.innerHTML = `
        <div class="message-header">
            <span class="message-nickname">${escapeHtml(nick)}</span>
            <span class="message-time">${time}</span>
        </div>
        <div class="message-content">${escapeHtml(content)}</div>
    `;
    messagesContainer.appendChild(messageDiv);
    scrollToBottom();
}

function sendMessage() {
    const message = messageInput.value.trim();
    if (message && ws && ws.readyState === WebSocket.OPEN) {
        ws.send(JSON.stringify({
            type: 'message',
            message: message
        }));
        messageInput.value = '';
    }
}

sendBtn.addEventListener('click', sendMessage);
messageInput.addEventListener('keypress', (e) => {
    if (e.key === 'Enter') sendMessage();
});

function scrollToBottom() {
    messagesContainer.scrollTop = messagesContainer.scrollHeight;
}

function escapeHtml(text) {
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
}
setInterval(() => {
  if (socket.readyState === WebSocket.OPEN) {
    socket.send(JSON.stringify({ type: "ping" }));
  }
}, 30000);