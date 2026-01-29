import { defineStore } from 'pinia';
import { ref, computed } from 'vue';
import { ProjectManifestManager } from '../editor/managers/ProjectManifestManager';
import { eventBus } from '../engine/core/EventBus';

export const useProjectStore = defineStore('project', () => {
    
    // State
    const manifest = ref(ProjectManifestManager.manifest);
    const lastSync = ref(Date.now()); // Used to trigger reactivity manually if needed

    // Computed
    const scenes = computed(() => {
        lastSync.value; // Dependency to force re-evaluation on sync()
        return manifest.value?.scenes || [];
    });
    const projectName = computed(() => manifest.value?.name || 'Untitled');
    // const projectPath = computed(() => ''); // Removed unused

    // Actions
    
    /**
     * Force refresh from the singleton manager.
     * Call this after loading a project or saving.
     */
    function sync() {
        manifest.value = ProjectManifestManager.manifest;
        lastSync.value = Date.now();
        eventBus.emit('scene-list-changed');
    }

    async function addScene(name: string, path: string) {
        ProjectManifestManager.addScene(name, path);
        // Save immediately to disk to persist the change? 
        // Or wait for explict save? GDevelop saves usually immediately on structure change.
        // For now, let's keep it in memory mostly, but syncing is key.
        sync();
    }

    async function removeScene(path: string) {
        ProjectManifestManager.removeScene(path);
        sync();
    }

    async function renameScene(oldPath: string, newName: string, newPath: string) {
        ProjectManifestManager.renameScene(oldPath, newName, newPath);
        sync();
    }

    return {
        manifest,
        scenes,
        projectName,
        sync,
        addScene,
        removeScene,
        renameScene
    };
});
