import { ref, onUnmounted } from 'vue'

const HEARTBEAT_INTERVAL = 25000
const MAX_RECONNECT_ATTEMPTS = 5

/**
 * WebSocket composable for chat communication.
 *
 * @param {import('vue').Ref<string>} nickname
 * @returns {{
 *   ws: import('vue').Ref<WebSocket | null>,
 *   messages: import('vue').Ref<Array>,
 *   onlineCount: import('vue').Ref<number>,
 *   userList: import('vue').Ref<Array>,
 *   connectionStatus: import('vue').Ref<string>,
 *   isConnected: import('vue').ComputedRef<boolean>,
 *   connect: (url: string) => void,
 *   sendMessage: (text: string) => void,
 *   disconnect: () => void,
 *   requestStats: () => void,
 * }}
 */
export function useWebSocket(nickname) {
  const ws = ref(null)
  const messages = ref([])
  const onlineCount = ref(0)
  const userList = ref([])
  const connectionStatus = ref('Disconnected')
  const isConnected = ref(false)

  let heartbeatTimer = null
  let reconnectAttempts = 0

  function startHeartbeat() {
    stopHeartbeat()
    heartbeatTimer = setInterval(() => {
      if (ws.value?.readyState === WebSocket.OPEN) {
        ws.value.send(JSON.stringify({ type: 'heartbeat' }))
      }
    }, HEARTBEAT_INTERVAL)
  }

  function stopHeartbeat() {
    if (heartbeatTimer) {
      clearInterval(heartbeatTimer)
      heartbeatTimer = null
    }
  }

  function attemptReconnect(serverUrl) {
    if (reconnectAttempts >= MAX_RECONNECT_ATTEMPTS) {
      messages.value.push({
        type: 'system',
        text: `Reconnect failed after ${MAX_RECONNECT_ATTEMPTS} attempts`,
        time: getTime(),
      })
      return
    }
    reconnectAttempts++
    const delay = Math.min(1000 * Math.pow(2, reconnectAttempts), 30000)
    messages.value.push({
      type: 'system',
      text: `Reconnecting in ${delay / 1000}s (${reconnectAttempts}/${MAX_RECONNECT_ATTEMPTS})...`,
      time: getTime(),
    })
    setTimeout(() => {
      if (!ws.value || ws.value.readyState === WebSocket.CLOSED) {
        connectSocket(serverUrl)
      }
    }, delay)
  }

  function connectSocket(serverUrl) {
    try {
      ws.value = new WebSocket(serverUrl)

      ws.value.onopen = () => {
        connectionStatus.value = 'Connected'
        isConnected.value = true
        reconnectAttempts = 0

        ws.value.send(JSON.stringify({
          type: 'join',
          nickname: nickname.value,
        }))
        startHeartbeat()
      }

      ws.value.onmessage = (event) => {
        try {
          const data = JSON.parse(event.data)
          handleMessage(data)
        } catch (e) {
          console.error('Failed to parse message:', e)
        }
      }

      ws.value.onerror = () => {
        connectionStatus.value = 'Connection failed'
        isConnected.value = false
        stopHeartbeat()
      }

      ws.value.onclose = () => {
        connectionStatus.value = 'Disconnected'
        isConnected.value = false
        stopHeartbeat()
        messages.value.push({
          type: 'system',
          text: 'Connection lost',
          time: getTime(),
        })
        attemptReconnect(serverUrl)
      }
    } catch (err) {
      console.error('WebSocket connection error:', err)
      stopHeartbeat()
    }
  }

  function handleMessage(data) {
    switch (data.type) {
      case 'system':
        messages.value.push({
          type: 'system',
          text: data.message,
          time: data.timestamp || getTime(),
        })
        if (data.online_count !== undefined) {
          onlineCount.value = data.online_count
        }
        break

      case 'message':
        messages.value.push({
          type: 'user',
          nickname: data.nickname,
          text: data.message,
          time: data.timestamp || getTime(),
        })
        break

      case 'userlist':
        userList.value = data.users || []
        if (data.count !== undefined) {
          onlineCount.value = data.count
        }
        break

      case 'history':
        messages.value.push({
          type: 'system',
          text: 'Loading history...',
          time: getTime(),
        })
        for (const msg of data.messages || []) {
          if (msg.message_type === 'system') {
            messages.value.push({
              type: 'system',
              text: msg.message,
              time: msg.time,
            })
          } else {
            messages.value.push({
              type: 'user',
              nickname: msg.nickname,
              text: msg.message,
              time: msg.time,
            })
          }
        }
        messages.value.push({
          type: 'system',
          text: 'History loaded',
          time: getTime(),
        })
        break

      case 'stats':
        console.log('Stats:', data.data)
        break

      default:
        break
    }
  }

  function connect(url) {
    disconnect()
    connectSocket(url)
  }

  function sendMessage(text) {
    if (text && ws.value?.readyState === WebSocket.OPEN) {
      ws.value.send(JSON.stringify({
        type: 'message',
        message: text,
      }))
    }
  }

  function requestStats() {
    if (ws.value?.readyState === WebSocket.OPEN) {
      ws.value.send(JSON.stringify({ type: 'get_stats' }))
    }
  }

  function disconnect() {
    stopHeartbeat()
    if (ws.value) {
      if (ws.value.readyState === WebSocket.OPEN) {
        ws.value.send(JSON.stringify({ type: 'disconnect' }))
      }
      ws.value.close()
      ws.value = null
    }
    messages.value = []
    isConnected.value = false
    connectionStatus.value = 'Disconnected'
    onlineCount.value = 0
    userList.value = []
  }

  onUnmounted(() => {
    disconnect()
  })

  return {
    ws,
    messages,
    onlineCount,
    userList,
    connectionStatus,
    isConnected,
    connect,
    sendMessage,
    requestStats,
    disconnect,
  }
}

function getTime() {
  return new Date().toTimeString().split(' ')[0]
}
