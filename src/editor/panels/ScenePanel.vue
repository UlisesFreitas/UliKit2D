<script setup lang="ts">
import { ref, onMounted, onUnmounted, watch, computed } from 'vue';
import { instance as engine } from '../../engine/core/Engine';
import { GizmoManager } from '../gizmos/GizmoManager';
import { world } from '../../engine/ecs/ECS';
import { useEditorStore } from '../../stores/useEditorStore';
import SceneToolbar from '../components/SceneToolbar.vue';
import Toolbar from '../components/Toolbar.vue';
import { projectState } from '../managers/ProjectManager';

// Force Rebuild
const container = ref<HTMLElement | null>(null);
let gizmoManager: GizmoManager;

onMounted(async () => {
    if (container.value) {
        await engine.init(container.value);
        engine.start();
        
        const store = useEditorStore();
        
        // Setup Selection Callback
        if (engine.renderSystem) {
             engine.renderSystem.onEntityClicked = (id) => {
                 store.selectEntity(id);
             };
        }
        
        if (engine.editorDebugSystem) {
            engine.editorDebugSystem.onEntityClicked = (id) => {
                store.selectEntity(id);
            };
        }

        gizmoManager = new GizmoManager();
        
        // Grid System
        const { GridSystem } = await import('../systems/GridSystem');
        const grid = new GridSystem(engine.app);
        sceneGrid = grid;
        
        // Initial Draw
        grid.draw(cameraX.value, cameraY.value, zoom.value);
        
        // Redraw on Resize
        engine.app.renderer.on('resize', () => {
             grid.draw();
        });

        console.log('Scene Panel Initialized with Gizmos & Grid', gizmoManager);

        // Deselection Logic (Background Click)
        engine.app.stage.eventMode = 'static';
        // Use a massive hit area to ensure background clicks are caught anywhere
        // Or just rely on the fact that we have a grid? 
        // Better: hitArea covering the conceptual world.
        // Actually, let's try just setting it to interactive and checking target.
        // If no hitArea is defined, Pixi might only trigger on children.
        // But the GridSystem typically is there. If we click the Grid, does it bubble?
        // GridGraphics usually has pointer events disabled or ignored unless configured.
        // Let's ensure stage has a hit area.
        engine.app.stage.hitArea = new (await import('pixi.js')).Rectangle(-100000, -100000, 200000, 200000); // Huge infinite plane
        
        engine.app.stage.on('pointerdown', (e) => {
             // Only deselect if we clicked the stage directly (background)
             // or the Grid (if it catches events, which we probably want to act as background)
             const target = e.target;
             // If target is stage or grid, deselect
             // Note: checking if it's NOT a Known Entity or Gizmo
             // Easier: exact match with stage or grid
             if (target === engine.app.stage) {
                 store.selectEntity(null);
             }
        });

        // Handle Resize
        const resizeObserver = new ResizeObserver(() => {
            if (container.value) {
                engine.app.resize();
            }
        });
        resizeObserver.observe(container.value);
        
        // Watch for Project Changes
        watch(() => projectState.currentProjectPath, (newPath) => {
            if (newPath) {
                console.log('Project Changed, Resetting Scene...');
                // Clear ECS
                world.clear();
                
                // Re-init Gizmos
                if (gizmoManager) {
                    gizmoManager.dispose();
                }
                gizmoManager = new GizmoManager();
                if (snapToGrid.value) gizmoManager.snapToGrid = true;
                
                // Reset Camera
                cameraX.value = 0;
                cameraY.value = 0;
                zoom.value = 1;
                updateView();
            }
        });
    }
});

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
const showGrid = ref(true);
const snapToGrid = ref(false);

const updateGizmoSnap = (val: boolean) => {
    snapToGrid.value = val;
    if (gizmoManager) {
        gizmoManager.snapToGrid = val;
    }
}

const onWheel = (e: WheelEvent) => {
    e.preventDefault();
    const zoomFactor = 0.1;
    const direction = e.deltaY > 0 ? -1 : 1;
    let newZoom = zoom.value + (direction * zoomFactor);
    newZoom = Math.round(newZoom * 10) / 10;
    
    zoom.value = newZoom; // This triggers store update
    // updateView() will be triggered by watch
};

// Watch zoom changes to update view
watch(zoom, () => {
    updateView();
});

const onMouseDown = (e: MouseEvent) => {
    if (e.button === 1 || (e.button === 0 && e.altKey)) { // Middle click or Alt+Left
        isPanning.value = true;
        lastMouseX.value = e.clientX;
        lastMouseY.value = e.clientY;
        container.value!.style.cursor = 'grabbing';
    }
};

const onMouseMove = (e: MouseEvent) => {
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
    isPanning.value = false;
    if (container.value) container.value.style.cursor = 'default';
};

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
            sceneGrid.draw(cameraX.value, cameraY.value, zoom.value);
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
