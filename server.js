const http = require('http');
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');


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

// ========== WebSocket 升级 ==========
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
    const client = {
        id: clientId,
        socket,
        nickname: 'Anonymous',
        isAlive: true
    };

    clients.set(clientId, client);
    console.log(`[${getTime()}] Client ${clientId} connected (Online: ${clients.size})`);

    let buffer = Buffer.alloc(0);

    socket.on('data', (data) => {
        buffer = Buffer.concat([buffer, data]);
        while (buffer.length > 0) {
            const frame = parseFrame(buffer);
            if (!frame) break;
            buffer = buffer.slice(frame.length);

            if (frame.opcode === 0x8) {
                socket.end();
                return;
            }

            if (frame.opcode === 0x9) {
                socket.write(Buffer.from([0x8A, 0x00]));
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

function removeClient(client) {
    if (!clients.has(client.id)) return;
    const nickname = client.nickname;
    clients.delete(client.id);
    console.log(`[${getTime()}] ${nickname} disconnected (Online: ${clients.size})`);
    broadcast({
        type: 'system',
        message: `${nickname} left the chat`,
        timestamp: getTime(),
        online_count: clients.size
    });
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

function handleMessage(client, data) {
    if (data.type === 'join') {
        client.nickname = (data.nickname || '').trim() || 'Anonymous';
        console.log(`[${getTime()}] ${client.nickname} joined (Online: ${clients.size})`);
        broadcast({
            type: 'system',
            message: `${client.nickname} joined the chat`,
            timestamp: getTime(),
            online_count: clients.size
        });
    } else if (data.type === 'message') {
        const content = (data.message || '').trim();
        if (content) {
            console.log(`[${getTime()}] ${client.nickname}: ${content}`);
            broadcast({
                type: 'message',
                nickname: client.nickname,
                message: content,
                timestamp: getTime()
            });
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

// ========== HTTP ==========
const server = http.createServer((req, res) => {
    const reqPath = decodeURI(req.url.split('?')[0]);
    let filePath = path.join(ROOT_DIR, reqPath);
    if (reqPath === '/' || reqPath === '') filePath = path.join(ROOT_DIR, 'chat.html');
    serveStaticFile(req, res, filePath);
});

server.on('upgrade', handleWebSocketUpgrade);

// 心跳检测（每 30 秒检查一次）
setInterval(() => {
    for (const client of clients.values()) {
        if (!client.isAlive) {
            console.log(`[${getTime()}] Client ${client.id} timeout`);
            client.socket.end();
            clients.delete(client.id);
        } else {
            client.isAlive = false;
            try {
                client.socket.write(Buffer.from([0x89, 0x00])); // ping
            } catch {}
        }
    }
}, 30000);

const PORT = 9090;
const HOST = '0.0.0.0';

server.listen(PORT, HOST, () => {
    console.log('='.repeat(50));
    console.log('Enhanced WebSocket Chat Server Started');
    console.log('='.repeat(50));
    console.log(`HTTP Server: http://${HOST}:${PORT}`);
    console.log(`WebSocket:  ws://${HOST}:${PORT}`);
    console.log('='.repeat(50));
    console.log('Static assets available at:');
    console.log(`  - /chat.html`);
    console.log(`  - /css/style.css`);
    console.log(`  - /js/script.js`);
    console.log(`  - /assets/backgroundVideo.mp4`);
    console.log('='.repeat(50));
    console.log('Waiting for connections...\n');
});

process.on('SIGINT', () => {
    console.log('\n\nShutting down server...');
    server.close();
    console.log('Server closed');
    process.exit(0);
});
