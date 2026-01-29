<script setup lang="ts">
import { ref, onMounted, onUnmounted } from 'vue';
import { useEditorStore } from '../../stores/useEditorStore';
import { world, type Entity } from '../../engine/ecs/ECS';

import { SceneManager } from '../../engine/managers/SceneManager';
import { instance as engine } from '../../engine/core/Engine';

const editorStore = useEditorStore();
const entities = ref<Entity[]>([]);
const activeSceneName = ref(SceneManager.activeSceneName);

const collapsedScene = ref(false);

const updateList = () => {
    // console.log('[HierarchyPanel] updateList called. World Count:', world.entities.length);
    // Sync Scene Name
    activeSceneName.value = SceneManager.activeSceneName;
    
    // Force Normalize if missing (Self-Healing) to ensure stability
    const raw = [...world.entities];
    let needsSort = false;
    raw.forEach((e, i) => {
        if (typeof e.sortIndex !== 'number') {
            e.sortIndex = i; // Assign default index if missing
            needsSort = true;
        }
    });

    // Create shallow copies to force Vue reactivity update
    // SORT BY EXPLICIT INDEX (Stability Fix)
    entities.value = raw.sort((a, b) => (a.sortIndex ?? 0) - (b.sortIndex ?? 0));
};

// --- DRAG & DROP ---
import { projectState } from '../managers/ProjectManager';
const draggedId = ref<string | null>(null);

const onDragStart = (e: DragEvent, id: string) => {
    draggedId.value = id;
    if (e.dataTransfer) {
        e.dataTransfer.effectAllowed = 'move';
        e.dataTransfer.dropEffect = 'move';
        e.dataTransfer.setData('text/plain', id);
    }
};

const onDrop = (e: DragEvent, targetId: string) => {
    e.preventDefault();
    const sourceId = draggedId.value;
    if (!sourceId || sourceId === targetId) return;

    // We operate on the SORTED list to determine visual position
    const currentList = [...entities.value];
    const sourceIdx = currentList.findIndex(e => e.id === sourceId);
    const targetIdx = currentList.findIndex(e => e.id === targetId);

    if (sourceIdx === -1 || targetIdx === -1) return;

    // Move Source to Target Index
    const [moved] = currentList.splice(sourceIdx, 1);
    
    // Safety check for TS (splice could theoretically return empty if bounds wrong, though we checked index)
    if (moved) {
        currentList.splice(targetIdx, 0, moved);
        
        // RE-INDEX EVERYTHING (Normalization) to ensure stability
        // This updates the Source of Truth (Entity Components) directly
        currentList.forEach((entity, index) => {
            if (entity) {
                entity.sortIndex = index;
            }
        });

        projectState.isDirty = true;
        updateList(); // Re-fetch and re-sort
    }
    draggedId.value = null;
};

// Focus Logic moved to context menu or double click rename replaces it
// const focus = (id: string | undefined) => { ... }

// Renaming State
const renamingEntityId = ref<string | null>(null);
const renameValue = ref('');
const renameInputRef = ref<HTMLInputElement | null>(null);

const startRename = (id: string, currentName: string) => {
    renamingEntityId.value = id;
    renameValue.value = currentName || 'Unnamed Entity';
    menuState.value.visible = false;
    
    // Auto-focus next tick
    setTimeout(() => {
        const input = Array.isArray(renameInputRef.value) ? renameInputRef.value[0] : renameInputRef.value;
        input?.focus();
        input?.select();
    }, 0);
};

const cancelRename = () => {
    renamingEntityId.value = null;
    renameValue.value = '';
};

const confirmRename = () => {
    if (!renamingEntityId.value) return;
    
    // Explicitly check and cast if necessary (though 'if' should suffice)
    const entity = world.where(e => e.id === renamingEntityId.value).first;
    if (entity) {
        const newName = renameValue.value.trim();
        if (newName && newName !== entity.name) {
            entity.name = newName;
            
            // Notify changes
            eventBus.emit('entity-updated'); 
        }
    }
    cancelRename();
};

const toggleVisibility = (entity: Entity) => {
    if (entity.visible === undefined) entity.visible = true;
    entity.visible = !entity.visible;
    // Force update maybe? components are not deep reactive usually in ECS unless wrapped
    eventBus.emit('entity-updated');
};

let unsubAdd: any;
let unsubRemove: any;

import { eventBus } from '../../engine/core/EventBus';

// ... (existing imports)

onMounted(() => {
     updateList();
    
    // Subscribe to changes
    unsubAdd = world.onEntityAdded.subscribe(updateList);
    unsubRemove = world.onEntityRemoved.subscribe(updateList);
    
    // Listen for manual updates (from Inspector)
    eventBus.on('entity-updated', updateList);
    // Also listen for selection changes as they might accompany deletions
    eventBus.on('selection-changed', updateList);
    // Listen for scene changes (Load/New)
    eventBus.on('scene-loaded', updateList);
    eventBus.on('scene-cleared', updateList);
    // Listen for metadata changes (Rename)
    eventBus.on('scene-list-changed', updateList);
    eventBus.on('active-scene-changed', updateList);
});

onUnmounted(() => {
    if (unsubAdd) unsubAdd();
    if (unsubRemove) unsubRemove();
    eventBus.off('entity-updated', updateList);
    eventBus.off('selection-changed', updateList);
    eventBus.off('scene-loaded', updateList);
    eventBus.off('scene-cleared', updateList);
});

const select = (id: string | undefined) => {
    // console.log(`[Hierarchy] Selecting: ${id}`);
    if (!id) return;
    editorStore.selectEntity(id);
};

// Deprecated in favor of Create Asset Menu for direct usage, but kept for logic reference
import { EntityFactory, type EntityType } from '../../engine/factories/EntityFactory';

// ... (existing imports)

const getSpawnPosition = () => {
    // 1. Get Screen Center
    const screenX = engine.app.screen.width / 2;
    const screenY = engine.app.screen.height / 2;
    
    // 2. Get Global Stage Transform (Controlled by ScenePanel)
    const stage = engine.app.stage;
    const zoom = stage.scale.x; 
    
    // 3. Project Screen Center to World Space
    // Screen = StagePos + (World * Zoom)
    // World = (Screen - StagePos) / Zoom
    const worldX = (screenX - stage.position.x) / zoom;
    const worldY = (screenY - stage.position.y) / zoom;
    
    return { x: worldX, y: worldY };
};

const createEntity = (type: EntityType = 'Empty') => {
    const pos = getSpawnPosition();
    const id = EntityFactory.createEntity(type, pos);
    
    // Auto-select
    if (editorStore) {
        editorStore.selectEntity(id); 
    }
};

const menuState = ref({ visible: false, x: 0, y: 0, entityId: '' });
const createMenuState = ref({ visible: false, x: 0, y: 0 });

const showContextMenu = (e: MouseEvent, id: string) => {
    menuState.value = {
        visible: true,
        x: e.clientX,
        y: e.clientY,
        entityId: id
    };
    // Close other menus
    createMenuState.value.visible = false;
    
    // Select the entity as well
    select(id);
    
    // Valid for both menus, delay listener to avoid immediate close
    setTimeout(() => {
        const close = () => {
            menuState.value.visible = false;
            createMenuState.value.visible = false;
            window.removeEventListener('click', close);
        };
        window.addEventListener('click', close);
    }, 0);
};

const showCreateMenu = (e: MouseEvent) => {
    createMenuState.value = {
        visible: true,
        x: e.clientX,
        y: e.clientY
    };
    // Close other menus
    menuState.value.visible = false;

    setTimeout(() => {
        const close = () => {
             createMenuState.value.visible = false;
             window.removeEventListener('click', close);
        };
        window.addEventListener('click', close);
    }, 0);
};

const createAsset = (type: EntityType) => {
    createEntity(type);
    createMenuState.value.visible = false;
};

const deleteEntity = () => {
    const id = menuState.value.entityId;
    if (!id) return;
    const entity = world.where(e => e.id === id).first;
    if (entity) {
        world.remove(entity);
        if (editorStore.selectedEntityId === id) {
            editorStore.selectEntity(null);
        }
    }
    updateList();
};

const duplicateEntity = () => {
    const id = menuState.value.entityId;
    if (!id) return;
    const entity = world.where(e => e.id === id).first;
    if (entity) {
        // Simple shallow clone of components (deep clone would be better for complex data)
        const { id: _, ...components } = entity;
        const newId = crypto.randomUUID();
        world.add({
            id: newId,
            ...JSON.parse(JSON.stringify(components)), // Deep clone data
            name: `${entity.name} (Copy)`
        });
        SceneManager.registerEntity(newId, entity.layer || 'Base Layer');
        // SelectionManager.select(newId);
    }
};
</script>

<template>
  <div class="panel h-full flex flex-col bg-bg-panel text-text-primary relative" @contextmenu.prevent>
    <!-- Header -->
    <div class="header p-2 bg-bg-header font-bold border-b border-border flex justify-between items-center">
        <span>Hierarchy</span>
        <button class="text-xs hover:text-accent-color p-1" title="Create" @click="showCreateMenu($event)">
            <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><line x1="12" y1="5" x2="12" y2="19"></line><line x1="5" y1="12" x2="19" y2="12"></line></svg>
        </button>
    </div>
    
    <!-- DEBUG OVERLAY (AGENT) -->
    <div style="font-size: 8px; font-family: monospace; padding: 4px; background: rgba(0,0,0,0.8); color: lime; position: absolute; bottom: 0; left: 0; width: 100%; max-height: 100px; overflow-y: auto; pointer-events: none; z-index: 9999;">
        [DEBUG-AGENT]<br>
        Scenes: {{ activeSceneName }}<br>
        Entities: {{ entities.map(e => `${e.name}:${e.sortIndex}`).join(', ') }}
    </div>
    
    <!-- List -->
    <div class="content flex-1 overflow-y-auto p-1 font-mono">
        <!-- Scene Root -->
        <div class="mb-1">
            <div 
                class="flex items-center px-1 py-1 rounded hover:bg-bg-hover text-sm font-bold text-text-info cursor-pointer select-none"
                @click="collapsedScene = !collapsedScene"
                @contextmenu.stop.prevent="showCreateMenu($event)"
            >
                <span class="mr-1 text-xs opacity-70">{{ collapsedScene ? '▶' : '▼' }}</span>
                <span class="text-accent-color">Scene</span>
                <span class="ml-2 text-xs text-text-secondary font-normal opacity-50">{{ activeSceneName }}</span>
            </div>
            
            <!-- Entities (Children of Scene) -->
            <ul v-if="!collapsedScene" class="pl-3 border-l border-border ml-2 space-y-0.5 mt-1">
                <li 
                    v-for="entity in entities" 
                    :key="entity.id"
                    :id="`hierarchy-item-${entity.id}`"
                    class="group relative flex items-center justify-between px-2 py-1 rounded text-xs transition-colors border border-transparent hover:bg-bg-hover"
                    :class="[
                        editorStore.selectedEntityId === entity.id 
                            ? 'bg-accent-color/10 border-accent-color text-text-primary' 
                            : 'text-text-primary',
                        draggedId === entity.id ? 'opacity-50 border-white border-dashed' : ''
                    ]"
                    @click.stop="select(entity.id)"
                    @dragover.prevent.stop
                    @drop.stop="onDrop($event, entity.id!)"
                    @contextmenu.stop.prevent="showContextMenu($event, entity.id || '')"
                >
                    <!-- Left: Handle + Icon + Name -->
                    <div class="flex items-center gap-2 flex-1 overflow-hidden">
                        <!-- Drag Handle -->
                        <div 
                            class="cursor-grab text-text-disabled hover:text-text-primary opacity-0 group-hover:opacity-100 transition-opacity"
                            draggable="true"
                            @dragstart.stop="onDragStart($event, entity.id!)"
                            title="Drag to Reorder"
                        >
                            <svg xmlns="http://www.w3.org/2000/svg" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><line x1="3" y1="12" x2="21" y2="12"></line><line x1="3" y1="6" x2="21" y2="6"></line><line x1="3" y1="18" x2="21" y2="18"></line></svg>
                        </div>

                        <!-- Entity Icon -->
                        <div class="flex-shrink-0 w-4 text-center select-none" @dblclick="startRename(entity.id!, entity.name || 'Entity')">
                            <span v-if="entity.camera" title="Camera">📷</span>
                            <span v-else-if="entity.sprite" title="Sprite">🖼️</span>
                            <span v-else-if="entity.nineSliceSprite" title="NineSlice">🍱</span>
                            <span v-else-if="entity.animator" title="Animator">🎬</span>
                            <span v-else-if="entity.label" title="Text">📝</span>
                            <span v-else-if="entity.bitmapText" title="BitmapText">🔤</span>
                            <span v-else title="Entity">📦</span>
                        </div>

                        <!-- Rename Input or Name -->
                        <input 
                            v-if="renamingEntityId === entity.id"
                            ref="renameInputRef"
                            v-model="renameValue"
                            class="flex-1 bg-bg-input text-text-primary px-1 rounded outline-none min-w-0 h-5"
                            @click.stop
                            @keyup.enter="confirmRename"
                            @keyup.esc="cancelRename"
                            @blur="confirmRename"
                        />
                        <span 
                            v-else 
                            class="truncate select-none flex-1"
                            @dblclick="startRename(entity.id!, entity.name || 'Entity')"
                        >
                            {{ entity.name || 'Unnamed Entity' }}
                        </span>
                    </div>

                    <!-- Right: Tools (Visibility) -->
                    <div class="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity" :class="{'opacity-100': !entity.visible}">
                        <button 
                            class="p-1 hover:text-accent-color focus:outline-none text-text-disabled"
                            @click.stop="toggleVisibility(entity)"
                            :title="entity.visible ? 'Hide' : 'Show'"
                        >
                            <svg v-if="entity.visible !== false" xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"></path><circle cx="12" cy="12" r="3"></circle></svg>
                            <svg v-else xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19m-6.72-1.07a3 3 0 1 1-4.24-4.24"></path><line x1="1" y1="1" x2="23" y2="23"></line></svg>
                        </button>
                    </div>
                </li>
                <li v-if="entities.length === 0" class="text-text-secondary italic p-2 text-center text-xs opacity-50">
                    Empty Scene
                </li>
            </ul>
        </div>
    </div>

    <!-- Context Menu (Entities) -->
    <div v-if="menuState.visible" 
         class="fixed bg-bg-panel border border-border shadow-lg rounded z-50 py-1 min-w-[140px]"
         :style="{ top: menuState.y + 'px', left: menuState.x + 'px' }">
        <button @click="startRename(menuState.entityId, entities.find(e => e.id === menuState.entityId)?.name || '')" class="w-full text-left px-3 py-1.5 hover:bg-bg-hover text-xs">Rename</button>
        <button @click="duplicateEntity" class="w-full text-left px-3 py-1.5 hover:bg-bg-hover text-xs">Duplicate</button>
        <div class="h-[1px] bg-border my-1"></div>
        <button @click="deleteEntity" class="w-full text-left px-3 py-1.5 hover:bg-red-900 hover:text-white text-xs text-red-400">Delete</button>
    </div>

    <!-- Create Menu (Asset/Scene) -->
    <div v-if="createMenuState.visible" 
         class="fixed bg-bg-panel border border-border shadow-lg rounded z-50 py-1 min-w-[160px]"
         :style="{ top: createMenuState.y + 'px', left: createMenuState.x + 'px' }">
        <div class="px-3 py-1 text-[10px] font-bold text-text-secondary uppercase tracking-wider">Create Entity</div>
        <button @click="createAsset('Sprite')" class="w-full text-left px-3 py-1.5 hover:bg-bg-hover text-xs flex items-center"><span class="mr-2">🖼️</span> Sprite</button>
        <button @click="createAsset('Camera')" class="w-full text-left px-3 py-1.5 hover:bg-bg-hover text-xs flex items-center"><span class="mr-2">📷</span> Camera</button>
        <button @click="createAsset('Animator')" class="w-full text-left px-3 py-1.5 hover:bg-bg-hover text-xs flex items-center"><span class="mr-2">🎬</span> Animator</button>
        <button @click="createAsset('Text')" class="w-full text-left px-3 py-1.5 hover:bg-bg-hover text-xs flex items-center"><span class="mr-2">📝</span> Text Label</button>
        <button @click="createAsset('BitmapText')" class="w-full text-left px-3 py-1.5 hover:bg-bg-hover text-xs flex items-center"><span class="mr-2">🔤</span> Bitmap Text</button>
        <button @click="createAsset('NineSliceSprite')" class="w-full text-left px-3 py-1.5 hover:bg-bg-hover text-xs flex items-center"><span class="mr-2">🍱</span> Nine Slice Sprite</button>
        <div class="h-[1px] bg-border my-1"></div>
        <button @click="createAsset('CircleObject')" class="w-full text-left px-3 py-1.5 hover:bg-bg-hover text-xs flex items-center"><span class="mr-2">⚪</span> Circle Physics Object</button>
        <button @click="createAsset('BoxObject')" class="w-full text-left px-3 py-1.5 hover:bg-bg-hover text-xs flex items-center"><span class="mr-2">📦</span> Box Physics Object</button>
        <div class="h-[1px] bg-border my-1"></div>

        <button @click="createAsset('Empty')" class="w-full text-left px-3 py-1.5 hover:bg-bg-hover text-xs flex items-center"><span class="mr-2">🧊</span> Empty Entity</button>
    </div>
  </div>
</template>

<style scoped>
/* No scoped styles needed, using utility classes and global vars */
</style>
