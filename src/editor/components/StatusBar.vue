<template>
  <div class="h-6 bg-bg-header border-t border-border flex items-center px-4 text-xs select-none text-text-primary justify-between">
    <!-- Left: Project Info -->
    <div class="flex items-center gap-4">
      <div v-if="projectState.currentProjectPath" class="flex items-center gap-2">
         <span class="text-blue-400 font-semibold">{{ projectState.projectName }}</span>
         <span class="text-gray-600">|</span>
         <span class="opacity-75 truncate max-w-[300px]" :title="displayPath">{{ displayPath }}</span>
      </div>
      <div v-else class="text-gray-500 italic">No Project Open</div>
    </div>

    <!-- Center: Status Messages (Placeholder for now) -->
    <div class="flex-1 flex justify-center">
        <span>Ready</span>
    </div>

    <!-- Right: Editor Info -->
    <div class="flex items-center gap-4">
      <button @click="resetLayout" class="hover:text-accent-color transition-colors" title="Reset UI Layout">
          Reset Layout
      </button>
      <span class="text-border">|</span>
      <span>UTF-8</span>
      <span>TypeScript</span>
      <span class="text-blue-400">Ver 0.0.1</span>
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed } from 'vue';
import { projectState } from '../managers/ProjectManager';
import { useLayoutStore } from '../../stores/useLayoutStore';

const resetLayout = () => {
    if (confirm('Reset editor layout to default? This will reload the editor.')) {
        useLayoutStore().resetLayout();
    }
};

const displayPath = computed(() => {
    const p = projectState.currentProjectPath;
    if (!p) return '';
    return typeof p === 'string' ? p : p.name;
});
</script>

<style scoped>
/* Ensure consistent height and no wrapping */
div {
    white-space: nowrap;
}
</style>
