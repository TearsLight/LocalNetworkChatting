# LocalNetworkChatting

A real-time LAN chat application built with WebSocket, SQLite, and Vue 3.

## Tech Stack

| Layer | Technology |
|-------|-----------|
| Frontend | Vue 3 + Vite + Tailwind CSS |
| Backend | Node.js (raw HTTP + WebSocket) |
| Database | SQLite (better-sqlite3) |
| Communication | WebSocket |

## Features

- Multi-user real-time chat over LAN
- Message history with persistent storage
- Online user list with live updates
- Heartbeat keep-alive with auto-reconnect
- Glassmorphism modern UI
- SPA routing (Vue Router)

## Prerequisites

- Node.js v18+
- npm

## Getting Started

```bash
# Install backend dependencies
npm install

# Install frontend dependencies
cd client && npm install && cd ..

# Build the frontend
npm run build:client

# Start the server
npm start
```

Open `http://localhost:9090` in your browser.

## Development

Run backend and frontend dev servers in separate terminals:

```bash
# Terminal 1: Backend (port 9090)
npm run dev

# Terminal 2: Frontend (port 5173, proxies API to backend)
npm run dev:client
```

Open `http://localhost:5173` — Vite HMR will hot-reload changes.

## Scripts

| Command | Description |
|---------|-------------|
| `npm start` | Start production server |
| `npm run dev` | Start backend with nodemon |
| `npm run dev:client` | Start Vite dev server |
| `npm run build:client` | Build frontend for production |
| `npm run stats` | Show database statistics |
| `npm run export` | Export chat data |
| `npm run clean-old` | Clean old messages |

## Project Structure

```
├── server.js              # HTTP + WebSocket server
├── database.js            # SQLite database layer
├── package.json           # Root scripts & backend deps
├── assets/                # Static assets (images, favicon)
├── scripts/               # Utility scripts (cleanup, stats, export)
└── client/                # Vue 3 frontend
    ├── index.html
    ├── package.json
    ├── vite.config.js
    ├── tailwind.config.js
    └── src/
        ├── main.js
        ├── App.vue
        ├── style.css
        ├── router/index.js
        ├── views/
        │   └── ChatView.vue
        ├── components/
        │   ├── LoginScreen.vue
        │   ├── ChatHeader.vue
        │   ├── MessageList.vue
        │   ├── MessageInput.vue
        │   └── UserListPanel.vue
        └── composables/
            └── useWebSocket.js
```

## API Endpoints

| Method | Path | Description |
|--------|------|-------------|
| GET | `/api/stats` | User & message statistics |
| GET | `/api/messages?limit=50` | Recent messages |
| GET | `/api/search?keyword=xxx` | Search messages |

## Database

SQLite with WAL mode. Tables:

- `users` — User profiles & message counts
- `sessions` — Connection sessions with duration
- `messages` — Chat messages (user & system)
- `system_logs` — Connection/disconnection events

## License

MIT
