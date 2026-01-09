<script setup lang="ts">
import { onMounted } from 'vue';
import DockLayout from './editor/layouts/DockLayout.vue';
import ProjectWizard from './editor/components/ProjectWizard.vue';
import AppHeader from './editor/components/AppHeader.vue';
import GlobalOverlay from './editor/components/overlays/GlobalOverlay.vue';
import { projectState } from './editor/managers/ProjectManager';

onMounted(() => {
  console.log('UliKit2D Editor Mounted');
});
</script>

<template>
  <div class="app-container">
    <div class="title-bar" v-if="projectState.currentProjectPath">
        <AppHeader />
    </div>
    
    <div class="editor-content">
      <ProjectWizard v-if="!projectState.currentProjectPath" />
      <DockLayout v-else />
    </div>

    <!-- UI Overlay (Modals & Toasts) -->
    <GlobalOverlay />
  </div>
</template>

<style scoped>
.app-container {
  display: flex;
  flex-direction: column;
  height: 100vh;
  width: 100vw;
  background-color: var(--bg-base);
  color: var(--text-primary);
}

.title-bar {
  height: 30px;
  background-color: var(--bg-header);
  display: flex;
  align-items: center;
  padding: 0 10px;
  font-size: 12px;
  border-bottom: 1px solid var(--border-color);
  -webkit-app-region: drag; /* Electron drag */
}

.editor-content {
  flex: 1;
  position: relative;
  overflow: hidden;
}

.placeholder {
  display: flex;
  justify-content: center;
  align-items: center;
  height: 100%;
  color: #666;
}
</style>
