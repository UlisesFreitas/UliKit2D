<script setup lang="ts">
import { ref, onMounted, nextTick } from 'vue';
import { getFileSystem } from '../../api/FileSystem';
import { SceneManager } from '../../engine/managers/SceneManager';
import { ProjectManager } from '../managers/ProjectManager';
import { useUIStore } from '../../stores/useUIStore';

const fs = getFileSystem();
const ui = useUIStore();

interface SceneFile {
    name: string;
    path: string;
}

const scenes = ref<SceneFile[]>([]);
const isLoading = ref(false);
const isCreating = ref(false);
const newSceneName = ref('');
const inputRef = ref<HTMLInputElement | null>(null);

// Context Menu State
const menuState = ref({
    visible: false,
    x: 0,
    y: 0,
    scene: null as SceneFile | null
});

const loadScenes = async () => {
    isLoading.value = true;
    scenes.value = [];
    
    try {
        const files = await fs.readdir('assets/scenes');
        scenes.value = files
            .filter(f => f.name.endsWith('.json'))
            .map(f => ({
                name: f.name.replace('.json', ''),
                path: f.path
            }));
    } catch (e: any) {
        if (e.message && e.message.includes('ENOENT')) {
             console.warn('Scenes directory not found, will be created on save.');
        } else {
            console.error('Failed to list scenes:', e);
            ui.showToast({ title: 'Error', description: 'Failed to list scenes.', type: 'error' });
        }
    } finally {
        isLoading.value = false;
    }
};

const onOpenScene = async (scene: SceneFile) => {
    if (await ui.confirm({ title: 'Load Scene', message: `Load scene "${scene.name}"? Unsaved changes will be lost.` })) {
        const success = await SceneManager.loadSceneFromFile(scene.path);
        if (success) {
            console.log('Scene loaded:', scene.name);
            ui.showToast({ title: 'Scene Loaded', description: `Loaded ${scene.name}`, type: 'success' });
        }
    }
};

const showContextMenu = (e: MouseEvent, scene: SceneFile) => {
    menuState.value = {
        visible: true,
        x: e.clientX,
        y: e.clientY,
        scene: scene
    };
    
    // Close menu on next click
    setTimeout(() => {
        const close = () => {
            menuState.value.visible = false;
            window.removeEventListener('click', close);
        };
        window.addEventListener('click', close);
    }, 0);
};

const onDeleteScene = async () => {
    const scene = menuState.value.scene;
    if (!scene) return;
    
    if (await ui.confirm({ 
        title: 'Delete Scene', 
        message: `Are you sure you want to delete "${scene.name}"? This cannot be undone.`,
        confirmText: 'Delete',
        isDanger: true
    })) {
        console.log('[ScenesPanel] Context Menu Deleting:', scene.path);
        try {
            const success = await fs.deleteFile(scene.path);
            console.log('[ScenesPanel] Context Delete result:', success);
            if (success) {
                console.log('Scene deleted:', scene.name);
                scenes.value = scenes.value.filter(s => s.path !== scene.path);
                ui.showToast({ title: 'Deleted', description: `Scene ${scene.name} deleted.`, type: 'success' });
                
                // If we deleted the ACTIVE scene, we must reset the world
                if (scene.name === SceneManager.activeSceneName) {
                    SceneManager.createDefaultScene(); // Clears world, adds new Camera
                    // We effectively switch to "Untitled Scene" state which is unsaved
                }

                await loadScenes();
            } else {
                ui.showToast({ title: 'Error', description: 'Failed to delete scene (fs returned false).', type: 'error' });
            }
        } catch (e: any) {
             console.error('[ScenesPanel] Context Delete error:', e);
             ui.showToast({ title: 'Error', description: 'Error deleting scene: ' + e.message, type: 'error' });
        }
    }
    menuState.value.visible = false;
};

const onDuplicateScene = async () => {
    const scene = menuState.value.scene;
    if (!scene) return;
    
    try {
        const content = await fs.readFile(scene.path);
        const newName = `${scene.name}_Copy`;
        const newPath = `assets/scenes/${newName}.json`;
        
        await fs.writeFile(newPath, content);
        ui.showToast({ title: 'Duplicated', description: `Scene duplicated as ${newName}`, type: 'success' });
        await loadScenes();
    } catch (e: any) {
        ui.showToast({ title: 'Error', description: 'Failed to duplicate scene: ' + e.message, type: 'error' });
    }
    menuState.value.visible = false;
};

// Also verify delete from 'X' button if we keep it
const onDeleteSceneDirect = async (scene: SceneFile) => {
    menuState.value.scene = scene; 
    // console.log('[ScenesPanel] Clicked delete for:', scene.path);
    if (await ui.confirm({ 
        title: 'Delete Scene', 
        message: `Delete "${scene.name}"?`,
        confirmText: 'Delete',
        isDanger: true
    })) {
        console.log('[ScenesPanel] Deleting scene:', scene.path);
        try {
            const success = await fs.deleteFile(scene.path);
            console.log('[ScenesPanel] Delete result:', success);
            if (success) {
                // Optimistic update
                scenes.value = scenes.value.filter(s => s.path !== scene.path);
                ui.showToast({ title: 'Deleted', description: `Scene ${scene.name} deleted.`, type: 'success' });

                if (scene.name === SceneManager.activeSceneName) {
                    SceneManager.createDefaultScene();
                }

                await loadScenes();
            }
            else ui.showToast({ title: 'Error', description: 'Failed to delete (fs returned false).', type: 'error' });
        } catch(e: any) {
            console.error('[ScenesPanel] Delete error:', e);
            ui.showToast({ title: 'Error', description: 'Error: ' + e.message, type: 'error' });
        }
    }
};

const startCreate = () => {
    isCreating.value = true;
    newSceneName.value = 'NewScene';
    nextTick(() => {
        inputRef.value?.focus();
        inputRef.value?.select();
    });
};

const cancelCreate = () => {
    isCreating.value = false;
    newSceneName.value = '';
};

const confirmCreate = async () => {
    if (!newSceneName.value) return;
    
    // Check for duplicate name
    const exists = scenes.value.some(s => s.name === newSceneName.value);
    if (exists) {
        if (!await ui.confirm({ title: 'Scene Exists', message: `Scene "${newSceneName.value}" already exists. Overwrite?`, confirmText: 'Overwrite' })) {
            return;
        }
    }
    
    isLoading.value = true;
    try {
        SceneManager.createDefaultScene();
        SceneManager.activeSceneName = newSceneName.value;
        await ProjectManager.saveProject();
        isCreating.value = false;
        // Refresh list
        await loadScenes();
        ui.showToast({ title: 'Created', description: `Scene ${newSceneName.value} created.`, type: 'success' });
    } catch (e) {
        ui.showToast({ title: 'Error', description: 'Failed to create scene: ' + e, type: 'error' });
    } finally {
        isLoading.value = false;
    }
};

const onRefresh = () => {
    loadScenes();
};

onMounted(() => {
    loadScenes();
});
</script>

<template>
    <div class="h-full flex flex-col bg-bg-panel border-r border-border font-sans text-xs text-text-primary" @contextmenu.prevent>
        <!-- Toolbar -->
        <div class="h-8 flex items-center px-2 border-b border-border bg-bg-header space-x-2">
            <span class="font-bold text-text-secondary uppercase tracking-wider">Scenes</span>
            <div class="flex-1"></div>
            <!-- Create Button -->
            <button class="hover:bg-bg-hover p-1 rounded" @click="startCreate" title="New Scene">
                <span class="text-green-500 font-bold px-2 py-0.5 border border-green-900 bg-green-900/20 rounded hover:bg-green-900/40">+ New</span>
            </button>
            <button class="hover:bg-bg-hover p-1 rounded text-text-tertiary" @click="onRefresh" title="Refresh List">
                ↻
            </button>
        </div>

        <!-- Create Input -->
        <div v-if="isCreating" class="p-2 border-b border-border bg-bg-base">
            <div class="flex items-center space-x-2">
                <input 
                    ref="inputRef"
                    v-model="newSceneName" 
                    class="flex-1 bg-bg-input text-text-primary px-2 py-1 rounded border border-border focus:border-accent outline-none"
                    @keyup.enter="confirmCreate"
                    @keyup.esc="cancelCreate"
                    placeholder="Scene Name"
                />
                <button @click="confirmCreate" class="text-green-500 hover:text-green-400">✓</button>
                <button @click="cancelCreate" class="text-red-500 hover:text-red-400">×</button>
            </div>
        </div>

        <!-- List -->
        <div class="flex-1 overflow-y-auto p-1 space-y-0.5">
            <div 
                v-for="scene in scenes" 
                :key="scene.path"
                class="group flex items-center px-2 py-1.5 rounded cursor-pointer hover:bg-bg-hover"
                @dblclick="onOpenScene(scene)"
                @contextmenu.stop.prevent="showContextMenu($event, scene)"
            >
                <div class="w-4 text-center mr-2 text-text-tertiary">📄</div>
                <div class="flex-1 truncate select-none" :class="{ 'font-bold': scene.name === SceneManager.activeSceneName }">{{ scene.name }}</div>
                
                <!-- Direct Delete Button (X) -->
                <button class="hidden group-hover:block hover:text-red-400 text-text-tertiary px-1" @click.stop="onDeleteSceneDirect(scene)">
                    ×
                </button>
            </div>
            
            <div v-if="scenes.length === 0 && !isLoading" class="p-4 text-center text-text-tertiary italic">
                No scenes found.
            </div>
            <div v-if="isLoading" class="p-4 text-center text-text-tertiary">
                Loading...
            </div>
        </div>

        <!-- Context Menu -->
        <div v-if="menuState.visible" 
             class="fixed bg-bg-panel border border-border shadow-lg rounded z-50 py-1 min-w-[140px]"
             :style="{ top: menuState.y + 'px', left: menuState.x + 'px' }">
            <button @click="onDuplicateScene" class="w-full text-left px-3 py-1.5 hover:bg-bg-hover text-xs">Duplicate</button>
            <div class="h-[1px] bg-border my-1"></div>
            <button @click="onDeleteScene" class="w-full text-left px-3 py-1.5 hover:bg-red-900 hover:text-white text-xs text-red-400">Delete</button>
        </div>
    </div>
</template>
