let ws = null;
let nickname = 'Anonymous';
let heartbeatInterval = null;
let reconnectAttempts = 0;
const MAX_RECONNECT_ATTEMPTS = 5;

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
const disconnectBtn = document.getElementById('disconnectBtn');
const userListPanel = document.getElementById('userListPanel');
const userListContainer = document.getElementById('userListContainer');
const toggleUserListBtn = document.getElementById('toggleUserListBtn');

joinBtn.addEventListener('click', connectToServer);
nicknameInput.addEventListener('keypress', (e) => {
    if (e.key === 'Enter') connectToServer();
});

disconnectBtn.addEventListener('click', () => {
    if (ws && ws.readyState === WebSocket.OPEN) {
        // 发送断开消息
        ws.send(JSON.stringify({ type: 'disconnect' }));
        stopHeartbeat();
        ws.close();
        
        // 重置界面
        chatScreen.classList.remove('active');
        loginScreen.classList.remove('hidden');
        messagesContainer.innerHTML = '';
        joinBtn.disabled = false;
        joinBtn.textContent = '加入聊天室';
    }
});

toggleUserListBtn.addEventListener('click', () => {
    userListPanel.classList.toggle('show');
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
            reconnectAttempts = 0;
            
            ws.send(JSON.stringify({
                type: 'join',
                nickname: nickname
            }));

            loginScreen.classList.add('hidden');
            chatScreen.classList.add('active');
            messageInput.focus();
            
            // 启动心跳
            startHeartbeat();
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
            stopHeartbeat();
        };

        ws.onclose = () => {
            console.log('WebSocket 连接关闭');
            connectionStatus.textContent = '已断开';
            connectionStatus.className = 'connection-status disconnected';
            sendBtn.disabled = true;
            messageInput.disabled = true;
            addSystemMessage('连接已断开');
            stopHeartbeat();
            
            // 尝试重连
            attemptReconnect();
        };

    } catch (error) {
        showError('连接失败: ' + error.message);
        joinBtn.disabled = false;
        joinBtn.textContent = '加入聊天室';
        stopHeartbeat();
    }
}

// ========== 保活机制 ==========
function startHeartbeat() {
    stopHeartbeat(); // 确保没有重复的定时器
    
    heartbeatInterval = setInterval(() => {
        if (ws && ws.readyState === WebSocket.OPEN) {
            ws.send(JSON.stringify({ type: 'heartbeat' }));
            console.log('发送心跳');
        }
    }, 25000); // 每25秒发送一次心跳
}

function stopHeartbeat() {
    if (heartbeatInterval) {
        clearInterval(heartbeatInterval);
        heartbeatInterval = null;
    }
}

// ========== 重连机制 ==========
function attemptReconnect() {
    if (reconnectAttempts >= MAX_RECONNECT_ATTEMPTS) {
        addSystemMessage(`重连失败，已尝试 ${MAX_RECONNECT_ATTEMPTS} 次`);
        return;
    }
    
    reconnectAttempts++;
    const delay = Math.min(1000 * Math.pow(2, reconnectAttempts), 30000);
    
    addSystemMessage(`${delay/1000} 秒后尝试重连 (${reconnectAttempts}/${MAX_RECONNECT_ATTEMPTS})...`);
    
    setTimeout(() => {
        if (ws.readyState === WebSocket.CLOSED) {
            connectToServer();
        }
    }, delay);
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
    } else if (data.type === 'userlist') {
        updateUserList(data.users);
        onlineCount.textContent = `👥 ${data.count} 人在线`;
    } else if (data.type === 'history') {
        // 加载历史消息
        addSystemMessage('📜 加载历史消息...');
        data.messages.forEach(msg => {
            if (msg.message_type === 'system') {
                addSystemMessage(msg.message);
            } else {
                addUserMessage(msg.nickname, msg.message, msg.time);
            }
        });
        addSystemMessage('📜 历史消息加载完成');
    } else if (data.type === 'stats') {
        // 显示统计信息
        console.log('统计信息:', data.data);
    }
}

function updateUserList(users) {
    userListContainer.innerHTML = '';
    
    if (users.length === 0) {
        userListContainer.innerHTML = '<div class="no-users">暂无在线用户</div>';
        return;
    }
    
    users.forEach(user => {
        const userDiv = document.createElement('div');
        userDiv.className = 'user-item';
        
        const joinTime = new Date(user.joinTime);
        const timeStr = joinTime.toLocaleTimeString('zh-CN');
        
        userDiv.innerHTML = `
            <div class="user-item-header">
                <span class="user-nickname">👤 ${escapeHtml(user.nickname)}</span>
                <span class="user-id">#${user.id}</span>
            </div>
            <div class="user-info">
                <div class="user-ip">🌐 ${escapeHtml(user.ip)}</div>
                <div class="user-time">🕐 ${timeStr}</div>
            </div>
        `;
        
        userListContainer.appendChild(userDiv);
    });
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

// 页面卸载时清理
window.addEventListener('beforeunload', () => {
    if (ws && ws.readyState === WebSocket.OPEN) {
        ws.send(JSON.stringify({ type: 'disconnect' }));
        stopHeartbeat();
    }
});