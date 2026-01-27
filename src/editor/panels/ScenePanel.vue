<script setup lang="ts">
import { ref, onMounted, onUnmounted, watch, computed } from 'vue';
import { Graphics } from 'pixi.js';
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
const hoveredEntityDebug = ref<any>(null); // New Entity Info Debug
const highlightGraphics = ref<any>(null); // For Tilemap highlight
const activeKeys = ref<string[]>([]); // Input Debug

// Sync Keys
let inputInterval: any;
onMounted(() => {
    inputInterval = setInterval(() => {
        if ((window as any).Input) {
            activeKeys.value = (window as any).Input.activeKeys;
        }
    }, 100);
});

onUnmounted(() => {
    if (inputInterval) clearInterval(inputInterval);
});

const debugLayers = ref<{name: string, enabled: boolean}[]>([]);
const isDebugCollapsed = ref(false);
const showDebugPanel = ref(false);

const toggleDebugLayer = (layer: {name: string, enabled: boolean}) => {
    layer.enabled = !layer.enabled;
    if (engine.editorDebugSystem) {
        engine.editorDebugSystem.toggleLayer(layer.name, layer.enabled);
    }
};

const sceneVersion = ref(0); // Force update on scene reload

eventBus.on('scene-loaded', () => {
    console.log('[ScenePanel] Scene Loaded Event. Version++');
    sceneVersion.value++;
});
eventBus.on('layer-update', () => sceneVersion.value++);

const activeLayer = computed<SceneLayer | null>(() => {
    // Dependency
    sceneVersion.value;
    if (!store.activeLayerId) return null;
    const l = SceneManager.getLayerById(store.activeLayerId);
    // Debug Log
    //console.log(`[ScenePanel] Active Layer Computed: ${store.activeLayerId} -> ${l ? 'Found' : 'Null'}`, l);
    return l;
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

    // Canvas Offset Calculation
    // screenX/Y are clientX/Y. We need Canvas Space.
    let canvasOffsetX = 0;
    let canvasOffsetY = 0;
    if (engine.app && engine.app.canvas) {
        const rect = engine.app.canvas.getBoundingClientRect();
        canvasOffsetX = rect.left;
        canvasOffsetY = rect.top;
    }

    // World Coords (Mouse relative to Canvas - Camera)
    const worldX = ((screenX - canvasOffsetX) - cameraX.value) / zoom.value;
    const worldY = ((screenY - canvasOffsetY) - cameraY.value) / zoom.value;
    
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



const paintTile = (e: MouseEvent | PointerEvent, erase = false) => {
    if (!isTilemapMode.value || !activeLayer.value || !container.value) return;

    // Canvas Offset (Robustness)
    let canvasOffsetX = 0;
    let canvasOffsetY = 0;
    if (engine.app && engine.app.canvas) {
        const rect = engine.app.canvas.getBoundingClientRect();
        canvasOffsetX = rect.left;
        canvasOffsetY = rect.top;
    }

    // Use Global Screen Coords -> Canvas Coords
    const screenX = e.clientX;
    const screenY = e.clientY;
    
    // World Coords
    const worldX = ((screenX - canvasOffsetX) - cameraX.value) / zoom.value;
    const worldY = ((screenY - canvasOffsetY) - cameraY.value) / zoom.value;
    
    // Grid Coords
    const gridSize = activeLayer.value.gridSize || { x: 32, y: 32 };
    const gx = Math.floor(worldX / gridSize.x);
    const gy = Math.floor(worldY / gridSize.y);
    
    // Debug Log for Eraser
    if (erase) {
        console.log(`[ScenePanel] Eraser Input: Screen(${screenX},${screenY}) -> Grid(${gx},${gy})`);
    }

    if (!activeLayer.value.tileData) return;

    const key = `${gx},${gy}`;
    const currentId = activeLayer.value.tileData[key];
    const targetId = erase ? undefined : tilemapStore.selectedTileId;

    if (currentId !== targetId) {
        if (targetId === undefined) {
             console.log(`[ScenePanel] Deleting Tile at ${gx},${gy}`);
             delete activeLayer.value.tileData[key];
        } else {
             // console.log(`[ScenePanel] Painting Tile at ${gx},${gy} ID:${targetId} Layer:${activeLayer.value.name}`);
             activeLayer.value.tileData[key] = targetId;
        }
        
        SceneManager.setDirty(true);
        // Optimized: Only update THIS layer
        eventBus.emit('layer-update', activeLayer.value.id);
    }
};

// ------------------------------------------------------------------
// EVENTS
// ------------------------------------------------------------------

// Helper for Local-to-World Conversion
const getMouseWorld = (clientX: number, clientY: number) => {
    // Robust Canvas Offset Calculation
    let canvasOffsetX = 0;
    let canvasOffsetY = 0;
    if (engine.app && engine.app.canvas) {
        const rect = engine.app.canvas.getBoundingClientRect();
        canvasOffsetX = rect.left;
        canvasOffsetY = rect.top;
    }
    
    // Safety check
    if (!container.value) return { x: 0, y: 0, screenX: clientX - canvasOffsetX, screenY: clientY - canvasOffsetY };

    const mouseX = clientX - canvasOffsetX;
    const mouseY = clientY - canvasOffsetY;
    
    const worldX = (mouseX - cameraX.value) / zoom.value;
    const worldY = (mouseY - cameraY.value) / zoom.value;
    
    return { x: worldX, y: worldY, screenX: mouseX, screenY: mouseY };
};

const onWheel = (e: WheelEvent) => {
    e.preventDefault();
    
    const { x: worldX, y: worldY, screenX: mouseX, screenY: mouseY } = getMouseWorld(e.clientX, e.clientY);

    const direction = e.deltaY > 0 ? -1 : 1;
    const zoomFactor = Math.max(0.1, zoom.value * 0.1);
    const minZoom = 0.1;
    const maxZoom = 64.0; 
    
    const prevZoom = zoom.value;
    let newZoom = prevZoom + (direction * zoomFactor);
    newZoom = Math.max(minZoom, Math.min(maxZoom, Math.round(newZoom * 10) / 10));

    if (newZoom === prevZoom) return;

    // Zoom Towards Point logic:
    // We want the World Point under Mouse to stay at the same Screen Point.
    // Screen = Camera + World * Zoom
    // Camera_New = Screen - World * Zoom_New
    
    zoom.value = newZoom;
    const actualZoom = zoom.value;

    if (actualZoom === prevZoom) return;
    
    cameraX.value = mouseX - (worldX * actualZoom);
    cameraY.value = mouseY - (worldY * actualZoom);
    
    updateView();
    updateHighlight(e.clientX, e.clientY);
};

const onPointerDown = async (e: PointerEvent) => {
    (document.activeElement as HTMLElement)?.blur();

    // Use Helper for consistency
    const { screenX: mouseX, screenY: mouseY } = getMouseWorld(e.clientX, e.clientY);

    // 1. Painting (HIGHEST PRIORITY)
    if (isTilemapMode.value && (e.buttons === 1 || e.buttons === 2) && !e.altKey) {
        isPainting.value = true;
        const isErase = e.buttons === 2 || tilemapStore.currentTool === 'eraser';
        paintTile(e, isErase);
        (e.target as Element).setPointerCapture(e.pointerId);
        return; 
    }

    // 2. Gizmo Interaction
    if (e.buttons === 1 && !e.altKey) { 
        const { instance: gizmoManager } = await import('../gizmos/GizmoManager');
        const { instance: areaSelectionManager } = await import('../managers/AreaSelectionManager');
        const { instance: selectionManager } = await import('../managers/SelectionManager');

        const gizmoRes = gizmoManager.processPointerDown(mouseX, mouseY);
        
        if (gizmoRes) {
            (e.target as Element).setPointerCapture(e.pointerId);
            return;
        }
        
        const hitId = selectionManager.hitTest(mouseX, mouseY);
        
        if (hitId) {
            store.selectEntity(hitId);
        } else {
            if (!e.shiftKey && !e.ctrlKey) {
                store.selectEntity(null);
            }
            areaSelectionManager.startDrag(mouseX, mouseY);
            (e.target as Element).setPointerCapture(e.pointerId); 
        }
    }

    // 3. Panning
    if (e.buttons === 4 || (e.buttons === 1 && e.altKey)) { 
        isPanning.value = true;
        lastMouseX.value = e.clientX; 
        lastMouseY.value = e.clientY;
        container.value!.style.cursor = 'grabbing';
        (e.target as Element).setPointerCapture(e.pointerId); 
    }
};

const onPointerMove = async (e: PointerEvent) => {
    // Use Helper
    const { x: worldX, y: worldY, screenX: sx, screenY: sy } = getMouseWorld(e.clientX, e.clientY);
    
    // Proxy to Gizmo
    const { instance: gizmoManager } = await import('../gizmos/GizmoManager');
    gizmoManager.processPointerMove(sx, sy, e.shiftKey);
    
    // Update Hover State
    const { instance: selectionManager } = await import('../managers/SelectionManager');
    selectionManager.updateHover(sx, sy);

    // Update Overlay Debug Info
    if (selectionManager.hoveredEntityId) {
        const ent = world.with('id', 'transform').where(e => e.id === selectionManager.hoveredEntityId).first;
        if (ent && ent.transform) {
             hoveredEntityDebug.value = {
                 id: ent.id,
                 name: ent.name || 'Entity',
                 x: Math.round(ent.transform.x),
                 y: Math.round(ent.transform.y),
                 layer: ent.layer || 'Base Layer',
                 zIndex: ent.transform.zIndex || 0,
                 scaleX: ent.transform.scale?.x.toFixed(2) || '1.00',
                 scaleY: ent.transform.scale?.y.toFixed(2) || '1.00',
                 rotation: Math.round((ent.transform.rotation || 0) * (180/Math.PI))
             };
        }
    } else {
        hoveredEntityDebug.value = null;
    }

    // Proxy to Area Selection
    const { instance: areaSelectionManager } = await import('../managers/AreaSelectionManager');
    areaSelectionManager.updateDrag(sx, sy);
    
    updateHighlight(e.clientX, e.clientY);
    
    // Debug Update
    debugInfo.value.screen = { x: Math.round(sx), y: Math.round(sy) };
    debugInfo.value.world = { 
        x: Math.round(worldX), 
        y: Math.round(worldY) 
    };
    
    if (isPainting.value) {
        const isErase = (e.buttons === 2) || tilemapStore.currentTool === 'eraser'; 
        paintTile(e, isErase);
        return;
    }

    if (isPanning.value) {
        // Panning logic: Delta Screen -> Delta Camera
        // Since getMouseWorld returns Canvas Relative, we can use clientX delta safely
        // But let's use the stored lastMouseX (Global) to match e.clientX (Global)
        const dx = e.clientX - lastMouseX.value;
        const dy = e.clientY - lastMouseY.value;
        
        cameraX.value += dx;
        cameraY.value += dy;
        
        lastMouseX.value = e.clientX;
        lastMouseY.value = e.clientY;
        
        updateView();
    }
};

const onPointerUp = async (e: PointerEvent) => {
    isPainting.value = false;
    isPanning.value = false;
    if (container.value) container.value.style.cursor = 'default';

    // RELEASE POINTER CAPTURE
    (e.target as Element).releasePointerCapture(e.pointerId);
    
    // Release Gizmo
    const { instance: gizmoManager } = await import('../gizmos/GizmoManager');
    gizmoManager.processPointerUp();
    
    const { instance: areaSelectionManager } = await import('../managers/AreaSelectionManager');
    areaSelectionManager.endDrag(e.shiftKey, e.ctrlKey);
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
            layer: store.activeLayerId || 'Base Layer', // Use active layer!
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

         // Initialize Tilemap Highlight
         highlightGraphics.value = new Graphics();
         highlightGraphics.value.zIndex = 99999; // Top
         highlightGraphics.value.eventMode = 'none';
         engine.app.stage.addChild(highlightGraphics.value);

         // Sync Debug Layers
         if (engine.editorDebugSystem) {
             debugLayers.value = engine.editorDebugSystem.layers.map(l => ({
                 name: l.name,
                 enabled: l.enabled
             }));
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

import { Check } from 'lucide-vue-next';
</script>

<template>
  <div
    class="scene-panel" 
    ref="container" 
    tabindex="0"
    @dragover.prevent 
    @drop.prevent="onDrop"
    @wheel="onWheel"
    @pointerdown="onPointerDown"
    @pointermove="onPointerMove"
    @pointerup="onPointerUp"
    @pointerleave="onPointerUp"
    @contextmenu.prevent
  >
    <!-- Overlay UI Only - No Canvas -->
    
<!-- Input Debugger -->
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
             
             <!-- Extended Input Debug -->
             <div class="col-span-2 mt-2 border-t border-gray-700 pt-1 text-[10px] text-gray-400">
                <div>Keys: <span class="text-white font-mono break-all">{{ activeKeys.join(', ') || 'None' }}</span></div>
                <div>Diff: <span class="text-white">{{ activeKeys.length }}</span></div>
             </div>
        </div>
    </div>

    <!-- Entity Hover Info Overlay (New) -->
    <div v-if="hoveredEntityDebug" class="absolute top-4 left-4 bg-black/70 text-white p-2 rounded text-xs z-[101] font-mono pointer-events-none select-none border border-gray-700 shadow-lg">
        <div class="font-bold text-white-400 mb-1 border-b border-gray-600 uppercase">{{ hoveredEntityDebug.name }}</div>
        <div class="grid grid-cols-2 gap-x-4 gap-y-1">
             <span class="text-white-400">ID:</span>
             <span class="truncate max-w-[120px]" :title="hoveredEntityDebug.id">{{ hoveredEntityDebug.id }}</span>

             <span class="text-white-400">Pos:</span>
             <span class="text-white-400">{{ hoveredEntityDebug.x }}, {{ hoveredEntityDebug.y }}</span>
             
             <span class="text-white-400">Layer:</span>
             <span class="text-white-200">{{ hoveredEntityDebug.layer }}</span>
             
             <span class="text-white-400">Z-Index:</span>
             <span>{{ hoveredEntityDebug.zIndex }}</span>

             <span class="text-white-400">Scale:</span>
             <span>{{ hoveredEntityDebug.scaleX }}x, {{ hoveredEntityDebug.scaleY }}x</span>

             <span class="text-white-400">Rot:</span>
             <span>{{ hoveredEntityDebug.rotation }}°</span>
        </div>
    </div>

    <!-- Overlay Toolbar (Bottom Center) -->
    <div class="absolute top-4 left-1/2 transform -translate-x-1/2 z-[100]">
        <Toolbar />
    </div>

    <!-- Debug Layers Panel (Bottom Right) -->
    <div v-if="showDebugPanel" class="absolute bottom-4 right-4 bg-black/80 text-white p-2 rounded z-[101] font-mono select-none border border-gray-700 shadow-lg min-w-[200px]">
        <div class="font-bold text-yellow-400 mb-1 border-b border-gray-600 flex justify-between items-center cursor-pointer" @click="isDebugCollapsed = !isDebugCollapsed">
            <span>DEBUG TOOLS</span>
            <span class="text-xs">{{ isDebugCollapsed ? '+' : '-' }}</span>
        </div>
        
        <div v-if="!isDebugCollapsed" class="flex flex-col space-y-1 mt-2">
            <div 
                v-for="layer in debugLayers" 
                :key="layer.name" 
                class="flex items-center space-x-2 p-1 hover:bg-white/10 rounded cursor-pointer text-xs"
                @click="toggleDebugLayer(layer)"
            >
                <div class="w-4 h-4 border border-gray-500 rounded flex items-center justify-center bg-black/50">
                     <Check v-if="layer.enabled" :size="12" class="text-green-400" />
                </div>
                <span :class="{'text-white': layer.enabled, 'text-gray-400': !layer.enabled}">{{ layer.name }}</span>
            </div>
            
            <!-- Quick Actions (if any) -->
            <div class="border-t border-gray-700 mt-2 pt-1 text-[10px] text-gray-500 italic text-center">
                 Click to toggle layers
            </div>
        </div>
    </div>

    <!-- Overlay Toolbar (Bottom Center) -->
    <div class="absolute bottom-6 left-1/2 transform -translate-x-1/2 z-[100] pb-2">
        <SceneToolbar 
            v-model:zoom="zoom"
            v-model:showGrid="showGrid"
            v-model:showDebugPanel="showDebugPanel"
            :snapToGrid="snapToGrid"
            @update:zoom="val => { zoom = val; updateView(); }"
             @update:snapToGrid="val => { 
                snapToGrid = val; 
                import('../gizmos/GizmoManager').then(m => {
                    m.instance.snapToGrid = val;
                    // Inject Grid Size Callback if enabling or just always ensure it's there
                    m.instance.getGridSizeCallback = () => ({ 
                        x: preferencesStore.grid.width, 
                        y: preferencesStore.grid.height 
                    });
                }); 
            }"
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
