<template>
  <div class="flex flex-col items-center justify-center h-full px-8">
    <!-- Logo / Brand -->
    <div class="mb-10 text-center">
      <div class="w-16 h-16 mx-auto mb-4 rounded-2xl bg-gradient-to-br from-accent-500 to-accent-700 flex items-center justify-center shadow-lg shadow-accent-500/25">
        <svg class="w-8 h-8 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2">
          <path stroke-linecap="round" stroke-linejoin="round" d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z" />
        </svg>
      </div>
      <h1 class="text-2xl font-bold text-gray-800 tracking-tight">Live Chat</h1>
      <p class="mt-1 text-sm text-gray-500">Enter your name to start chatting</p>
    </div>

    <!-- Form -->
    <div class="w-full max-w-sm space-y-4">
      <div v-if="error" class="px-4 py-3 text-sm text-red-600 bg-red-50 border border-red-100 rounded-xl">
        {{ error }}
      </div>

      <div>
        <label class="block mb-1.5 text-xs font-semibold text-gray-500 uppercase tracking-wider">
          Nickname
        </label>
        <input
          v-model="nickname"
          type="text"
          placeholder="Your display name"
          maxlength="20"
          class="w-full px-4 py-3 text-sm bg-gray-50 border border-gray-200 rounded-xl
                 placeholder:text-gray-400 transition-all duration-200
                 focus:bg-white focus:border-accent-500 focus:ring-4 focus:ring-accent-500/10"
          @keypress.enter="handleJoin"
        />
      </div>

      <div>
        <label class="block mb-1.5 text-xs font-semibold text-gray-500 uppercase tracking-wider">
          Server
        </label>
        <input
          v-model="serverUrl"
          type="text"
          placeholder="ws://localhost:9090"
          class="w-full px-4 py-3 text-sm bg-gray-50 border border-gray-200 rounded-xl
                 placeholder:text-gray-400 font-mono transition-all duration-200
                 focus:bg-white focus:border-accent-500 focus:ring-4 focus:ring-accent-500/10"
          @keypress.enter="handleJoin"
        />
      </div>

      <button
        class="w-full py-3.5 mt-2 text-sm font-semibold text-white
               bg-gradient-to-r from-accent-600 to-accent-500 rounded-xl
               shadow-lg shadow-accent-500/25
               hover:shadow-xl hover:shadow-accent-500/30 hover:-translate-y-0.5
               active:translate-y-0 transition-all duration-200
               disabled:opacity-50 disabled:cursor-not-allowed disabled:hover:translate-y-0"
        :disabled="connecting"
        @click="handleJoin"
      >
        <span v-if="connecting" class="inline-flex items-center gap-2">
          <span class="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin"></span>
          Connecting...
        </span>
        <span v-else>Join Chat</span>
      </button>
    </div>
  </div>
</template>

<script setup>
import { ref } from 'vue'

const emit = defineEmits(['join'])

const nickname = ref('Anonymous')
const serverUrl = ref('ws://localhost:9090')
const connecting = ref(false)
const error = ref('')

function handleJoin() {
  error.value = ''
  const url = serverUrl.value.trim()
  if (!url.startsWith('ws://') && !url.startsWith('wss://')) {
    error.value = 'Server address must start with ws:// or wss://'
    return
  }
  connecting.value = true
  emit('join', {
    nickname: nickname.value.trim() || 'Anonymous',
    serverUrl: url,
  })
}

function setConnecting(val) { connecting.value = val }
function setError(msg) { error.value = msg; connecting.value = false }
defineExpose({ setConnecting, setError })
</script>
