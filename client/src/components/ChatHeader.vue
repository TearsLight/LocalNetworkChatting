<template>
  <div class="flex items-center justify-between px-5 py-4 bg-gradient-to-r from-accent-700 to-accent-500 rounded-t-xl select-none">
    <!-- Left: Title -->
    <div class="flex items-center gap-3">
      <div class="w-8 h-8 rounded-lg bg-white/20 flex items-center justify-center">
        <svg class="w-4 h-4 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2">
          <path stroke-linecap="round" stroke-linejoin="round" d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z" />
        </svg>
      </div>
      <span class="text-base font-semibold text-white tracking-tight">Live Chat</span>
    </div>

    <!-- Right: Status & Actions -->
    <div class="flex items-center gap-2">
      <!-- Online count -->
      <span class="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-white/80 bg-white/10 rounded-full">
        <span class="w-1.5 h-1.5 rounded-full bg-green-400"></span>
        {{ onlineCount }} online
      </span>

      <!-- Connection status -->
      <span
        class="px-3 py-1.5 text-xs font-medium rounded-full transition-colors duration-300"
        :class="statusClass"
      >
        {{ connectionStatus }}
      </span>

      <!-- Users toggle -->
      <button
        class="px-3 py-1.5 text-xs font-medium text-white/80 bg-white/10 rounded-full
               hover:bg-white/20 transition-colors"
        @click="$emit('toggle-userlist')"
      >
        Users
      </button>

      <!-- Disconnect -->
      <button
        class="px-3 py-1.5 text-xs font-medium text-white bg-red-500/80 rounded-full
               hover:bg-red-500 transition-colors"
        @click="$emit('disconnect')"
      >
        Leave
      </button>
    </div>
  </div>
</template>

<script setup>
import { computed } from 'vue'

const props = defineProps({
  onlineCount: { type: Number, default: 0 },
  connectionStatus: { type: String, default: 'Disconnected' },
})

defineEmits(['disconnect', 'toggle-userlist'])

const statusClass = computed(() => {
  switch (props.connectionStatus) {
    case 'Connected': return 'bg-green-500/80 text-white'
    case 'Disconnected':
    case 'Connection failed':
      return 'bg-red-500/80 text-white'
    default: return 'bg-white/10 text-white/70'
  }
})
</script>
