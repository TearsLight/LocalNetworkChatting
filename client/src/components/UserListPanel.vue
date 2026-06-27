<template>
  <Transition name="panel">
    <div
      v-if="show"
      class="absolute top-[72px] right-4 w-72 max-h-[75vh] z-50
             glass rounded-2xl shadow-2xl overflow-hidden"
    >
      <!-- Header -->
      <div class="flex items-center justify-between px-4 py-3 border-b border-gray-100/50">
        <span class="text-sm font-semibold text-gray-700">Online Users</span>
        <span class="text-xs text-gray-400 font-medium bg-gray-100 px-2 py-0.5 rounded-full">
          {{ users.length }}
        </span>
      </div>

      <!-- List -->
      <div class="overflow-y-auto max-h-[calc(75vh-52px)] p-2">
        <div v-if="users.length === 0" class="py-8 text-center text-sm text-gray-400">
          No users online
        </div>
        <div
          v-for="user in users"
          :key="user.id"
          class="flex items-center gap-3 px-3 py-2.5 rounded-xl hover:bg-gray-50 transition-colors"
        >
          <div class="w-8 h-8 rounded-full bg-gradient-to-br from-accent-400 to-accent-600 flex items-center justify-center text-white text-xs font-semibold flex-shrink-0">
            {{ user.nickname.charAt(0).toUpperCase() }}
          </div>
          <div class="flex-1 min-w-0">
            <div class="text-sm font-medium text-gray-700 truncate">
              {{ user.nickname }}
            </div>
            <div class="text-[11px] text-gray-400">{{ formatTime(user.joinTime) }}</div>
          </div>
          <span class="text-[10px] text-gray-300 font-mono">#{{ user.id }}</span>
        </div>
      </div>
    </div>
  </Transition>
</template>

<script setup>
defineProps({
  users: { type: Array, default: () => [] },
  show: { type: Boolean, default: false },
})

function formatTime(isoStr) {
  try { return new Date(isoStr).toLocaleTimeString('zh-CN') } catch { return '' }
}
</script>

<style scoped>
.panel-enter-active,
.panel-leave-active {
  transition: all 0.25s ease;
}
.panel-enter-from,
.panel-leave-to {
  opacity: 0;
  transform: translateY(-8px) scale(0.96);
}
</style>
