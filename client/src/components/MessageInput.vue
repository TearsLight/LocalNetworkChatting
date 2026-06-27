<template>
  <div class="flex items-center gap-3 px-5 py-4 bg-white border-t border-gray-100 rounded-b-xl">
    <input
      v-model="text"
      type="text"
      placeholder="Type a message..."
      maxlength="500"
      class="flex-1 px-4 py-2.5 text-sm bg-gray-100 border-0 rounded-xl
             placeholder:text-gray-400 transition-all duration-200
             focus:bg-gray-50 focus:ring-4 focus:ring-accent-500/10"
      @keypress.enter="send"
    />
    <button
      class="flex-shrink-0 px-5 py-2.5 text-sm font-semibold text-white
             bg-gradient-to-r from-accent-600 to-accent-500 rounded-xl
             shadow-md shadow-accent-500/20
             hover:shadow-lg hover:shadow-accent-500/25 hover:-translate-y-0.5
             active:translate-y-0 transition-all duration-200
             disabled:opacity-40 disabled:cursor-not-allowed disabled:hover:translate-y-0"
      :disabled="!canSend"
      @click="send"
    >
      <span class="flex items-center gap-1.5">
        Send
        <svg class="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2.5">
          <path stroke-linecap="round" stroke-linejoin="round" d="M5 12h14M12 5l7 7-7 7" />
        </svg>
      </span>
    </button>
  </div>
</template>

<script setup>
import { ref, computed } from 'vue'

const emit = defineEmits(['send'])
const props = defineProps({
  disabled: { type: Boolean, default: false },
})

const text = ref('')
const canSend = computed(() => text.value.trim().length > 0 && !props.disabled)

function send() {
  if (!canSend.value) return
  emit('send', text.value.trim())
  text.value = ''
}
</script>
