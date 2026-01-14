<script setup lang="ts">
import { ref, onMounted, onUnmounted, watch, nextTick } from 'vue';
import { useEditorStore } from '../../stores/useEditorStore';
import { world, type Entity } from '../../engine/ecs/ECS';

import { SceneManager } from '../../engine/managers/SceneManager';
import { instance as engine } from '../../engine/core/Engine';
import { SelectionManager } from '../managers/SelectionManager';

const editorStore = useEditorStore();
const entities = ref<Entity[]>([]);

const collapsedScene = ref(false);

const updateList = () => {
    // Create shallow copies to force Vue reactivity update since entity objects are not reactive
    entities.value = world.entities.map(e => ({ ...e }));
};

const focus = (id: string | undefined) => {
    if (!id) return;
    const entity = world.where(e => e.id === id).first;
    if (entity && entity.transform) {
         // Focus Logic: Center Camera on Entity
         // Assuming engine.app.stage controls the view transform
         const screenW = engine.app.screen.width;
         const screenH = engine.app.screen.height;
         const scale = engine.app.stage.scale.x;

         engine.app.stage.position.set(
             (screenW / 2) - (entity.transform.x * scale),
             (screenH / 2) - (entity.transform.y * scale)
         );
    }
};

let unsubAdd: any;
let unsubRemove: any;

import { eventBus } from '../../engine/core/EventBus';
import defaultSprite from '../../resources/internal_default_assets/default_sprite.png';

// ... (existing imports)

onMounted(() => {
    updateList();
    
    // Subscribe to changes
    unsubAdd = world.onEntityAdded.subscribe(updateList);
    unsubRemove = world.onEntityRemoved.subscribe(updateList);
    
    // Listen for manual updates (from Inspector)
    eventBus.on('entity-updated', updateList);
});

onUnmounted(() => {
    if (unsubAdd) unsubAdd();
    if (unsubRemove) unsubRemove();
    eventBus.off('entity-updated', updateList);
});

const select = (id: string | undefined) => {
    // console.log(`[Hierarchy] Selecting: ${id}`);
    if (!id) return;
    // editorStore.selectEntity(id);
};

// Deprecated in favor of Create Asset Menu for direct usage, but kept for logic reference
const createEntity = (type: 'Empty' | 'Sprite' | 'Camera' | 'Text' | 'BitmapText' | 'Animator' | 'NineSliceSprite' | 'CircleObject' | 'BoxObject' = 'Empty') => {
    
    const id = crypto.randomUUID();
    let data: any = {
        id,
        name: type === 'Empty' ? 'New Entity' : `New ${type}`,
        layer: 'Base Layer', // Default Layer
        transform: { x: 0, y: 0, rotation: 0, scale: { x: 1, y: 1 }, zIndex: 0 }
    };

    if (type === 'Sprite') {
        data.sprite = { texture: defaultSprite };
    } else if (type === 'Camera') {
        data.camera = { zoom: 1, isPrimary: false, backgroundColor: '#000000' };
    } else if (type === 'Text') {
        data.label = { 
            text: 'New Text', 
            fontSize: 24, 
            fontFamily: 'Arial', 
            color: '#ffffff', 
            align: 'center' 
        };
    } else if (type === 'Animator') {
        data.sprite = { texture: defaultSprite }; // Animator needs a sprite
        data.animator = {
            currentAnim: '',
            isPlaying: true,
            speed: 1,
            elapsedTime: 0,
            animations: {}
        };
    } else if (type === 'BitmapText') {
        data.bitmapText = {
            text: 'Bitmap Text',
            fontName: '',
            fontSize: 32,
            tint: 0xffffff,
            align: 'left'
        };
    } else if (type === 'NineSliceSprite') {
        data.nineSliceSprite = {
            texture: '',
            width: 100,
            height: 100,
            left: 10, right: 10, top: 10, bottom: 10
        };
    } else if (type === 'CircleObject') {
        data.name = 'Circle Physics';
        data.rigidBody = { mass: 1, isStatic: false, friction: 0.5, restitution: 0.5 };
        data.circleCollider = { radius: 25 };
    } else if (type === 'BoxObject') {
        data.name = 'Box Physics';
        data.rigidBody = { mass: 1, isStatic: false, friction: 0.5, restitution: 0.5 };
        data.boxCollider = { width: 50, height: 50 };
    }

    world.add(data);
    SceneManager.registerEntity(id, 'Base Layer');
    // The subscription will update the list automatically
    // SelectionManager.select(id);
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

const createAsset = (type: 'Empty' | 'Sprite' | 'Camera' | 'Text' | 'BitmapText' | 'Animator' | 'NineSliceSprite' | 'CircleObject' | 'BoxObject') => {
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
            // editorStore.selectEntity('');
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
                <span class="ml-2 text-xs text-text-secondary font-normal opacity-50">{{ SceneManager.activeSceneName }}</span>
            </div>
            
            <!-- Entities (Children of Scene) -->
            <ul v-if="!collapsedScene" class="pl-3 border-l border-border ml-2 space-y-0.5 mt-1">
                <li 
                    v-for="entity in entities" 
                    :key="entity.id"
                    :id="`hierarchy-item-${entity.id}`"
                    @dblclick="focus(entity.id)"
                    @contextmenu.stop.prevent="showContextMenu($event, entity.id || '')"
                    :class="[
                        'cursor-pointer px-2 py-0.5 rounded text-xs transition-colors flex items-center border',
                        editorStore.selectedEntityId === entity.id 
                            ? 'bg-accent-color text-white border-accent-color font-bold shadow-sm' 
                            : 'border-transparent hover:bg-bg-hover text-text-primary'
                    ]"
                >
                    <!-- Icon based on components -->
                    <span class="mr-1.5 opacity-70">
                        <span v-if="entity.camera">📷</span>
                        <span v-else-if="entity.sprite">🖼️</span>
                        <span v-else-if="entity.nineSliceSprite">🍱</span>
                        <span v-else-if="entity.animator">🎬</span>
                        <span v-else-if="entity.label">📝</span>
                        <span v-else-if="entity.bitmapText">🔤</span>

                        <span v-else>📦</span>
                    </span>
                    <span class="truncate">{{ entity.name || 'Unnamed Entity' }}</span>
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
