<template>
  <div class="console-panel w-full h-full bg-bg-base text-text-primary p-2 font-mono text-xs overflow-y-auto">
    <div v-for="(log, index) in logs" :key="index" :class="log.type" class="mb-1 border-b border-border pb-1">
      <span class="text-text-secondary">[{{ log.time }}]</span>
      <span :class="getTypeColor(log.type)" class="ml-2">{{ log.message }}</span>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref } from 'vue';

const logs = ref([
  { time: '12:00:00', type: 'info', message: 'Engine initialized.' },
  { time: '12:00:01', type: 'warn', message: 'Asset not found: demo.png' },
  { time: '12:00:02', type: 'error', message: 'Failed to connect to server.' }
]);

const getTypeColor = (type: string) => {
  switch (type) {
    case 'info': return 'text-blue-400';
    case 'warn': return 'text-yellow-400';
    case 'error': return 'text-red-400';
    default: return 'text-text-primary';
  }
};
</script>
