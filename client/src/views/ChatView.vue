<template>
  <!-- Background -->
  <img :src="'/assets/background.png'" class="bg-overlay" alt="" />

  <div class="relative z-10 flex items-center justify-center min-h-screen p-5">
    <div class="glass rounded-2xl shadow-2xl w-[95vw] h-[90vh] max-w-[1200px] flex flex-col overflow-hidden transition-shadow duration-500 hover:shadow-[0_25px_60px_rgba(0,0,0,0.15)]">
      <!-- Login Screen -->
      <LoginScreen
        v-if="!isConnected"
        ref="loginRef"
        @join="onJoin"
      />

      <!-- Chat Screen -->
      <template v-else>
        <ChatHeader
          :online-count="onlineCount"
          :connection-status="connectionStatus"
          @disconnect="onDisconnect"
          @toggle-userlist="showUserList = !showUserList"
        />
        <MessageList :messages="messages" />
        <MessageInput :disabled="!isConnected" @send="sendMessage" />
        <UserListPanel :users="userList" :show="showUserList" />
      </template>
    </div>
  </div>
</template>

<script setup>
import { ref } from 'vue'
import { useWebSocket } from '@/composables/useWebSocket'
import LoginScreen from '@/components/LoginScreen.vue'
import ChatHeader from '@/components/ChatHeader.vue'
import MessageList from '@/components/MessageList.vue'
import MessageInput from '@/components/MessageInput.vue'
import UserListPanel from '@/components/UserListPanel.vue'

const loginRef = ref(null)
const showUserList = ref(false)

const nickname = ref('Anonymous')
const {
  messages,
  onlineCount,
  userList,
  connectionStatus,
  isConnected,
  connect,
  sendMessage,
  disconnect,
} = useWebSocket(nickname)

function onJoin({ nickname: nick, serverUrl }) {
  nickname.value = nick
  connect(serverUrl)
}

function onDisconnect() {
  disconnect()
  showUserList.value = false
}
</script>
