const http = require('http');
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const Database = require('./database');
const db = new Database('./chat.db');
const clients = new Map();
let clientIdCounter = 0;
const mimeTypes = {
    '.html': 'text/html',
    '.css': 'text/css',
    '.js': 'text/javascript',
    '.json': 'application/json',
    '.png': 'image/png',
    '.jpg': 'image/jpeg',
    '.gif': 'image/gif',
    '.ico': 'image/x-icon',
    '.mp4': 'video/mp4'
};

const ROOT_DIR = path.resolve(__dirname);

// ========== 保活检测 ==========
const HEARTBEAT_INTERVAL = 30000;
const HEARTBEAT_TIMEOUT = 60000;

function startHeartbeat(client) {
    client.heartbeatInterval = setInterval(() => {
        if (!client.isAlive) {
            console.log(`[${getTime()}] Client ${client.id} (${client.nickname}) heartbeat timeout`);
            clearInterval(client.heartbeatInterval);
            client.socket.end();
            return;
        }
        
        client.isAlive = false;
        try {
            client.socket.write(Buffer.from([0x89, 0x00]));
        } catch (err) {
            clearInterval(client.heartbeatInterval);
        }
    }, HEARTBEAT_INTERVAL);
}

// ========== WebSocket ==========
function handleWebSocketUpgrade(req, socket) {
    const key = req.headers['sec-websocket-key'];
    if (!key) {
        socket.end('HTTP/1.1 400 Bad Request\r\n\r\n');
        return;
    }

    const acceptKey = crypto
        .createHash('sha1')
        .update(key + '258EAFA5-E914-47DA-95CA-C5AB0DC85B11')
        .digest('base64');

    const headers = [
        'HTTP/1.1 101 Switching Protocols',
        'Upgrade: websocket',
        'Connection: Upgrade',
        `Sec-WebSocket-Accept: ${acceptKey}`,
        '',
        ''
    ].join('\r\n');
    socket.write(headers);

    const clientId = ++clientIdCounter;
    
    const clientIP = req.headers['x-forwarded-for']?.split(',')[0].trim() 
                     || req.socket.remoteAddress 
                     || 'unknown';
    
    const client = {
        id: clientId,
        socket,
        nickname: 'Anonymous',
        ip: clientIP,
        joinTime: new Date(),
        isAlive: true,
        heartbeatInterval: null,
        userId: null,
        sessionId: null
    };

    clients.set(clientId, client);
    console.log(`[${getTime()}] Client ${clientId} connected from ${clientIP} (Online: ${clients.size})`);
    db.logSystem('connection', `Client ${clientId} connected`, clientIP).catch(console.error);

    startHeartbeat(client);

    let buffer = Buffer.alloc(0);

    socket.on('data', (data) => {
        buffer = Buffer.concat([buffer, data]);
        while (buffer.length > 0) {
            const frame = parseFrame(buffer);
            if (!frame) break;
            buffer = buffer.slice(frame.length);

            if (frame.opcode === 0x8) {
                console.log(`[${getTime()}] Client ${clientId} (${client.nickname}) sent close frame`);
                socket.end();
                return;
            }

            if (frame.opcode === 0x9) {
                socket.write(Buffer.from([0x8A, 0x00]));
                client.isAlive = true;
                continue;
            }

            if (frame.opcode === 0xA) {
                client.isAlive = true;
                continue;
            }

            if (frame.opcode === 0x1) {
                try {
                    const message = JSON.parse(frame.payload);
                    handleMessage(client, message);
                } catch {
                    console.log(`[${getTime()}] Invalid JSON from client ${clientId}`);
                }
            }
        }
    });

    socket.on('close', () => {
        removeClient(client);
    });

    socket.on('error', (err) => {
        console.log(`[${getTime()}] Socket error: ${err.message}`);
        removeClient(client);
    });
}

async function removeClient(client) {
    if (!clients.has(client.id)) return;
    
    if (client.heartbeatInterval) {
        clearInterval(client.heartbeatInterval);
    }
    
    const nickname = client.nickname;
    
    if (client.sessionId) {
        try {
            await db.endSession(client.sessionId);
        } catch (err) {
            console.error('结束会话失败:', err);
        }
    }
    
    db.logSystem('disconnection', `${nickname} disconnected`, client.ip).catch(console.error);
    
    clients.delete(client.id);
    console.log(`[${getTime()}] ${nickname} disconnected (Online: ${clients.size})`);
    
    broadcast({
        type: 'system',
        message: `${nickname} left the chat`,
        timestamp: getTime(),
        online_count: clients.size
    });
    
    broadcastUserList();
}

function parseFrame(buffer) {
    if (buffer.length < 2) return null;
    const firstByte = buffer[0];
    const secondByte = buffer[1];
    const opcode = firstByte & 0x0F;
    const masked = (secondByte & 0x80) === 0x80;
    let payloadLength = secondByte & 0x7F;
    let offset = 2;

    if (payloadLength === 126) {
        if (buffer.length < 4) return null;
        payloadLength = buffer.readUInt16BE(2);
        offset = 4;
    } else if (payloadLength === 127) {
        if (buffer.length < 10) return null;
        payloadLength = Number(buffer.readBigUInt64BE(2));
        offset = 10;
    }

    if (masked) {
        if (buffer.length < offset + 4) return null;
        const maskingKey = buffer.slice(offset, offset + 4);
        offset += 4;

        if (buffer.length < offset + payloadLength) return null;
        const payload = Buffer.alloc(payloadLength);
        for (let i = 0; i < payloadLength; i++) {
            payload[i] = buffer[offset + i] ^ maskingKey[i % 4];
        }
        return { opcode, payload: payload.toString('utf8'), length: offset + payloadLength };
    }

    if (buffer.length < offset + payloadLength) return null;
    return {
        opcode,
        payload: buffer.slice(offset, offset + payloadLength).toString('utf8'),
        length: offset + payloadLength
    };
}

function createFrame(data) {
    const payload = Buffer.from(data, 'utf8');
    const length = payload.length;
    let frame;

    if (length < 126) {
        frame = Buffer.allocUnsafe(2 + length);
        frame[0] = 0x81;
        frame[1] = length;
        payload.copy(frame, 2);
    } else if (length < 65536) {
        frame = Buffer.allocUnsafe(4 + length);
        frame[0] = 0x81;
        frame[1] = 126;
        frame.writeUInt16BE(length, 2);
        payload.copy(frame, 4);
    } else {
        frame = Buffer.allocUnsafe(10 + length);
        frame[0] = 0x81;
        frame[1] = 127;
        frame.writeBigUInt64BE(BigInt(length), 2);
        payload.copy(frame, 10);
    }

    return frame;
}

async function handleMessage(client, data) {
    if (data.type === 'join') {
        client.nickname = (data.nickname || '').trim() || 'Anonymous';
        console.log(`[${getTime()}] ${client.nickname} (${client.ip}) joined (Online: ${clients.size})`);
        
        try {
            const user = await db.findOrCreateUser(client.nickname, client.ip);
            client.userId = user.id;
            
            client.sessionId = await db.createSession(user.id, client.nickname, client.ip);
            await db.saveMessage(
                client.sessionId,
                'System',
                'system',
                `${client.nickname} joined the chat`,
                'system'
            );
        } catch (err) {
            console.error('保存用户信息失败:', err);
        }
        
        broadcast({
            type: 'system',
            message: `${client.nickname} joined the chat`,
            timestamp: getTime(),
            online_count: clients.size
        });
        
        try {
            const history = await db.getRecentMessages(20);
            const historyFrame = createFrame(JSON.stringify({
                type: 'history',
                messages: history
            }));
            client.socket.write(historyFrame);
        } catch (err) {
            console.error('获取历史消息失败:', err);
        }
        
        broadcastUserList();
        
    } else if (data.type === 'message') {
        const content = (data.message || '').trim();
        if (content) {
            console.log(`[${getTime()}] ${client.nickname}: ${content}`);
            
            try {
                await db.saveMessage(
                    client.sessionId,
                    client.nickname,
                    client.ip,
                    content,
                    'user'
                );
                
                if (client.userId) {
                    await db.incrementUserMessages(client.userId);
                }
            } catch (err) {
                console.error('保存消息失败:', err);
            }
            
            broadcast({
                type: 'message',
                nickname: client.nickname,
                message: content,
                timestamp: getTime()
            });
        }
    } else if (data.type === 'heartbeat') {
        client.isAlive = true;
    } else if (data.type === 'disconnect') {
        console.log(`[${getTime()}] ${client.nickname} requested disconnect`);
        client.socket.end();
    } else if (data.type === 'get_stats') {
        try {
            const stats = await db.getStatistics();
            const topUsers = await db.getTopUsers(5);
            
            const statsFrame = createFrame(JSON.stringify({
                type: 'stats',
                data: { ...stats, topUsers }
            }));
            client.socket.write(statsFrame);
        } catch (err) {
            console.error('获取统计信息失败:', err);
        }
    }
}

function broadcast(data) {
    const frame = createFrame(JSON.stringify(data));
    for (const client of clients.values()) {
        if (client.socket.destroyed) {
            clients.delete(client.id);
            continue;
        }
        try {
            client.socket.write(frame);
        } catch {
            clients.delete(client.id);
        }
    }
}

function broadcastUserList() {
    const userList = Array.from(clients.values()).map(client => ({
        id: client.id,
        nickname: client.nickname,
        ip: client.ip,
        joinTime: client.joinTime.toISOString()
    }));
    
    broadcast({
        type: 'userlist',
        users: userList,
        count: clients.size
    });
}

function getTime() {
    return new Date().toTimeString().split(' ')[0];
}

// ========== 静态资源 ==========
function serveStaticFile(req, res, filePath) {
    const ext = path.extname(filePath);
    const contentType = mimeTypes[ext] || 'application/octet-stream';

    const resolvedPath = path.resolve(filePath);
    if (!resolvedPath.startsWith(ROOT_DIR)) {
        res.writeHead(403);
        return res.end('403 Forbidden');
    }

    fs.access(resolvedPath, fs.constants.F_OK, (err) => {
        if (err) {
            res.writeHead(404);
            return res.end('404 Not Found');
        }

        res.writeHead(200, { 'Content-Type': contentType });
        const stream = fs.createReadStream(resolvedPath);
        stream.pipe(res);
        stream.on('error', () => {
            res.writeHead(500);
            res.end('500 Internal Server Error');
        });
    });
}

// ========== HTTP API ==========
async function handleApiRequest(req, res) {
    const url = req.url;
    
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Content-Type', 'application/json');
    
    try {
        if (url === '/api/stats') {
            const stats = await db.getStatistics();
            const topUsers = await db.getTopUsers(10);
            res.writeHead(200);
            res.end(JSON.stringify({ success: true, data: { ...stats, topUsers } }));
            
        } else if (url.startsWith('/api/messages?')) {
            const params = new URLSearchParams(url.split('?')[1]);
            const limit = parseInt(params.get('limit')) || 50;
            const messages = await db.getRecentMessages(limit);
            res.writeHead(200);
            res.end(JSON.stringify({ success: true, data: messages }));
            
        } else if (url.startsWith('/api/search?')) {
            const params = new URLSearchParams(url.split('?')[1]);
            const keyword = params.get('keyword') || '';
            const messages = await db.searchMessages(keyword);
            res.writeHead(200);
            res.end(JSON.stringify({ success: true, data: messages }));
            
        } else {
            res.writeHead(404);
            res.end(JSON.stringify({ success: false, error: 'API endpoint not found' }));
        }
    } catch (err) {
        console.error('API Error:', err);
        res.writeHead(500);
        res.end(JSON.stringify({ success: false, error: err.message }));
    }
}

// ========== HTTP ==========
const server = http.createServer((req, res) => {
    // API 路由
    if (req.url.startsWith('/api/')) {
        handleApiRequest(req, res);
        return;
    }
    
    // 静态文件
    const reqPath = decodeURI(req.url.split('?')[0]);
    let filePath = path.join(ROOT_DIR, reqPath);
    if (reqPath === '/' || reqPath === '') filePath = path.join(ROOT_DIR, 'chat.html');
    serveStaticFile(req, res, filePath);
});

server.on('upgrade', handleWebSocketUpgrade);

const PORT = 9090;
const HOST = '0.0.0.0';

server.listen(PORT, HOST, () => {
    console.log('='.repeat(50));
    console.log('Enhanced WebSocket Chat Server with Database');
    console.log('='.repeat(50));
    console.log(`HTTP Server: http://${HOST}:${PORT}`);
    console.log(`WebSocket:  ws://${HOST}:${PORT}`);
    console.log('='.repeat(50));
    console.log('API Endpoints:');
    console.log(`  - GET /api/stats`);
    console.log(`  - GET /api/messages?limit=50`);
    console.log(`  - GET /api/search?keyword=xxx`);
    console.log('='.repeat(50));
    console.log('Waiting for connections...\n');
});

process.on('SIGINT', async () => {
    console.log('\n\nShutting down server...');
    
    for (const client of clients.values()) {
        if (client.sessionId) {
            await db.endSession(client.sessionId).catch(console.error);
        }
        client.socket.end();
    }
    
    await db.close();
    
    server.close();
    console.log('Server closed');
    process.exit(0);
});