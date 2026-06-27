<template>
  <div ref="containerRef" class="flex-1 overflow-y-auto px-5 py-4 space-y-3 bg-gray-50/80">
    <!-- Empty state -->
    <div v-if="messages.length === 0" class="flex flex-col items-center justify-center h-full text-gray-400">
      <svg class="w-12 h-12 mb-3 opacity-30" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="1.5">
        <path stroke-linecap="round" stroke-linejoin="round" d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z" />
      </svg>
      <p class="text-sm">No messages yet. Say hello!</p>
    </div>

    <!-- Messages -->
    <div
      v-for="(msg, idx) in messages"
      :key="idx"
      class="msg-enter"
    >
      <!-- System message -->
      <div v-if="msg.type === 'system'" class="flex justify-center">
        <span class="px-3 py-1 text-xs text-gray-500 bg-gray-200/60 rounded-full">
          {{ msg.text }}
        </span>
      </div>

      <!-- User message -->
      <div v-else class="flex gap-3">
        <!-- Avatar -->
        <div class="flex-shrink-0 w-8 h-8 rounded-full bg-gradient-to-br from-accent-400 to-accent-600 flex items-center justify-center text-white text-xs font-semibold shadow-sm">
          {{ msg.nickname.charAt(0).toUpperCase() }}
        </div>
        <!-- Bubble -->
        <div class="flex-1 min-w-0">
          <div class="flex items-baseline gap-2 mb-0.5">
            <span class="text-sm font-semibold text-gray-700">{{ msg.nickname }}</span>
            <span class="text-[11px] text-gray-400">{{ msg.time }}</span>
          </div>
          <div class="inline-block max-w-full px-3.5 py-2 text-sm text-gray-700 bg-white rounded-2xl rounded-tl-sm shadow-sm border border-gray-100">
            {{ msg.text }}
          </div>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup>
import { ref, watch, nextTick } from 'vue'

const props = defineProps({
  messages: { type: Array, default: () => [] },
})

const containerRef = ref(null)

watch(
  () => props.messages.length,
  () => {
    nextTick(() => {
      if (containerRef.value) {
        containerRef.value.scrollTop = containerRef.value.scrollHeight
      }
    })
  },
)
</script>
