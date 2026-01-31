<template>
  <div class="layers-panel h-full flex flex-col bg-bg-panel text-text-primary">
    <!-- Header / Toolbar -->
    <div class="panel-header p-2 bg-bg-header font-bold border-b border-border flex items-center justify-between">
      <div class="flex items-center gap-2">
           <span class="text-sm">Layers</span>
      </div>
       <!-- Add Layer Button (Matches HierarchyPanel) -->
       <button class="text-xs hover:text-accent-color p-1" @click="addLayer" title="Add Layer">
            <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><line x1="12" y1="5" x2="12" y2="19"></line><line x1="5" y1="12" x2="19" y2="12"></line></svg>
       </button>
    </div>

    <!-- Layers List -->
    <div class="flex-1 overflow-y-auto p-2 space-y-1">
      <div 
        v-for="(layer, index) in reversedLayers" 
        :key="layer.id"
        class="layer-item flex items-center justify-between p-2 rounded cursor-pointer group select-none transition-colors border border-transparent bg-bg-hover"
        :class="{ 
            'border-accent-primary': selectedLayerId === layer.id,
            'opacity-50 dashed-border': draggingIndex === index
        }"
        @click="selectLayer(layer.id)"
        @dragover.prevent="onDragOver($event, index)"
        @drop.stop="onDrop($event, index)"
      >
        <!-- Drop Indicator -->
        <div v-if="dropIndex === index" class="drop-indicator"></div>

        <!-- LEFT: Handle + Radio + Name -->
        <div class="flex items-center gap-2 overflow-hidden flex-1">
             <!-- Drag Handle (Hidden for Base Layer) -->
             <div 
                v-if="layer.id !== 'Base Layer'"
                class="cursor-grab text-text-disabled hover:text-text-primary p-1 active:cursor-grabbing"
                draggable="true"
                @dragstart.stop="onDragStart($event, index)"
                title="Drag to Reorder"
             >
                <svg xmlns="http://www.w3.org/2000/svg" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><line x1="3" y1="12" x2="21" y2="12"></line><line x1="3" y1="6" x2="21" y2="6"></line><line x1="3" y1="18" x2="21" y2="18"></line></svg>
             </div>
             <div v-else class="w-5"></div> <!-- Spacer -->

             <!-- Active Radio -->
             <div 
                class="p-1 cursor-pointer"
                @click.stop="selectLayer(layer.id)"
                title="Active Layer"
             >
                <div class="w-3 h-3 rounded-full border border-text-secondary bg-bg-input flex items-center justify-center transition-colors"
                     :class="{'bg-accent-color border-accent-color': selectedLayerId === layer.id}">
                     <div v-if="selectedLayerId === layer.id" class="w-1.5 h-1.5 bg-white rounded-full"></div>
                </div>
             </div>

             <!-- Editable Name -->
             <input 
                type="text" 
                v-model="layer.name"
                @change="onNameChange(layer)"
                @click.stop
                @mousedown.stop
                @keydown.stop
                class="text-sm bg-transparent border border-transparent rounded px-1 min-w-0 flex-1 focus:border-accent-primary focus:outline-none focus:bg-bg-input truncate text-text-primary placeholder-text-disabled"
                :class="{ 'text-text-disabled': !layer.visible }"
                :disabled="layer.id === 'Base Layer'" 
             />
        </div>

        <!-- RIGHT: Tools -->
        <div class="flex items-center gap-1 bg-transparent group-hover:opacity-100 transition-opacity" :class="{'opacity-60': selectedLayerId !== layer.id}">
             <!-- Tilemap Settings Button -->
            <button 
                class="p-1 hover:text-accent-color focus:outline-none"
                @click.stop="openTilemapSettings(layer)"
                title="Edit Tilemap"
            >
                <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                    <rect x="3" y="3" width="18" height="18" rx="2" ry="2"></rect>
                    <line x1="3" y1="9" x2="21" y2="9"></line>
                    <line x1="3" y1="15" x2="21" y2="15"></line>
                    <line x1="9" y1="3" x2="9" y2="21"></line>
                    <line x1="15" y1="3" x2="15" y2="21"></line>
                </svg>
            </button>

             <!-- Background Color (Base Layer Only) -->
             <div v-if="layer.id === 'Base Layer'" class="mr-2" title="Background Color">
                 <input 
                    type="color" 
                    :value="resolveColor(layer.color)"
                    @input="(e) => updateBaseLayerColor(e, layer)"
                    class="w-4 h-4 p-0 border border-bg-border rounded cursor-pointer bg-transparent block"
                />
             </div>

             <!-- Visibility Toggle (Hidden for Base Layer) -->
            <button 
                v-if="layer.id !== 'Base Layer'"
                class="p-1 hover:text-accent-color focus:outline-none"
                @click.stop="toggleVisibility(layer)"
                :title="layer.visible ? 'Hide Layer' : 'Show Layer'"
            >
                <!-- Eye Open -->
                <svg v-if="layer.visible" xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"></path><circle cx="12" cy="12" r="3"></circle></svg>
                <!-- Eye Closed -->
                <svg v-else xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="text-text-disabled"><path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19m-6.72-1.07a3 3 0 1 1-4.24-4.24"></path><line x1="1" y1="1" x2="23" y2="23"></line></svg>
            </button>

             <!-- Collision Toggle -->
             <button 
                class="p-1 hover:text-accent-color focus:outline-none"
                @click.stop="toggleCollision(layer)"
                :title="layer.isCollision ? 'Disable Physics' : 'Enable Physics'"
             >
                <svg v-if="layer.isCollision" xmlns="http://www.w3.org/2000/svg" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="text-accent-warning"><path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"></path></svg>
                <svg v-else xmlns="http://www.w3.org/2000/svg" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="text-text-disabled opacity-50"><path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"></path></svg>
             </button>

             <!-- Lock Toggle (Hidden for Base Layer) -->
             <button 
                v-if="layer.id !== 'Base Layer'"
                class="p-1 hover:text-accent-color focus:outline-none"
                 @click.stop="toggleLock(layer)"
                 :title="layer.locked ? 'Unlock Layer' : 'Lock Layer'"
            >
                <svg v-if="layer.locked" xmlns="http://www.w3.org/2000/svg" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="text-accent-warning"><rect x="3" y="11" width="18" height="11" rx="2" ry="2"></rect><path d="M7 11V7a5 5 0 0 1 10 0v4"></path></svg>
                <svg v-else xmlns="http://www.w3.org/2000/svg" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="text-text-disabled opacity-50"><rect x="3" y="11" width="18" height="11" rx="2" ry="2"></rect><path d="M7 11V7a5 5 0 0 1 9.9-1"></path></svg>
            </button>

            <!-- Delete Button (Not for Base Layer) -->
            <button 
                v-if="layer.id !== 'Base Layer'"
                class="p-1 text-text-disabled hover:text-accent-danger focus:outline-none transition-colors"
                @click.stop="deleteLayer(layer)"
                title="Delete Layer"
            >
                <svg xmlns="http://www.w3.org/2000/svg" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="3 6 5 6 21 6"></polyline><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"></path><line x1="10" y1="11" x2="10" y2="17"></line><line x1="14" y1="11" x2="14" y2="17"></line></svg>
            </button>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, onMounted, onUnmounted, computed } from 'vue';
import { SceneManager, type SceneLayer } from '../../engine/managers/SceneManager';
import { useUIStore } from '../../stores/useUIStore';
import { useLayoutStore } from '../../stores/useLayoutStore';
import { useEditorStore } from '../../stores/useEditorStore';

import { useProjectSettingsStore } from '../../stores/useProjectSettingsStore';
import { eventBus } from '../../engine/core/EventBus';

const uiStore = useUIStore();
const layoutStore = useLayoutStore();
const editorStore = useEditorStore();
const settingsStore = useProjectSettingsStore();

const selectedLayerId = ref<string | null>(null);
// draggingIndex moved below

// Reactive reference to SceneManager layers
const layers = ref<SceneLayer[]>([]);

// Display layers in reverse order (stack metaphor: Top layer first)
// Base Layer (index 0) will be at the bottom (last index)
const reversedLayers = computed(() => {
    return [...layers.value].reverse();
});

const refreshLayers = () => {
    // Re-assign array to trigger reactivity. 
    // Optimization: Diffing could be better, but simple assignment is safe for this list size.
    layers.value = [...SceneManager.layers];
};

// Poll for external changes (e.g. from Scene loading)
const intervalId = setInterval(refreshLayers, 1000);

// Listen for global layer updates (from Store -> SceneManager sync)
eventBus.on('layer-update', refreshLayers);

onMounted(() => {
    refreshLayers();
});

onUnmounted(() => {
    clearInterval(intervalId);
    eventBus.off('layer-update', refreshLayers);
});

const openTilemapSettings = (layer: SceneLayer) => {
    // 1. Select Layer
    selectLayer(layer.id);
    // 2. Open Panel
    layoutStore.openPanel('tilemap-settings', 'Tilemap Settings');
};

const selectLayer = (id: string) => {
    selectedLayerId.value = id;
    editorStore.selectLayer(id);
};

// Helper to push layer changes to Store - DEPRECATED / REMOVED in favor of Direct Actions
// const updateStoreLayers = ...

// Helper: Get current layer names based on Scene order
const getCurrentSystemLayers = (): string[] => {
    // We assume SceneManager.layers reflects the correct order (sorted by index 0..N)
    return SceneManager.layers
        .filter(l => l.layerIndex !== undefined)
        .sort((a, b) => (a.layerIndex || 0) - (b.layerIndex || 0))
        .map(l => l.name);
};

const addLayer = async () => {
    const currentLayers = getCurrentSystemLayers();
    const nextIndex = currentLayers.length;
    
    // Ask for name
    const name = await uiStore.prompt({
        title: 'New Layer Name',
        message: 'Enter layer name:',
        defaultValue: 'Layer ' + (nextIndex + 1)
    });
    
    if (name) {
        // Use Store Action
        settingsStore.addLayer(name);
    }
};

const deleteLayer = async (layer: SceneLayer) => {
    if (await uiStore.confirm({
        title: 'Delete Layer',
        message: `Delete layer "${layer.name}"? Entities inside will move to Base Layer.`,
        isDanger: true
    })) {
        const currentLayers = getCurrentSystemLayers();
        const index = currentLayers.indexOf(layer.name);
        
        if (index > -1) {
            settingsStore.removeLayer(index);
        }
    }
};

const toggleVisibility = (layer: SceneLayer) => {
    layer.visible = !layer.visible;
    SceneManager.setDirty(true);
};

const toggleLock = (layer: SceneLayer) => {
    layer.locked = !layer.locked;
    SceneManager.setDirty(true);
};

const toggleCollision = (layer: SceneLayer) => {
    layer.isCollision = !layer.isCollision;
    SceneManager.setDirty(true);
};

const onNameChange = (layer: SceneLayer) => {
    // Sync rename to Store
    // We need the ORIGINAL index.
    // layer.layerIndex is the reliable source here.
    if (layer.layerIndex !== undefined) {
         settingsStore.renameLayer(layer.layerIndex, layer.name);
    }
};

const resolveColor = (color: string | undefined): string => {
    if (!color) return '#333333';
    
    if (color.startsWith('var(')) {
        // Extract variable name: var(--name) -> --name
        const varName = color.match(/var\(([^)]+)\)/)?.[1];
        if (varName) {
            const resolved = getComputedStyle(document.documentElement).getPropertyValue(varName).trim();
            if (resolved) return resolved;
        }
    }
    return color;
};

const updateBaseLayerColor = (e: Event, layer: SceneLayer) => {
    const target = e.target as HTMLInputElement;
    layer.color = target.value;
    SceneManager.setDirty(true);
};

// ... (previous imports)

const draggingIndex = ref<number | null>(null);
const dropIndex = ref<number | null>(null); // Visual indicator index

// ... (previous code)

// Drag and Drop
const onDragStart = (e: DragEvent, index: number) => {
    if (e.stopPropagation) e.stopPropagation();
    draggingIndex.value = index;
    if (e.dataTransfer) {
        e.dataTransfer.effectAllowed = 'move';
        e.dataTransfer.setData('text/plain', index.toString());
        const target = e.target as HTMLElement;
        const row = target.closest('.layer-item');
        if (row && 'setDragImage' in e.dataTransfer) {
            e.dataTransfer.setDragImage(row, 0, 0);
        }
    }
};

const onDragOver = (e: DragEvent, index: number) => {
    e.preventDefault(); // Necessary to allow dropping
    const fromIndex = draggingIndex.value;
    if (fromIndex === null || fromIndex === index) return;
    
    // Prevent dropping below Base Layer
    const baseVisualIndex = reversedLayers.value.length - 1;
    if (index >= baseVisualIndex) return;

    dropIndex.value = index;
};

const onDragLeave = (e: DragEvent) => {
    // Optional: only clear if leaving the list entirely? 
    // Usually simpler to just let dragOver update it. 
    // But if we leave a valid target, we might want to clear.
    // However, dragleave fires when entering children, so be careful.
};

const onDrop = (_e: DragEvent, targetIndex: number) => { 
    // Clean up
    dropIndex.value = null;
    
    // ... (existing drop logic) ...
    // Note: Use targetIndex directly as it was passed in
    
    const fromIndex = draggingIndex.value;
    if (fromIndex === null || fromIndex === targetIndex) return;
    
    // ... (rest of onDrop implementation from previous file) ...
    // We need to re-include the rest of onDrop logic here since we are replacing the block
    
    const visualOrder = [...reversedLayers.value];
    const baseVisualIndex = visualOrder.length - 1;
    
    if (fromIndex === baseVisualIndex) {
         console.warn('Cannot move Base Layer');
         return;
    }

    if (targetIndex >= baseVisualIndex) {
        targetIndex = baseVisualIndex - 1; 
        if (targetIndex < 0) targetIndex = 0; 
    }

    const item = visualOrder.splice(fromIndex, 1)[0];
    if (!item) return;
    visualOrder.splice(targetIndex, 0, item);
    
    // Base Layer check
    const currentBaseIndex = visualOrder.findIndex(l => l.id === 'Base Layer');
    if (currentBaseIndex !== -1 && currentBaseIndex !== visualOrder.length - 1) {
        const spliced = visualOrder.splice(currentBaseIndex, 1);
        if (spliced.length > 0 && spliced[0]) {
            visualOrder.push(spliced[0]);
        }
    }
    
    const newModelLayers = [...visualOrder].reverse();

    if (newModelLayers[0]?.id !== 'Base Layer') {
         const baseIndex = newModelLayers.findIndex(l => l.id === 'Base Layer');
         if (baseIndex > 0) {
             const spliced = newModelLayers.splice(baseIndex, 1);
             if (spliced.length > 0 && spliced[0]) {
                 newModelLayers.unshift(spliced[0]);
             }
         }
    }

    const newLayerConfigs = newModelLayers.map(l => ({
        name: l.name,
        type: l.type,
        gridSize: l.gridSize
    }));
    
    // @ts-ignore
    settingsStore.reorderLayers(newLayerConfigs);

    draggingIndex.value = null;
};
</script>

<style scoped>
.layer-item {
    position: relative; /* Context for indicator */
}

.drop-indicator {
    height: 34px; /* Matches approximate layer row height */
    border: 2px dashed var(--accent-color);
    border-radius: 4px;
    margin-bottom: 4px;
    background-color: rgba(59, 130, 246, 0.1); /* Light blue transparent */
    pointer-events: none;
    /* Static position to take space and push content down */
    position: static; 
}

.layer-item:hover .fa-grip-vertical {
  opacity: 1; 
}
.dashed-border {
    border-style: dashed;
    border-color: var(--accent-color);
}
/* Ensure color input looks cleaner if needed */
input[type="color"]::-webkit-color-swatch-wrapper {
    padding: 0;
}
input[type="color"]::-webkit-color-swatch {
    border: none;
    border-radius: 4px;
}
</style>
