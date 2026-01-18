<template>
    <div class="tilemap-settings-panel h-full flex flex-col bg-[var(--bg-panel)] text-[var(--text-normal)]">
        <!-- Header / Toolbar -->
        <div class="p-2 border-b border-[var(--border-color)] bg-[var(--bg-header)] font-bold flex items-center justify-between">
            <div class="flex items-center gap-2">
                <GridIcon class="w-4 h-4" />
                <span>Tilemap Settings</span>
            </div>
            
            <!-- Toolbar -->
            <div class="flex items-center gap-1">
                <!-- Power / Toggle Mode -->
                <button 
                    @click="togglePaintMode" 
                    :class="[
                        'p-1.5 rounded transition-colors',
                        tilemapStore.isPaintMode ? 'bg-green-600 text-white hover:bg-green-500' : 'bg-[var(--bg-input)] hover:bg-[var(--bg-hover)] text-[var(--text-secondary)]'
                    ]"
                    title="Toggle Paint Mode (On/Off)"
                >
                    <Power class="w-4 h-4" />
                </button>
                
                <div class="w-[1px] h-4 bg-[var(--border-color)] mx-1"></div>

                <!-- Tools (Only active if Paint Mode is on) -->
                <button 
                    @click="tilemapStore.setTool('brush')" 
                    :disabled="!tilemapStore.isPaintMode"
                    :class="[
                        'p-1.5 rounded transition-colors',
                        tilemapStore.currentTool === 'brush' && tilemapStore.isPaintMode ? 'bg-[var(--accent)] text-white' : 'hover:bg-[var(--bg-hover)] opacity-70',
                        !tilemapStore.isPaintMode ? 'opacity-60 cursor-not-allowed' : ''
                    ]"
                    title="Brush Tool"
                >
                    <Pencil class="w-4 h-4" />
                </button>

                <button 
                    @click="tilemapStore.setTool('eraser')"
                    :disabled="!tilemapStore.isPaintMode"
                    :class="[
                         'p-1.5 rounded transition-colors',
                         tilemapStore.currentTool === 'eraser' && tilemapStore.isPaintMode ? 'bg-[var(--accent)] text-white' : 'hover:bg-[var(--bg-hover)] opacity-70',
                         !tilemapStore.isPaintMode ? 'opacity-60 cursor-not-allowed' : ''
                    ]"
                    title="Eraser Tool"
                >
                    <Eraser class="w-4 h-4" />
                </button>
            </div>
        </div>

        <div v-if="activeLayer" class="flex flex-col h-full overflow-hidden">
            
            <!-- Collapsible Configuration -->
            <div class="border-b border-[var(--border-color)]">
                <div 
                    @click="isConfigOpen = !isConfigOpen"
                    class="p-2 flex justify-between items-center cursor-pointer hover:bg-[var(--bg-hover)] select-none bg-[var(--bg-base)]"
                >
                    <span class="text-xs font-bold opacity-70 uppercase">Configuration</span>
                    <span class="text-[10px]">{{ isConfigOpen ? '▼' : '▶' }}</span>
                </div>

                <div v-if="isConfigOpen" class="p-2 bg-[var(--bg-panel)] flex gap-2 items-center">
                    
                    <!-- Tileset Thumbnail -->
                    <div 
                        class="w-10 h-10 border border-[var(--border-color)] bg-black/20 rounded flex items-center justify-center cursor-pointer hover:border-[var(--accent)] group relative flex-shrink-0"
                        @click="isPickerOpen = true"
                        title="Select Tileset"
                    >
                        <img v-if="activeLayer.tileset" :src="tilesetPreviewUrl" class="w-full h-full object-cover image-pixelated">
                        <ImagePlus v-else class="w-4 h-4 opacity-50" />

                        <!-- Remove Overlay -->
                        <div v-if="activeLayer.tileset" @click.stop="removeTileset" class="absolute inset-0 bg-black/80 hidden group-hover:flex items-center justify-center text-red-500 rounded">
                            <XIcon class="w-3 h-3" />
                        </div>
                    </div>

                    <!-- Grid Controls -->
                    <div class="flex flex-col gap-1 flex-1 min-w-0" v-if="activeLayer.gridSize">
                         <div class="flex items-center gap-2">
                             <div class="flex items-center gap-1 bg-[var(--bg-input)] rounded px-1 border border-[var(--border-color)]">
                                 <span class="text-[10px] opacity-50">W</span>
                                 <input type="number" v-model.number="activeLayer.gridSize.x" @change="onGridSizeChange" class="w-8 bg-transparent text-xs text-center outline-none" min="1">
                             </div>
                             <span class="text-xs opacity-50">x</span>
                             <div class="flex items-center gap-1 bg-[var(--bg-input)] rounded px-1 border border-[var(--border-color)]">
                                 <span class="text-[10px] opacity-50">H</span>
                                 <input type="number" v-model.number="activeLayer.gridSize.y" @change="onGridSizeChange" class="w-8 bg-transparent text-xs text-center outline-none" min="1">
                             </div>
                         </div>
                         <div class="text-[9px] opacity-40 truncate" :title="activeLayer.tileset">{{ activeLayer.tileset || 'No Tileset' }}</div>
                    </div>

                </div>
            </div>

            <!-- Palette (Tile Selection) -->
            <div v-if="activeLayer.tileset" class="flex flex-col gap-2 flex-1 min-h-0 bg-[var(--bg-base)] p-2">
                 <div class="flex justify-between items-center">
                    <label class="text-xs font-bold uppercase opacity-70">Palette</label>
                    <div class="flex gap-1">
                        <button class="p-1 hover:bg-white/10 rounded" @click="zoomOut" title="Zoom Out">-</button>
                        <span class="text-xs w-8 text-center">{{ Math.round(paletteZoom * 100) }}%</span>
                        <button class="p-1 hover:bg-white/10 rounded" @click="zoomIn" title="Zoom In">+</button>
                    </div>
                 </div>
                 
                 <div class="relative overflow-auto border border-[var(--border-color)] bg-checkerboard flex-1 min-h-0" ref="paletteContainer">
                      <div :style="{ transform: `scale(${paletteZoom})`, transformOrigin: 'top left', width: 'fit-content' }">
                          <canvas ref="paletteCanvas" class="cursor-crosshair image-pixelated block" @mousedown="selectTile"></canvas>
                          
                          <!-- Selection Highlight -->
                          <div v-if="selectedTileRect" 
                               class="absolute border-2 border-[var(--accent)] pointer-events-none"
                               :style="{
                                   left: selectedTileRect.x + 'px',
                                   top: selectedTileRect.y + 'px',
                                   width: selectedTileRect.w + 'px',
                                   height: selectedTileRect.h + 'px'
                               }">
                          </div>
                      </div>
                 </div>
            </div>
            
            <div v-else class="flex-1 flex items-center justify-center opacity-30 text-xs">
                No tileset selected
            </div>

        </div>
        
        <div v-else class="p-8 text-center opacity-50 text-sm">
            Select a Layer in Hierarchy to configure its Tilemap settings.
        </div>
        
        <!-- Asset Picker Modal -->
        <Teleport to="body">
            <AssetPickerModal 
                :isOpen="isPickerOpen" 
                type="image" 
                @select="onSelectAsset" 
                @close="isPickerOpen = false" 
            />
        </Teleport>
    </div>
</template>

<script setup lang="ts">
import { ref, computed, watch, onMounted } from 'vue';
import { useResizeObserver } from '@vueuse/core';
import { SceneManager } from '../../engine/managers/SceneManager';
import { useEditorStore } from '../../stores/useEditorStore';
import { useTilemapStore } from '../stores/useTilemapStore';
import { getFileSystem } from '../../api/FileSystem';
import { resourceManager } from '../../engine/resources/ResourceManager'; // Import RM
import AssetPickerModal from '../components/modals/AssetPickerModal.vue';
import { 
    Grid as GridIcon, 
    Power, 
    Pencil, 
    Eraser, 
    ImagePlus, 
    X as XIcon 
} from 'lucide-vue-next';

const editorStore = useEditorStore();
const tilemapStore = useTilemapStore();

// Reactivity Helper: Force updates when deep properties change (like grid size)
const configVersion = ref(0);

const activeLayer = computed(() => {
    if (!editorStore.activeLayerId) return null;
    return SceneManager.getLayerById(editorStore.activeLayerId);
});

const isPickerOpen = ref(false);
const isConfigOpen = ref(true); // Default open
const tilesetPreviewUrl = ref('');
const paletteCanvas = ref<HTMLCanvasElement | null>(null);
const tilesetImage = ref<HTMLImageElement | null>(null);
const paletteZoom = ref(2); 
const paletteScale = ref({ x: 1, y: 1 });

useResizeObserver(paletteCanvas, (entries) => {
    try {
        if (!entries || !entries.length) return;
        const entry = entries[0];
        if (!entry) return; 
        
        // Robust Rect Retrieval
        const rect = entry.contentRect || (entry.target as Element)?.getBoundingClientRect();
        if (!rect) return;
        
        const width = rect.width;
        const height = rect.height;
    
        // Scale = VisualSize / InternalSize
        if (paletteCanvas.value && paletteCanvas.value.width > 0 && width > 0) {
            paletteScale.value = {
                x: width / paletteCanvas.value.width,
                y: height / paletteCanvas.value.height
            };
        }
    } catch (e) {
        // Ignore resize errors to prevent breaking app
    }
});

// Selection Logic
const selectedTileRect = computed(() => {
    // Access dependency to force update
    const _v = configVersion.value; 
    const _s = paletteScale.value;

    if (!activeLayer.value || !activeLayer.value.gridSize || tilemapStore.selectedTileId === -1 || !tilesetImage.value) return null;
    
    // Need zoom here for rect
    const z = paletteZoom.value;
    const gw = activeLayer.value.gridSize.x * z;
    const gh = activeLayer.value.gridSize.y * z;
    
    // Original image columns
    const cols = Math.floor(tilesetImage.value.width / activeLayer.value.gridSize.x);
    
    const tileIndex = tilemapStore.selectedTileId;
    const tx = (tileIndex % cols) * gw;
    const ty = Math.floor(tileIndex / cols) * gh; 
    
    // Apply CSS Scale to visual rect (The DOM overlay is controlled by CSS pixels)
    // If gw is 96 (Z=3) but showed as 32 (Scale=0.33), then W should be 32.
    // Apply scale.
    return { 
        x: tx * paletteScale.value.x, 
        y: ty * paletteScale.value.y, 
        w: gw * paletteScale.value.x, 
        h: gh * paletteScale.value.y 
    };
});

// Zoom Controls
const zoomIn = () => { paletteZoom.value = Math.min(paletteZoom.value + 0.5, 8); };
const zoomOut = () => { paletteZoom.value = Math.max(paletteZoom.value - 0.5, 0.5); };

const loadTileset = async (path: string | undefined) => {
    if (path) {
        // Normalize path
        const normPath = path.replace(/\\/g, '/'); 
        
        try {
             tilesetPreviewUrl.value = await resourceManager.getUrl(normPath);
        } catch(e) {
             console.warn('RM failed to load URL, fallback:', e);
             tilesetPreviewUrl.value = normPath; // Fallback
        }

        const img = new Image();
        img.onload = () => {
            tilesetImage.value = img;
            drawPalette();
        };
        img.onerror = () => {
             console.warn('Failed to load tileset image:', tilesetPreviewUrl.value);
             tilesetImage.value = null; 
             drawPalette();
        };
        img.src = tilesetPreviewUrl.value;
    } else {
        tilesetPreviewUrl.value = '';
        tilesetImage.value = null;
        drawPalette();
    }
};

watch(activeLayer, (newLayer) => {
    loadTileset(newLayer?.tileset);
}, { immediate: true });

function markDirty() {
    SceneManager.setDirty(true);
}

const onSelectAsset = (path: string | string[]) => {
    if (!activeLayer.value) return;
    
    const selectedPath = Array.isArray(path) ? path[0] : path;
    if (!selectedPath) return;
    
    // Normalize and Store
    const normPath = selectedPath.replace(/\\/g, '/');
    activeLayer.value.tileset = normPath;
    
    markDirty();
    loadTileset(normPath); 
    isPickerOpen.value = false;
}

function removeTileset() {
    if (activeLayer.value) {
        activeLayer.value.tileset = undefined;
        markDirty();
        loadTileset(undefined);
    }
}

const onGridSizeChange = () => {
    markDirty();
    configVersion.value++; // Trigger reactivity
    drawPalette();
}

const togglePaintMode = () => {
    tilemapStore.setPaintMode(!tilemapStore.isPaintMode);
}

function drawPalette() {
    if (!paletteCanvas.value) return;
    const ctx = paletteCanvas.value.getContext('2d');
    if (!ctx) return;

    // Clear
    ctx.clearRect(0, 0, paletteCanvas.value.width, paletteCanvas.value.height);

    if (!tilesetImage.value || !activeLayer.value?.gridSize) return;

    // SCALED DRAWING - Anti-Blur
    const z = paletteZoom.value;
    const w = tilesetImage.value.width * z;
    const h = tilesetImage.value.height * z;

    // Resize Canvas (Reset Context state)
    paletteCanvas.value.width = w;
    paletteCanvas.value.height = h;

    // Set Nearest Neighbor AFTER resize
    ctx.imageSmoothingEnabled = false;

    // Draw Image Scaled
    ctx.drawImage(tilesetImage.value, 0, 0, w, h);

    // Draw Grid Overlay Scaled
    const gw = activeLayer.value.gridSize.x * z;
    const gh = activeLayer.value.gridSize.y * z;
    
    ctx.strokeStyle = 'rgba(255, 255, 255, 0.3)';
    ctx.beginPath();
    
    for (let x = 0; x <= w; x += gw) {
        ctx.moveTo(x, 0);
        ctx.lineTo(x, h);
    }
    for (let y = 0; y <= h; y += gh) {
        ctx.moveTo(0, y);
        ctx.lineTo(w, y);
    }
    ctx.stroke();
}

watch(paletteZoom, () => {
    drawPalette();
});

function selectTile(e: MouseEvent) {
    if (!tilesetImage.value || !activeLayer.value?.gridSize || !paletteCanvas.value) return;
    
    // Get Scaling Ratio (Canvas Internal Pixels / Display Pixels)
    const canvas = paletteCanvas.value;
    const rect = canvas.getBoundingClientRect();
    
    // Check if rect is invalid (0)
    if (rect.width === 0 || rect.height === 0) return;

    const scaleX = canvas.width / rect.width;
    const scaleY = canvas.height / rect.height;

    // Local Coordinates in Canvas Pixels
    const x = (e.clientX - rect.left) * scaleX;
    const y = (e.clientY - rect.top) * scaleY;

    const z = paletteZoom.value;
    const gw = activeLayer.value.gridSize.x;
    const gh = activeLayer.value.gridSize.y;
    
    // Map to tile coordinates (use zoomed grid size gw*z)
    const col = Math.floor(x / (gw * z));
    const row = Math.floor(y / (gh * z));
    const cols = Math.floor(tilesetImage.value.width / gw);
    
    // Bounds check
    if (col < 0 || row < 0 || col >= cols || row * gh >= tilesetImage.value.height) return;

    const index = row * cols + col;
    tilemapStore.setSelectedTile(index);
}
</script>

<style scoped>
.input-tiny {
    background-color: var(--bg-input);
    border: 1px solid var(--border-color);
    border-radius: 0.25rem;
    padding: 0.1rem 0.25rem;
    font-size: 0.75rem;
    width: 100%;
}
.bg-checkerboard {
    background-image:
      linear-gradient(45deg, #1e1e1e 25%, transparent 25%),
      linear-gradient(-45deg, #1e1e1e 25%, transparent 25%),
      linear-gradient(45deg, transparent 75%, #1e1e1e 75%),
      linear-gradient(-45deg, transparent 75%, #1e1e1e 75%);
    background-size: 10px 10px;
    background-position: 0 0, 0 5px, 5px -5px, -5px 0px;
    background-color: #252526;
}
</style>
