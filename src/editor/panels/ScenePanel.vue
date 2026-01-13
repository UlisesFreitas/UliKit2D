<script setup lang="ts">
import { ref, onMounted, onUnmounted, watch, computed } from 'vue';
import { Rectangle } from 'pixi.js';
import { instance as engine } from '../../engine/core/Engine';
import { GizmoManager } from '../gizmos/GizmoManager';
import { world } from '../../engine/ecs/ECS';
import { useEditorStore } from '../../stores/useEditorStore';
import { usePreferencesStore } from '../../stores/usePreferencesStore';
import SceneToolbar from '../components/SceneToolbar.vue';
import Toolbar from '../components/Toolbar.vue';
import { projectState } from '../managers/ProjectManager';
import { CoordinateUtils } from '../../engine/utils/CoordinateUtils';

import { EditorTilemapSystem } from '../systems/EditorTilemapSystem';


const container = ref<HTMLElement | null>(null);
let gizmoManager: GizmoManager;
let tilemapSystem: EditorTilemapSystem; 

import { SceneManager } from '../../engine/managers/SceneManager';

onMounted(async () => {
    if (container.value) {
        (window as any).engine = engine; // Expose for debug
        await engine.init(container.value);
        engine.start();
        
        // ... (store, selection setup) ...

        gizmoManager = new GizmoManager();
        gizmoManager.getGridSizeCallback = (layerId) => {
             const layer = SceneManager.getLayerById(layerId);
             return layer?.gridSize;
        };
        
        
        // Tilemap System
        tilemapSystem = new EditorTilemapSystem(engine.app);
        engine.app.ticker.add(() => tilemapSystem.update());
        // Initial Dirty Mark
        tilemapSystem.markDirty();
        
        // Grid System
        const { GridSystem } = await import('../systems/GridSystem');
        const grid = new GridSystem(engine.app);
        sceneGrid = grid;
        
        // Initial Draw
        if (preferencesStore.grid.visible) {
             grid.draw(cameraX.value, cameraY.value, zoom.value, preferencesStore.grid);
        }
        
        // Redraw on Resize
        engine.app.renderer.on('resize', () => {
             if(preferencesStore.grid.visible) grid.draw(cameraX.value, cameraY.value, zoom.value, preferencesStore.grid);
        });



        // Global Selection Logic (Stage Click)
        engine.app.stage.eventMode = 'static';
        // HitArea massive to ensure stage captures all background clicks
        engine.app.stage.hitArea = new Rectangle(-100000, -100000, 200000, 200000);
        
        engine.app.stage.on('pointerdown', (e) => {
             // Only Left Click, No Alt (Pan), No Tilemap Mode
             if (e.button === 0 && !e.altKey && !isTilemapMode.value) {
                  // If Gizmo handled this, it would have stopped propagation. 
                  // So if we are here, we act on the Scene.

                  const screenX = e.global.x;
                  const screenY = e.global.y;
                  
                  // Use Pixi's native transform to get World Pos (Stage Local)
                  const worldPos = engine.app.stage.toLocal(e.global);

                  // console.log(`[Selection] Raw Global: ${screenX.toFixed(2)}, ${screenY.toFixed(2)}`);
                  // console.log(`[Selection] Pixi World: ${worldPos.x.toFixed(2)}, ${worldPos.y.toFixed(2)}`);
                  // console.log(`[Selection] Camera: ${cameraX.value}, ${cameraY.value} Zoom: ${zoom.value}`);

                  // Raycast / Hit Test
                  // 1. Get Entities Sorted by Z-Index (Top to Bottom)
                  const entities = world.entities.slice().sort((a, b) => {
                       const zA = a.transform?.zIndex || 0;
                       const zB = b.transform?.zIndex || 0;
                       return zB - zA;
                  });

                  let foundId: string | null = null;
                  
                  for (const entity of entities) {
                      if (!entity.transform || !entity.visible === false) continue; // Skip invisible? visible is explicit false check

                      // Get Visual Bounds from RenderSystem
                      const displayObject = engine.renderSystem.getDisplayObject(entity.id!);
                      
                      if (CoordinateUtils.isPointInEntity(worldPos, entity, displayObject, e.global)) {
                           foundId = entity.id!;
                           // Special Case: Locked Layers/Entities? 
                           // For now, allow selecting anything.
                           break;
                      }
                  }
                  
                  store.selectEntity(foundId); // Selects Entity or Null (Deselect)
             }
        });
        
        // ...
        
        // Watch for Project Changes
        watch(() => projectState.currentProjectPath, (newPath) => {
            if (newPath) {
                 // ...
                 world.clear();
                 // ...
                 tilemapSystem.markDirty(); // Re-scan layers
                 // ...
            }
        });
        
        // Also watch Scene Load?
        // If we load a scene JSON, SceneManager layers change completely.
        // We need to mark dirty.
        // SceneManager doesn't emit events easily. 
        // But we can watch `SceneManager.isDirty` or rely on `update()` checking order?
        // My `update` checks order. So if layers change ID/Count, it rebuilds.
        // But if tileData changes via Load, we might miss it if we don't mark dirty.
        // Let's add a watch for `SceneManager.layers`? Deep watch? Expensive.
        // Better: Hook into logic or rely on manual trigger.
        // For PAINTING (User input), we have `paintTile`.
        // For LOADING: Component re-mounts? No.
        // If user loads scene, `ScenePanel` stays mounted.
        // `SceneManager.loadScene` is called.
        // Maybe we just poll `markDirty` every second? No.
        // `engine.app.ticker` runs every frame.
        // Let's rely on `paintTile` marking dirty for painting.
        // For loading, we might need a signal. `EventBus`?
        
    }
});
// ...



onUnmounted(() => {
    if (gizmoManager) {
        gizmoManager.dispose();
    }
});

const onDrop = (e: DragEvent) => {
    const path = e.dataTransfer?.getData('text/plain');
    if (!path) return;
    
    // Convert screen coordinates to world coordinates
    const rect = container.value?.getBoundingClientRect();
    if (!rect) return;
    
    const screenX = e.clientX - rect.left;
    const screenY = e.clientY - rect.top;
    
    const worldX = (screenX - cameraX.value) / zoom.value;
    const worldY = (screenY - cameraY.value) / zoom.value;

    console.log('Dropped on Scene:', path);
    // Determine type by extension
    if (path.endsWith('.png') || path.endsWith('.jpg')) {
        // Create Sprite Entity
        world.add({
            id: crypto.randomUUID(),
            name: 'New Sprite',
            transform: { x: worldX, y: worldY, rotation: 0, scale: { x: 1, y: 1 } },
            sprite: { texture: path }
        });
    }
};

// Camera State
const cameraX = ref(0);
const cameraY = ref(0);
const store = useEditorStore();

const zoom = computed({
    get: () => store.zoomLevel,
    set: (val) => store.setZoom(val)
});

const isPanning = ref(false);
const lastMouseX = ref(0);
const lastMouseY = ref(0);

// Tool State
const preferencesStore = usePreferencesStore();
const showGrid = computed({
    get: () => preferencesStore.grid.visible,
    set: (val: boolean) => preferencesStore.grid.visible = val
});
const snapToGrid = ref(false);

const updateGizmoSnap = (val: boolean) => {
    snapToGrid.value = val;
    if (gizmoManager) {
        gizmoManager.snapToGrid = val;
    }
}

const onWheel = (e: WheelEvent) => {
    e.preventDefault();
    const direction = e.deltaY > 0 ? -1 : 1;
    
    // Dynamic Zoom Factor
    const zoomFactor = Math.max(0.1, zoom.value * 0.1);
    
    // Limits
    const minZoom = 0.1;
    const maxZoom = 15.0; 
    
    const prevZoom = zoom.value;
    let newZoom = prevZoom + (direction * zoomFactor);
    newZoom = Math.max(minZoom, Math.min(maxZoom, Math.round(newZoom * 10) / 10));

    if (newZoom === prevZoom) return;

    if (container.value) {
        const rect = container.value.getBoundingClientRect();
        const mouseX = e.clientX - rect.left;
        const mouseY = e.clientY - rect.top;

        // Current World Pos
        const worldX = (mouseX - cameraX.value) / prevZoom;
        const worldY = (mouseY - cameraY.value) / prevZoom;

        // Apply new zoom
        zoom.value = newZoom;

        // Adjust Camera to keep Mouse over same World Pos
        cameraX.value = mouseX - (worldX * newZoom);
        cameraY.value = mouseY - (worldY * newZoom);
    } else {
        zoom.value = newZoom;
    }
};

// Watch zoom changes to update view
watch(zoom, () => {
    updateView();
});

watch(() => preferencesStore.grid, () => {
    updateView();
}, { deep: true });

// ... imports
import { useTilemapStore } from '../stores/useTilemapStore';

import type { SceneLayer } from '../../engine/managers/SceneManager';

// ... (existing state)

const tilemapStore = useTilemapStore();
const activeLayer = computed<SceneLayer | null>(() => {
    if (!store.activeLayerId) return null;
    return SceneManager.getLayerById(store.activeLayerId);
});

const isTilemapMode = computed(() => {
    // Only if active layer has tile properties AND we are in Paint Mode
    if (!store.activeLayerId) return false;
    const layer = SceneManager.getLayerById(store.activeLayerId);
    return !!(layer?.tileData) && tilemapStore.isPaintMode;
});

const isPainting = ref(false);

const paintTile = (e: MouseEvent, erase = false) => {
    if (!isTilemapMode.value || !activeLayer.value || !container.value) return;

    // Convert to Grid Coords
    // Use Canvas Rect for accurate offsets (handles flex centering/padding)
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
    
    const key = `${gx},${gy}`;
    const currentId = activeLayer.value.tileData![key];
    const targetId = erase ? undefined : tilemapStore.selectedTileId;

    if (currentId !== targetId) {
        if (targetId === undefined) {
            delete activeLayer.value.tileData![key];
        } else {
            activeLayer.value.tileData![key] = targetId;
        }
        SceneManager.setDirty(true);
        if (tilemapSystem) tilemapSystem.markDirty(activeLayer.value.id);
    }
};

const onMouseDown = (e: MouseEvent) => {
    // Priority: Tilemap Painting -> Panning/Select
    // If Left Click + Tilemap Mode -> Paint
    // If Right Click + Tilemap Mode -> Erase
    
    if (isTilemapMode.value && (e.button === 0 || e.button === 2) && !e.altKey) {
        isPainting.value = true;
        
        const isRightClick = e.button === 2;
        const isEraserTool = tilemapStore.currentTool === 'eraser';
        const isErase = isRightClick || isEraserTool;

        paintTile(e, isErase);
        return; // Consume event
    }

    if (e.button === 1 || (e.button === 0 && e.altKey)) { // Middle click or Alt+Left
        isPanning.value = true;
        lastMouseX.value = e.clientX;
        lastMouseY.value = e.clientY;
        container.value!.style.cursor = 'grabbing';
    }
};

// ...
const highlightGraphics = ref<any>(null);
const gridGraphics = ref<any>(null);



const drawGrid = () => {
    if (!gridGraphics.value) return;

    const graphics = gridGraphics.value;
    graphics.clear();
    
    // Pixi v8: Build path then stroke
    const w = 2000;
    const h = 2000;
    const step = 32;

    for (let x = 0; x <= w; x += step) {
        graphics.moveTo(x, 0);
        graphics.lineTo(x, h);
    }
    for (let y = 0; y <= h; y += step) {
        graphics.moveTo(0, y);
        graphics.lineTo(w, y);
    }
    
    graphics.stroke({ width: 1, color: 0x333333, alpha: 0.5 });
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
    
    // Style based on Tool
    const isEraser = tilemapStore.currentTool === 'eraser';
    const color = isEraser ? 0xFF0000 : 0x00FF00;

    // Draw
    const g = highlightGraphics.value;
    g.clear();
    
    // Pixi v8 API
    g.rect(tx, ty, gridSize.x, gridSize.y);
    g.fill({ color: color, alpha: 0.2 });
    g.stroke({ width: 2, color: color, alpha: 1 });
};

const onMouseMove = (e: MouseEvent) => {
    let rect: DOMRect | undefined;
    try {
        rect = engine.app?.canvas?.getBoundingClientRect();
    } catch (e) {
        // Pixi getter might throw if not ready
    }

    // Fallback
    if (!rect) {
        rect = container.value?.getBoundingClientRect();
    }

    if (rect) {
        updateHighlight(e.clientX - rect.left, e.clientY - rect.top);
    }
    
    if (isPainting.value) {
        const isRightClick = (e.buttons & 2) === 2;
        const isEraserTool = tilemapStore.currentTool === 'eraser';
        const isErase = isRightClick || isEraserTool;
        
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

// ...

const onMouseUp = () => {
    isPainting.value = false;
    isPanning.value = false;
    if (container.value) container.value.style.cursor = 'default';
};

// ... (rest of file)

const updateView = () => {
    // Update Stage Transform
    if (engine.app && engine.app.stage) {
        engine.app.stage.position.set(cameraX.value, cameraY.value);
        engine.app.stage.scale.set(zoom.value);
    }
    
    // Grid System
    if (sceneGrid) {
        if (showGrid.value) {
            sceneGrid.gridGraphics.visible = true; // Ensure visible
            sceneGrid.draw(cameraX.value, cameraY.value, zoom.value, preferencesStore.grid);
        } else {
             sceneGrid.gridGraphics.visible = false;
        }
    }
};

let sceneGrid: any = null;

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
  display: flex;
  align-items: center;
  justify-content: center;
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
