<script setup lang="ts">
import { ref, onMounted, onUnmounted, watch, computed } from 'vue';
import { instance as engine } from '../../engine/core/Engine';
import { GizmoManager } from '../gizmos/GizmoManager';
import { world } from '../../engine/ecs/ECS';
import { useEditorStore } from '../../stores/useEditorStore';
import { usePreferencesStore } from '../../stores/usePreferencesStore';
import { useTilemapStore } from '../stores/useTilemapStore';
import SceneToolbar from '../components/SceneToolbar.vue';
import Toolbar from '../components/Toolbar.vue';
import { projectState } from '../managers/ProjectManager';
import { SelectionManager } from '../managers/SelectionManager';
import { EditorTilemapSystem } from '../systems/EditorTilemapSystem';
import { SceneManager } from '../../engine/managers/SceneManager';
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
let gizmoManager: GizmoManager;
let tilemapSystem: EditorTilemapSystem; 
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

const updateGizmoSnap = (val: boolean) => {
    snapToGrid.value = val;
    if (gizmoManager) {
        gizmoManager.snapToGrid = val;
    }
};

const paintTile = (e: MouseEvent, erase = false) => {
    if (!isTilemapMode.value || !activeLayer.value || !container.value) return;

    const rect = engine.app?.canvas?.getBoundingClientRect() ?? container.value?.getBoundingClientRect();
    if (!rect) return;

    const screenX = e.clientX - rect.left;
    const screenY = e.clientY - rect.top;
    
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
        if (tilemapSystem) tilemapSystem.markDirty(activeLayer.value.id);
    }
};

// ------------------------------------------------------------------
// EVENTS
// ------------------------------------------------------------------

const onWheel = (e: WheelEvent) => {
    e.preventDefault();
    const direction = e.deltaY > 0 ? -1 : 1;
    const zoomFactor = Math.max(0.1, zoom.value * 0.1);
    const minZoom = 0.1;
    const maxZoom = 15.0; 
    
    const prevZoom = zoom.value;
    let newZoom = prevZoom + (direction * zoomFactor);
    newZoom = Math.max(minZoom, Math.min(maxZoom, Math.round(newZoom * 10) / 10));

    if (newZoom === prevZoom) return;

    if (container.value) {
        const rect = engine.app?.canvas?.getBoundingClientRect() || container.value.getBoundingClientRect();
        const mouseX = e.clientX - rect.left;
        const mouseY = e.clientY - rect.top;
        const worldX = (mouseX - cameraX.value) / prevZoom;
        const worldY = (mouseY - cameraY.value) / prevZoom;

        // Apply new zoom
        // NOTE: We update store via computed 'zoom' setter, but cameraX/Y is local.
        // We set local zoom.value directly? No, it's computed.
        zoom.value = newZoom;
        
        // Adjust Camera to keep Mouse over same World Pos
        cameraX.value = mouseX - (worldX * newZoom);
        cameraY.value = mouseY - (worldY * newZoom);
    } else {
        zoom.value = newZoom;
    }
};

const onMouseDown = (e: MouseEvent) => {
    (document.activeElement as HTMLElement)?.blur();

    const rect = engine.app?.canvas?.getBoundingClientRect() || container.value?.getBoundingClientRect();
    if (!rect) return;

    const mouseX = e.clientX - rect.left;
    const mouseY = e.clientY - rect.top;

    // 1. Selection (Left Click, No Alt, No Tilemap)
    // Only if NOT panning
    if (e.button === 0 && !e.altKey && !isTilemapMode.value) {
          if (gizmoManager && gizmoManager.hoverHandle) {
               return; 
          }

          const foundId = SelectionManager.pickEntity({ x: mouseX, y: mouseY });
          
          let name = 'NULL';
          if (foundId) {
                const ent = world.where(ent => ent.id === foundId).first;
                name = ent ? (ent.name || ent.id?.substring(0,8) || 'Unknown') : 'Unknown';
          }
          debugInfo.value.lastClick = name;
          try {
              store.selectEntity(foundId);
          } catch (err) {
              console.error('[ScenePanel] Failed to select entity:', err);
          }
    }

    // 2. Painting
    if (isTilemapMode.value && (e.button === 0 || e.button === 2) && !e.altKey) {
        isPainting.value = true;
        const isErase = e.button === 2 || tilemapStore.currentTool === 'eraser';
        paintTile(e, isErase);
        return; 
    }

    // 3. Panning (Middle or Alt+Left)
    if (e.button === 1 || (e.button === 0 && e.altKey)) {
        isPanning.value = true;
        lastMouseX.value = e.clientX;
        lastMouseY.value = e.clientY;
        container.value!.style.cursor = 'grabbing';
    }
};

const onMouseMove = (e: MouseEvent) => {
    const rect = engine.app?.canvas?.getBoundingClientRect() || container.value?.getBoundingClientRect();
    if (rect) {
        const sx = e.clientX - rect.left;
        const sy = e.clientY - rect.top;
        
        updateHighlight(sx, sy);
        
        // Debug Update
        debugInfo.value.screen = { x: Math.round(sx), y: Math.round(sy) };
        debugInfo.value.world = { 
            x: Math.round((sx - cameraX.value)/zoom.value), 
            y: Math.round((sy - cameraY.value)/zoom.value) 
        };
    }
    
    if (isPainting.value) {
        const isErase = (e.buttons & 2) === 2 || tilemapStore.currentTool === 'eraser';
        paintTile(e, isErase);
        return;
    }

    if (isPanning.value) {
        const dx = e.clientX - lastMouseX.value;
        const dy = e.clientY - lastMouseY.value;
        cameraX.value += dx;
        cameraY.value += dy;
        lastMouseX.value = e.clientX;
        lastMouseY.value = e.clientY;
        updateView();
    }
};

const onMouseUp = () => {
    isPainting.value = false;
    isPanning.value = false;
    if (container.value) container.value.style.cursor = 'default';
};

const onDrop = (e: DragEvent) => {
    const path = e.dataTransfer?.getData('text/plain');
    if (!path) return;
    
    const rect = container.value?.getBoundingClientRect();
    if (!rect) return;
    
    const screenX = e.clientX - rect.left;
    const screenY = e.clientY - rect.top;
    
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
    if (container.value) {
        (window as any).engine = engine; 
        await engine.init(container.value);
        engine.start();

        resizeObserver = new ResizeObserver(() => {
            if (engine.app && engine.app.renderer) {
                engine.app.resize();
                updateView();
            }
        });
        resizeObserver.observe(container.value);
        
        gizmoManager = new GizmoManager();
        gizmoManager.getGridSizeCallback = (layerId) => {
             const layer = SceneManager.getLayerById(layerId);
             return layer?.gridSize;
        };
        
        tilemapSystem = new EditorTilemapSystem(engine.app);
        engine.app.ticker.add(() => tilemapSystem.update());
        
        // Grid
        const { GridSystem } = await import('../systems/GridSystem');
        const grid = new GridSystem(engine.app);
        sceneGrid = grid;
        if (preferencesStore.grid.visible) grid.draw(cameraX.value, cameraY.value, zoom.value, preferencesStore.grid);
        
        engine.app.renderer.on('resize', () => {
             updateView();
        });
    }
});

onUnmounted(() => {
    if (resizeObserver) resizeObserver.disconnect();
    if (gizmoManager) gizmoManager.dispose();
});

// Watchers
watch(zoom, () => updateView());
watch(() => preferencesStore.grid, () => updateView(), { deep: true });
</script>

<template>
  <div 
    class="scene-panel" 
    ref="container" 
    @dragover.prevent 
    @drop.prevent="onDrop"
    @wheel="onWheel"
    @mousedown="onMouseDown"
    @mousemove="onMouseMove"
    @mouseup="onMouseUp"
    @mouseleave="onMouseUp"
  >
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
            @update:showGrid="val => { showGrid = val; updateView(); }"
            @update:snapToGrid="updateGizmoSnap"
        />
    </div>

    <!-- Canvas will be appended here by the Engine -->
  </div>
</template>

<style scoped>
.scene-panel {
  width: 100%;
  height: 100%;
  background-color: var(--bg-base);
  position: relative;
  overflow: hidden;
}
.overlay {
  color: var(--text-secondary);
  font-size: 24px;
}
.toolbar-overlay {
    position: absolute;
    top: 10px;
    left: 50%;
    transform: translateX(-50%);
    z-index: 1000;
    /* Optional: glass effect */
    background: var(--bg-panel);
    border-radius: 8px;
    padding: 2px;
    border: 1px solid var(--border-color);
}
</style>
