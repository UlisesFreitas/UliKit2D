<script setup lang="ts">
import { ref, nextTick, computed, onMounted, onUnmounted } from 'vue';
import { getFileSystem } from '../../api/FileSystem';
import { SceneManager } from '../../engine/managers/SceneManager';
import { ProjectManager } from '../managers/ProjectManager';
import { ProjectManifestManager } from '../managers/ProjectManifestManager';
import { useUIStore } from '../../stores/useUIStore';
import { useProjectStore } from '../../stores/useProjectStore';
import { eventBus } from '../../engine/core/EventBus';

const fs = getFileSystem();
const ui = useUIStore();
const projectStore = useProjectStore();

// Use Store as Source of Truth, sorted alphabetically
// REVISION PATTERN: Force re-eval on signals
const revision = ref(0);

const scenes = computed(() => {
    revision.value; // Dependency
    const all = [...projectStore.scenes];
    
    // Deduplicate by path to prevent UI duplication if Store gets dirty
    const unique = all.filter((s, index, self) => 
        index === self.findIndex((t) => (
            t.path === s.path
        ))
    );
    
    console.log('[ScenesPanel] Raw Scenes:', all.map(s => s.path));
    console.log('[ScenesPanel] Unique Scenes:', unique.map(s => s.path));

    return unique.sort((a, b) => a.name.localeCompare(b.name));
});

// Reactive Active Scene Tracker
const activeSceneName = ref(SceneManager.activeSceneName);

const updateActiveScene = (name: string) => {
    activeSceneName.value = name;
};

const handleRefresh = () => {
    revision.value++;
};

onMounted(() => {
    eventBus.on('scene-loaded', updateActiveScene);
    // Listen to generic project/scene events to force list refresh if needed
    eventBus.on('project-saved', handleRefresh);
    eventBus.on('scene-list-changed', handleRefresh);
});

onUnmounted(() => {
    eventBus.off('scene-loaded', updateActiveScene);
    eventBus.off('project-saved', handleRefresh);
    eventBus.off('scene-list-changed', handleRefresh);
});

const isLoading = ref(false);
const isCreating = ref(false);
const newSceneName = ref('');
const inputRef = ref<HTMLInputElement | null>(null);

// Selection & Renaming
const selectedPath = ref<string | null>(null);
const renamingPath = ref<string | null>(null);
const renameValue = ref('');
const renameInputRef = ref<HTMLInputElement | null>(null);

// Context Menu State
const menuState = ref({
    visible: false,
    x: 0,
    y: 0,
    scene: null as any
});

const onSelectScene = (scene: any) => {
    selectedPath.value = scene.path;
};

const onOpenScene = async (scene: any) => {
    if (await ui.confirm({ title: 'Load Scene', message: `Load scene "${scene.name}"? Unsaved changes will be lost.` })) {
        const success = await SceneManager.loadSceneFromFile(scene.path);
        if (success) {
            console.log('Scene loaded:', scene.name);
            ui.showToast({ title: 'Scene Loaded', description: `Loaded ${scene.name}`, type: 'success' });
        }
    }
};

const showContextMenu = (e: MouseEvent, scene: any) => {
    selectedPath.value = scene.path; // Auto select on right click
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

const startRename = (scene: any) => {
    renamingPath.value = scene.path;
    renameValue.value = scene.name;
    menuState.value.visible = false;
    nextTick(() => {
        // Since it's in v-for, ref is an array
        const input = Array.isArray(renameInputRef.value) ? renameInputRef.value[0] : renameInputRef.value;
        input?.focus();
        input?.select();
    });
};

const cancelRename = () => {
    renamingPath.value = null;
    renameValue.value = '';
};

const confirmRename = async () => {
    if (!renamingPath.value) return;
    const oldPath = renamingPath.value;
    const newName = renameValue.value.trim();
    
    // Find scene object
    const scene = scenes.value.find(s => s.path === oldPath);
    if (!scene) return cancelRename();

    if (!newName || newName === scene.name) return cancelRename();

    // Check collision
    if (scenes.value.some(s => s.name === newName)) {
        ui.showToast({ title: 'Error', description: 'Name already exists', type: 'error' });
        return;
    }

    try {
        // 1. Rename File on Disk
        const content = await fs.readFile(oldPath);
        const newPath = `assets/scenes/${newName}.json`;
        
        await fs.writeFile(newPath, content);
        await fs.deleteFile(oldPath); 
        
        // 2. Capture State BEFORE Mutation
        const wasActive = SceneManager.activeSceneName === scene.name;

        // 3. Update Manifest (This mutates scene.name via Store Reactivity)
        await projectStore.renameScene(oldPath, newName, newPath);

        // 4. Update Active Scene Runtime
        if (wasActive) {
            SceneManager.activeSceneName = newName;
            activeSceneName.value = newName; // FORCE UI UPDATE
        }

        await ProjectManager.saveProject(); // Persist manifest AND Save Active Scene (now with new name)

        ui.showToast({ title: 'Renamed', description: `Renamed to ${newName}`, type: 'success' });
        cancelRename();
        selectedPath.value = newPath; // Maintain selection
    } catch (e: any) {
        ui.showToast({ title: 'Error', description: 'Rename failed: ' + e.message, type: 'error' });
        cancelRename();
    }
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
        try {
            // 1. Pre-calculate Fallback if we are about to delete the active scene
            let fallbackScenePath: string | null = null;
            if (scene.name === SceneManager.activeSceneName) {
                const allScenes = ProjectManifestManager.manifest?.scenes || [];
                // Find a scene that is NOT the one we are deleting
                const other = allScenes.find(s => s.path !== scene.path);
                if (other) {
                    fallbackScenePath = other.path;
                }
            }

            // 2. Delete File & Update Manifest
            await fs.deleteFile(scene.path);
            await projectStore.removeScene(scene.path);
            await ProjectManager.saveProject();

            // 3. Switch Scene (Runtime)
            if (scene.name === SceneManager.activeSceneName) {
                if (fallbackScenePath) {
                    await SceneManager.loadSceneFromFile(fallbackScenePath);
                } else {
                     // Only if NO scenes left, reset to empty
                    SceneManager.createDefaultScene();
                    activeSceneName.value = SceneManager.activeSceneName; // Sync UI
                }
            }
            
            ui.showToast({ title: 'Deleted', description: `Scene ${scene.name} deleted.`, type: 'success' });
        } catch (e: any) {
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
        
        let newName = `${scene.name}_Copy`;
        
        // Regex to parse existing "Name_Copy_X" pattern
        // Matches: BaseName_Copy(_Numbers)?
        const copyRegex = /^(.*)_Copy(_(\d+))?$/;
        const match = scene.name.match(copyRegex);
        
        if (match) {
            const base = match[1]; // "SceneA"
            const numStr = match[3]; // "1" or undefined
            const num = numStr ? parseInt(numStr) : 0;
            // If it was "Copy", next is "Copy_1". If "Copy_1", next is "Copy_2"
            // Wait, standard behavior: Copy -> Copy 1 -> Copy 2?
            // User requested: SceneA -> SceneA_Copy. SceneA_Copy -> SceneA_Copy_1.
            if (numStr === undefined) {
                 newName = `${base}_Copy_1`;
            } else {
                 newName = `${base}_Copy_${num + 1}`;
            }
        } else {
             newName = `${scene.name}_Copy`;
        }
        
        // Determine collision safety (just in case loop)
        let finalName = newName;
        let counter = 1;
        while (scenes.value.some(s => s.name === finalName)) {
            // Fallback collision handling
             finalName = `${newName}_${counter++}`;
        }
        
        const newPath = `assets/scenes/${finalName}.json`;
        
        const sceneData = JSON.parse(content);
        // sceneData.name = finalName; 
        
        await fs.writeFile(newPath, JSON.stringify(sceneData, null, 2));
        
        // Add to Manifest
        await projectStore.addScene(finalName, newPath);
        await ProjectManager.saveProject();

        ui.showToast({ title: 'Duplicated', description: `Scene duplicated as ${finalName}`, type: 'success' });
    } catch (e: any) {
        ui.showToast({ title: 'Error', description: 'Failed to duplicate scene: ' + e.message, type: 'error' });
    }
    menuState.value.visible = false;
};

const onDeleteSceneDirect = async (scene: any) => {
    menuState.value.scene = scene;
    await onDeleteScene();
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
    
    // Check collision in MANIFEST
    const exists = scenes.value.some(s => s.name === newSceneName.value);
    if (exists) {
        if (!await ui.confirm({ title: 'Scene Exists', message: `Scene "${newSceneName.value}" already exists.`, confirmText: 'OK', isDanger: false })) {
            return;
        }
        return; // Don't overwrite for now, just block
    }
    
    isLoading.value = true;
    try {
        // 1. Setup new "empty" scene in memory
        SceneManager.createDefaultScene(); 
        SceneManager.activeSceneName = newSceneName.value; 
        
        // 2. Save it to disk as the new file
        const newPath = `assets/scenes/${newSceneName.value}.json`;
        // SceneManager.saveSceneToFile writes the file, but DOES NOT update manifest automatically yet?
        // Let's assume we do it manually here for now to be safe.
        // Or better: write blank template?
        // If we use SceneManager.saveSceneToFile, it performs serialization.
        
        // Let's just create a basic template file manually like ProjectFactory does?
        // Or just let ProjectManager.saveProject() handle it if we are conceptually "saving the project"?
        
        // The safest "Create New Scene" flow:
        // A. Create default JSON content.
        // B. Write to disk.
        // C. Add to Manifest.
        // D. Save Manifest.
        // E. Load it into SceneManager.

        const defaultScene = [{
            id: crypto.randomUUID(),
            name: "Main Camera",
            transform: { x: 0, y: 0, rotation: 0, scale: { x: 1, y: 1 } },
            camera: { zoom: 1, isPrimary: true, backgroundColor: "#333333" }
        }];
        
        await fs.writeFile(newPath, JSON.stringify(defaultScene, null, 2));
        
        // Add to Store
        await projectStore.addScene(newSceneName.value, newPath);
        await ProjectManager.saveProject();
        
        // Load it
        await SceneManager.loadSceneFromFile(newPath);

        isCreating.value = false;
        
        selectedPath.value = newPath;
        ui.showToast({ title: 'Created', description: `Scene ${newSceneName.value} created.`, type: 'success' });
    } catch (e: any) {
        ui.showToast({ title: 'Error', description: 'Failed to create scene: ' + e.message, type: 'error' });
    } finally {
        isLoading.value = false;
    }
};

const onRefresh = () => {
    projectStore.sync(); // Sync from memory/disk if needed
};
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
        
        <!-- DEBUG OVERLAY (AGENT) -->
        <div style="font-size: 8px; font-family: monospace; padding: 4px; background: rgba(0,0,0,0.8); color: cyan; position: absolute; bottom: 0; left: 0; width: 100%; max-height: 100px; overflow-y: auto; pointer-events: none; z-index: 9999;">
             [DEBUG-AGENT]<br>
             Scenes Count: {{ scenes.length }}<br>
             Paths: {{ scenes.map(s => s.path).join(', ') }}
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
                    @blur="cancelCreate"
                    placeholder="Scene Name"
                />
            </div>
        </div>

        <!-- List -->
        <div class="flex-1 overflow-y-auto p-1 space-y-0.5">
            <div 
                v-for="scene in scenes" 
                :key="scene.path"
                class="group flex items-center px-2 py-1.5 rounded cursor-pointer border border-transparent"
                :class="{ 
                    'bg-bg-hover border-accent/20': selectedPath === scene.path,
                    'hover:bg-bg-hover': selectedPath !== scene.path 
                }"
                @click="onSelectScene(scene)"
                @dblclick="onOpenScene(scene)"
                @contextmenu.stop.prevent="showContextMenu($event, scene)"
            >
                <div class="w-4 text-center mr-2 text-text-tertiary">📄</div>
                
                <!-- Rename Input -->
                <input 
                    v-if="renamingPath === scene.path"
                    ref="renameInputRef"
                    v-model="renameValue"
                    class="flex-1 bg-bg-input text-text-primary px-1 rounded outline-none min-w-0"
                    @click.stop
                    @keyup.enter="confirmRename"
                    @keyup.esc="cancelRename"
                    @blur="confirmRename"
                />
                
                <!-- Scene Name -->
                <div v-else class="flex-1 truncate select-none" :class="{ 'font-bold': scene.name === activeSceneName }">
                    {{ scene.name }}
                    <span v-if="scene.name === activeSceneName" class="text-[9px] ml-2 text-accent uppercase tracking-widest opacity-50">(Active)</span>
                </div>
                
                <!-- Direct Delete Button (X) -->
                <button v-if="renamingPath !== scene.path" class="hidden group-hover:block hover:text-red-400 text-text-tertiary px-1" @click.stop="onDeleteSceneDirect(scene)">
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
            <button @click="startRename(menuState.scene!)" class="w-full text-left px-3 py-1.5 hover:bg-bg-hover text-xs">Rename</button>
            <button @click="onDuplicateScene" class="w-full text-left px-3 py-1.5 hover:bg-bg-hover text-xs">Duplicate</button>
            <div class="h-[1px] bg-border my-1"></div>
            <button @click="onDeleteScene" class="w-full text-left px-3 py-1.5 hover:bg-red-900 hover:text-white text-xs text-red-400">Delete</button>
        </div>
    </div>
</template>
