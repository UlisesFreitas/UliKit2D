<script setup lang="ts">
import { ref, onMounted, onUnmounted, watch, computed } from 'vue';
import { instance as engine } from '../../engine/core/Engine';
import { world } from '../../engine/ecs/ECS';
import { useEditorStore } from '../../stores/useEditorStore';
import { usePreferencesStore } from '../../stores/usePreferencesStore';
import { useTilemapStore } from '../stores/useTilemapStore';
import SceneToolbar from '../components/SceneToolbar.vue';
import Toolbar from '../components/Toolbar.vue';
import { SceneManager } from '../../engine/managers/SceneManager';
import { eventBus } from '../../engine/core/EventBus';
import type { SceneLayer } from '../../engine/managers/SceneManager';

// Store & State
const store = useEditorStore();
const preferencesStore = usePreferencesStore();
const tilemapStore = useTilemapStore();

// UI Refs
const container = ref<HTMLElement | null>(null);
const zoom = computed({
    get: () => store.zoomLevel,
    set: (val) => store.setZoom(val)
});
const showGrid = computed({
    get: () => preferencesStore.grid.visible,
    set: (val: boolean) => preferencesStore.grid.visible = val
});
const snapToGrid = ref(false);

// Systems
let resizeObserver: ResizeObserver;
let sceneGrid: any = null;

// Camera State
const cameraX = ref(0);
const cameraY = ref(0);

// Interaction State
const isPanning = ref(false);
const isPainting = ref(false);

const lastMouseX = ref(0);
const lastMouseY = ref(0);


// Debug
const debugInfo = ref({ screen: {x:0, y:0}, world: {x:0, y:0}, lastClick: 'None' });
const highlightGraphics = ref<any>(null); // For Tilemap highlight

// Computeds
const activeLayer = computed<SceneLayer | null>(() => {
    if (!store.activeLayerId) return null;
    return SceneManager.getLayerById(store.activeLayerId);
});

const isTilemapMode = computed(() => {
    if (!store.activeLayerId) return false;
    const layer = SceneManager.getLayerById(store.activeLayerId);
    return !!(layer?.tileData) && tilemapStore.isPaintMode;
});

// ------------------------------------------------------------------
// UTILS
// ------------------------------------------------------------------

const updateView = () => {
    if (engine.app && engine.app.stage) {
        engine.app.stage.position.set(cameraX.value, cameraY.value);
        engine.app.stage.scale.set(zoom.value);
    }
    if (sceneGrid && preferencesStore.grid.visible) {
        sceneGrid.draw(cameraX.value, cameraY.value, zoom.value, preferencesStore.grid);
    } else if (sceneGrid) {
        sceneGrid.gridGraphics.visible = false;
    }
};

const updateHighlight = (screenX: number, screenY: number) => {
    if (!highlightGraphics.value || !isTilemapMode.value || !activeLayer.value) {
        if (highlightGraphics.value) highlightGraphics.value.clear();
        return;
    }
    // World Coords
    const worldX = (screenX - cameraX.value) / zoom.value;
    const worldY = (screenY - cameraY.value) / zoom.value;
    
    // Grid Coords
    const gridSize = activeLayer.value.gridSize || { x: 32, y: 32 };
    const gx = Math.floor(worldX / gridSize.x);
    const gy = Math.floor(worldY / gridSize.y);

    const tx = gx * gridSize.x;
    const ty = gy * gridSize.y;
    
    const isEraser = tilemapStore.currentTool === 'eraser';
    const color = isEraser ? 0xFF0000 : 0x00FF00;

    if (highlightGraphics.value) {
        const g = highlightGraphics.value;
        g.clear();
        g.rect(tx, ty, gridSize.x, gridSize.y);
        g.fill({ color: color, alpha: 0.2 });
        g.stroke({ width: 2, color: color, alpha: 1 });
    }
};



const paintTile = (e: MouseEvent, erase = false) => {
    if (!isTilemapMode.value || !activeLayer.value || !container.value) return;

    // Use Global Screen Coords
    const screenX = e.clientX;
    const screenY = e.clientY;
    
    // World Coords
    const worldX = (screenX - cameraX.value) / zoom.value;
    const worldY = (screenY - cameraY.value) / zoom.value;
    
    // Grid Coords
    const gridSize = activeLayer.value.gridSize || { x: 32, y: 32 };
    const gx = Math.floor(worldX / gridSize.x);
    const gy = Math.floor(worldY / gridSize.y);
    
    if (!activeLayer.value.tileData) return;

    const key = `${gx},${gy}`;
    const currentId = activeLayer.value.tileData[key];
    const targetId = erase ? undefined : tilemapStore.selectedTileId;

    if (currentId !== targetId) {
        if (targetId === undefined) {
             delete activeLayer.value.tileData[key];
        } else {
             activeLayer.value.tileData[key] = targetId;
        }
        SceneManager.setDirty(true);
        eventBus.emit('layer-update', activeLayer.value.id);
    }
};

// ------------------------------------------------------------------
// EVENTS
// ------------------------------------------------------------------

const onWheel = (e: WheelEvent) => {
    e.preventDefault();
    // Immortal Canvas: Stage is Global (0,0). Mouse is Screen Space.
    const mouseX = e.clientX;
    const mouseY = e.clientY;

    const direction = e.deltaY > 0 ? -1 : 1;
    const zoomFactor = Math.max(0.1, zoom.value * 0.1);
    const minZoom = 0.1;
    const maxZoom = 64.0; // Increased for Pixel Art (8x8)
    
    const prevZoom = zoom.value;
    let newZoom = prevZoom + (direction * zoomFactor);
    newZoom = Math.max(minZoom, Math.min(maxZoom, Math.round(newZoom * 10) / 10));

    if (newZoom === prevZoom) return;

    // Zoom Towards Point
    const worldX = (mouseX - cameraX.value) / prevZoom;
    const worldY = (mouseY - cameraY.value) / prevZoom;

    // Set Zoom (Store might clamp it further)
    zoom.value = newZoom;
    
    // Read back actual zoom from store to ensure Camera Math matches Reality
    const actualZoom = zoom.value;

    if (actualZoom === prevZoom) {
        // Zoom didn't change (e.g. hit store limit), don't move camera
        return;
    }
    
    cameraX.value = mouseX - (worldX * actualZoom);
    cameraY.value = mouseY - (worldY * actualZoom);
    
    updateView();
};

const onMouseDown = async (e: MouseEvent) => {
    (document.activeElement as HTMLElement)?.blur();

    const rect = (engine.app.canvas as HTMLCanvasElement).getBoundingClientRect();
    const mouseX = e.clientX - rect.left;
    const mouseY = e.clientY - rect.top;

    // 1. Gizmo Interaction (Proxy)
    if (e.button === 0 && !e.altKey && !isPainting.value) {
        // Import dynamically
        const { instance: gizmoManager } = await import('../gizmos/GizmoManager');
        const { instance: areaSelectionManager } = await import('../managers/AreaSelectionManager');
        const { instance: selectionManager } = await import('../managers/SelectionManager');

        const gizmoRes = gizmoManager.processPointerDown(mouseX, mouseY);
        
        if (gizmoRes) {
            // Gizmo handled the click (e.g. started drag)
            return;
        }
        
        // 1.5 Selection Logic (Single Click)
        const hitId = selectionManager.hitTest(mouseX, mouseY);
        
        if (hitId) {
            store.selectEntity(hitId);
        } else {
            // CLICKED EMPTY SPACE -> PREPARE AREA SELECT
            // We don't clear selection immediately to allow drag-start.
            // If it's a click-release without drag, we clear then.
            
            // Start Area Drag
            store.selectEntity(null); // Clear first? Yes, usually.
            areaSelectionManager.startDrag(mouseX, mouseY);
        }
    }
    
    // 2. Painting
    // Note: Painting likely uses global coordinate mapping too, but let's verify map function logic later.
    // For now, painting uses paintTile logic which likely uses raw events or maps internally.
    // Leaving raw event passing for paintTile as it might handle it or need refactor separately.
    if (isTilemapMode.value && (e.button === 0 || e.button === 2) && !e.altKey) {
        isPainting.value = true;
        const isErase = e.button === 2 || tilemapStore.currentTool === 'eraser';
        paintTile(e, isErase);
        return; 
    }

    // 3. Panning (Middle or Alt+Left)
    if (e.button === 1 || (e.button === 0 && e.altKey)) {
        isPanning.value = true;
        lastMouseX.value = e.clientX; // Panning uses deltas, so clientX is fine if consistent
        lastMouseY.value = e.clientY;
        container.value!.style.cursor = 'grabbing';
    }
};

const onMouseMove = async (e: MouseEvent) => {
    const rect = (engine.app.canvas as HTMLCanvasElement).getBoundingClientRect();
    const sx = e.clientX - rect.left;
    const sy = e.clientY - rect.top;
    
    // Proxy to Gizmo
    const { instance: gizmoManager } = await import('../gizmos/GizmoManager');
    gizmoManager.processPointerMove(sx, sy);
    
    // Update Hover State (for Debug Labels)
    const { instance: selectionManager } = await import('../managers/SelectionManager');
    selectionManager.updateHover(sx, sy);

    // Proxy to Area Selection
    const { instance: areaSelectionManager } = await import('../managers/AreaSelectionManager');
    areaSelectionManager.updateDrag(sx, sy);
    
    updateHighlight(sx, sy);
    
    // Debug Update
    debugInfo.value.screen = { x: Math.round(sx), y: Math.round(sy) };
    debugInfo.value.world = { 
        x: Math.round((sx - cameraX.value)/zoom.value), 
        y: Math.round((sy - cameraY.value)/zoom.value) 
    };
    
    if (isPainting.value) {
        const isErase = (e.buttons & 2) === 2 || tilemapStore.currentTool === 'eraser';
        paintTile(e, isErase);
        return;
    }

    if (isPanning.value) {
        // Delta matches Window movement
        const dx = e.clientX - lastMouseX.value;
        const dy = e.clientY - lastMouseY.value;
        
        cameraX.value += dx;
        cameraY.value += dy;
        
        lastMouseX.value = e.clientX;
        lastMouseY.value = e.clientY;
        
        updateView();
    }
};

const onMouseUp = async () => {
    isPainting.value = false;
    isPanning.value = false;
    if (container.value) container.value.style.cursor = 'default';
    
    // Release Gizmo
    const { instance: gizmoManager } = await import('../gizmos/GizmoManager');
    gizmoManager.processPointerUp();
    
    const { instance: areaSelectionManager } = await import('../managers/AreaSelectionManager');
    areaSelectionManager.endDrag();
};

const onDrop = (e: DragEvent) => {
    const path = e.dataTransfer?.getData('text/plain');
    if (!path) return;
    
    // Use Global Screen Coords
    const screenX = e.clientX;
    const screenY = e.clientY;
    
    const worldX = (screenX - cameraX.value) / zoom.value;
    const worldY = (screenY - cameraY.value) / zoom.value;

    console.log('Dropped on Scene:', path);
    if (path.endsWith('.png') || path.endsWith('.jpg')) {
        world.add({
            id: crypto.randomUUID(),
            name: 'New Sprite',
            transform: { x: worldX, y: worldY, rotation: 0, scale: { x: 1, y: 1 } },
            sprite: { texture: path }
        });
    }
};


// ------------------------------------------------------------------
// LIFECYCLE
// ------------------------------------------------------------------

onMounted(async () => {
    // NOTE: Engine is initialized in DockLayout (Immortal Canvas)
    
    // Auto-Select "Scene" Layer if none
    if (!store.activeLayerId && SceneManager.layers.length > 0) {
        store.selectLayer(SceneManager.layers[0]!.id);
    }

    // Grid Reactivity
    watch(() => preferencesStore.grid, (val) => {
        console.log('[ScenePanel] Watcher Triggered. Color:', val.color);
        updateView();
    }, { deep: true });

    if (container.value) {
        resizeObserver = new ResizeObserver(() => {
             // Re-calculate center to keep 0,0 at center or simple update
             // If we just call updateView(), the stage position (cameraX/Y) stays static, 
             // but if the panel moves (e.g. sidebar open/close), the stage incorrectly stays put relative to window.
             // We need to re-center or offset based on delta. 
             // For robustness, let's re-center 0,0 for now (or at least update logic).
             const rect = container.value!.getBoundingClientRect();
             // Ideally we preserve the 'lookAt' point, but simpler fix:
             cameraX.value = rect.left + rect.width / 2;
             cameraY.value = rect.top + rect.height / 2;
             
             updateView();
        });
        resizeObserver.observe(container.value);
        
        // Initial Center Camera
        // Since the canvas is Global (Immortal), (0,0) is top-left of window.
        // We want (0,0) world space to be at the center of this Panel.
        // Panel Center = (rect.left + rect.width/2, rect.top + rect.height/2)
        const rect = container.value.getBoundingClientRect();
        cameraX.value = rect.left + rect.width / 2;
        cameraY.value = rect.top + rect.height / 2;
        updateView();
    }

    // Initialize Grid (We can do this here as we just need engine.app)
    if (engine.app) {
         const { GridSystem } = await import('../systems/GridSystem');
         sceneGrid = new GridSystem(engine.app);
         // Initial Draw
         if (preferencesStore.grid.visible) {
             sceneGrid.draw(cameraX.value, cameraY.value, zoom.value, preferencesStore.grid);
         }
    }
});

onUnmounted(() => {
    if (resizeObserver) resizeObserver.disconnect();
    // Do not destroy engine or systems here
});

// Watchers
watch(zoom, () => updateView());
watch(() => preferencesStore.grid, () => updateView(), { deep: true });
</script>

<template>
  <div 
    class="scene-panel" 
    ref="container" 
    tabindex="0"
    @dragover.prevent 
    @drop.prevent="onDrop"
    @wheel="onWheel"
    @mousedown="onMouseDown"
    @mousemove="onMouseMove"
    @mouseup="onMouseUp"
    @mouseleave="onMouseUp"
    @contextmenu.prevent
  >
    <!-- Overlay UI Only - No Canvas -->
    
<!-- Debug Overlay -->
    <div class="absolute top-4 right-4 bg-black/80 text-white p-2 rounded text-xs z-[101] font-mono pointer-events-none select-none">
        <div class="font-bold text-yellow-400 mb-1 border-b border-gray-600">INPUT DEBUGGER</div>
        <div class="grid grid-cols-2 gap-x-4">
             <span class="text-gray-400">Screen:</span>
             <span>{{ debugInfo.screen.x }}, {{ debugInfo.screen.y }}</span>
             
             <span class="text-gray-400">World:</span>
             <span class="text-green-400">{{ debugInfo.world.x }}, {{ debugInfo.world.y }}</span>
             
             <span class="text-gray-400">Cam Pos:</span>
             <span>{{ Math.round(cameraX) }}, {{ Math.round(cameraY) }}</span>
             
             <span class="text-gray-400">Zoom:</span>
             <span>{{ zoom.toFixed(2) }}x</span>
             
             <div class="col-span-2 mt-2 border-t border-gray-700 pt-1 text-[10px] text-gray-500">
                 Last Click: <span class="text-white">{{ debugInfo.lastClick }}</span>
             </div>
        </div>
    </div>

    <!-- Overlay Toolbar (Bottom Center) -->
    <div class="absolute top-4 left-1/2 transform -translate-x-1/2 z-[100]">
        <Toolbar />
    </div>

    <!-- Overlay Toolbar (Bottom Center) -->
    <div class="absolute bottom-6 left-1/2 transform -translate-x-1/2 z-[100] pb-2">
        <SceneToolbar 
            v-model:zoom="zoom"
            v-model:showGrid="showGrid"
            :snapToGrid="snapToGrid"
            @update:zoom="val => { zoom = val; updateView(); }"
            @update:snapToGrid="val => { snapToGrid = val; import('../gizmos/GizmoManager').then(m => m.instance.snapToGrid = val); }"
        />
    </div>

  </div>
</template>

<style scoped>
.scene-panel {
  width: 100%;
  height: 100%;
  background-color: transparent !important; /* Transparent for Immortal Canvas */
  position: relative;
  overflow: hidden;
  outline: none;
}
</style>
