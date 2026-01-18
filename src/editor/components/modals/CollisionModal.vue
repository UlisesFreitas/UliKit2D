<script setup lang="ts">
import { ref, onMounted, onUnmounted, watch, computed, nextTick } from 'vue';
import { getFileSystem } from '../../../api/FileSystem';

const props = defineProps<{
    isOpen: boolean;
    entity: any; 
    animator?: any;
}>();

const emit = defineEmits(['close', 'save']);

const containerRef = ref<HTMLElement | null>(null);
const textureUrl = ref('');
const vertices = ref<{ x: number, y: number, id: string }[]>([]);

// Selection State
const mode = ref<'global' | 'animation'>('global');
const selectedAnim = ref('');
const selectedFrame = ref(0);

// Viewport State
const zoom = ref(16); 
const viewCenter = ref({ x: 400, y: 350 });

// Image State
const naturalWidth = ref(0);
const naturalHeight = ref(0);
const autoResetOnLoad = ref(false);

// Helper
const uid = () => Math.random().toString(36).substr(2, 9);

const updateCenter = () => {
    if (containerRef.value) {
        viewCenter.value = {
            x: containerRef.value.clientWidth / 2,
            y: containerRef.value.clientHeight / 2
        };
    }
};

onMounted(() => {
    window.addEventListener('resize', updateCenter);
});
onUnmounted(() => {
    window.removeEventListener('resize', updateCenter);
});

// --- Logic ---
const hasAnimator = computed(() => !!props.animator);
const currentMaxFrames = computed(() => {
    if (!props.animator || !selectedAnim.value) return 1;
    const anim = props.animator.animations[selectedAnim.value];
    return anim ? anim.frames.length : 1;
});

const loadCurrentContext = async () => {
    if (!props.entity) return;

    let path = '';
    let initialVerts: any[] = [];
    
    // 1. Determine Texture Path & Vertex Source
    if (mode.value === 'animation' && props.animator && selectedAnim.value) {
        // Animation Mode
        const animData = props.animator.animations[selectedAnim.value];
        if (animData && animData.frames[selectedFrame.value]) {
            path = animData.frames[selectedFrame.value];
        }
        
        // Vertices
        const frameVerts = props.entity.polygonCollider?.frames?.[selectedAnim.value]?.[selectedFrame.value];
        if (frameVerts) {
            initialVerts = frameVerts;
        } else {
             // Fallback to Global
             if (props.entity.polygonCollider?.vertices) {
                 initialVerts = props.entity.polygonCollider.vertices;
             }
        }
    } else {
        // Global Mode
        path = props.entity.sprite?.texture || props.entity.nineSliceSprite?.texture || '';
        if (props.entity.polygonCollider?.vertices) {
            initialVerts = props.entity.polygonCollider.vertices;
        }
    }

    // 2. Load Texture
    if (path) {
        textureUrl.value = await getFileSystem().getAssetURL(path);
    } else {
        textureUrl.value = '';
    }

    // 3. Load Vertices
    if (initialVerts && initialVerts.length > 0) {
        vertices.value = initialVerts.map((v: any) => ({ ...v, id: uid() }));
        autoResetOnLoad.value = false;
    } else {
        // Default Box (Wait for image)
        autoResetOnLoad.value = true;
        resetToBox();
    }
};

const resetToBox = () => {
    // Default box matches image size if available, else generic 32x32
    const w = naturalWidth.value > 0 ? naturalWidth.value : 32;
    const h = naturalHeight.value > 0 ? naturalHeight.value : 32;
    const hw = w / 2;
    const hh = h / 2;
    
    vertices.value = [
        { x: -hw, y: -hh, id: uid() },
        { x: hw, y: -hh, id: uid() },
        { x: hw, y: hh, id: uid() },
        { x: -hw, y: hh, id: uid() }
    ];
};

// Initial Open Logic
watch(() => props.isOpen, (open) => {
    if (open) {
        nextTick(() => {
             updateCenter();
        });
        
        zoom.value = 16;
        mode.value = 'global';
        
        if (props.animator && props.animator.currentAnim) {
            selectedAnim.value = props.animator.currentAnim;
            selectedFrame.value = 0;
        } else if (props.animator) {
            const keys = Object.keys(props.animator.animations);
            if (keys.length > 0) selectedAnim.value = keys[0]!;
            selectedFrame.value = 0;
        }

        loadCurrentContext();
    }
}, { immediate: true });

watch([mode, selectedAnim, selectedFrame], () => {
    if (props.isOpen) {
        loadCurrentContext();
    }
});

const onImageLoad = (e: Event) => {
    const img = e.target as HTMLImageElement;
    naturalWidth.value = img.naturalWidth;
    naturalHeight.value = img.naturalHeight;
    updateCenter();
    
    if (autoResetOnLoad.value) {
        resetToBox();
        autoResetOnLoad.value = false;
    }
};

// --- Coord Helpers ---
const toCanvas = (x: number, y: number) => {
    return {
        x: viewCenter.value.x + (x * zoom.value),
        y: viewCenter.value.y + (y * zoom.value)
    };
};



// --- Interaction (Constrained & Snapped) ---
const isDragging = ref<string | null>(null);

const handleWheel = (e: WheelEvent) => {
    e.preventDefault();
    const delta = -Math.sign(e.deltaY);
    const newZoom = zoom.value + delta;
    if (newZoom > 1 && newZoom < 50) zoom.value = newZoom;
};

const handleMouseDown = () => {
    // No panning allowed
};

const onMouseDownVertex = (e: MouseEvent, id: string) => {
    e.stopPropagation();
    isDragging.value = id;
}

const handleMouseMove = (e: MouseEvent) => {
    if (!isDragging.value || !containerRef.value) return;

    const point = vertices.value.find(v => v.id === isDragging.value);
    if (!point) return;

    const rect = containerRef.value.getBoundingClientRect();
    const localX = e.clientX - rect.left;
    const localY = e.clientY - rect.top;

    // Convert to World/Texture Space
    let wx = (localX - viewCenter.value.x) / zoom.value;
    let wy = (localY - viewCenter.value.y) / zoom.value;

    // Snap to Grid (1px)
    wx = Math.round(wx);
    wy = Math.round(wy);

    // Constrain to Texture Bounds
    if (naturalWidth.value > 0) {
        const hw = Math.floor(naturalWidth.value / 2);
        const hh = Math.floor(naturalHeight.value / 2);
        wx = Math.max(-hw, Math.min(hw, wx));
        wy = Math.max(-hh, Math.min(hh, wy));
    }

    point.x = wx;
    point.y = wy;
};

const handleMouseUp = () => {
    isDragging.value = null;
};

// Insert Point on Edge
const onClickEdge = (index: number) => {
    const p1 = vertices.value[index];
    const p2 = vertices.value[(index + 1) % vertices.value.length];
    
    // Midpoint (Rounded)
    const mx = Math.round((p1!.x + p2!.x) / 2);
    const my = Math.round((p1!.y + p2!.y) / 2);
    
    // Insert after index
    vertices.value.splice(index + 1, 0, { x: mx, y: my, id: uid() });
};

const onRemoveVertex = (id: string) => {
    if (vertices.value.length <= 3) return; 
    vertices.value = vertices.value.filter(v => v.id !== id);
};

// --- Save ---
const onSave = () => {
    const rawVerts = vertices.value.map(v => ({ x: v.x, y: v.y }));
    let context: any = { mode: mode.value };
    if (mode.value === 'animation') {
        context.anim = selectedAnim.value;
        context.frame = selectedFrame.value;
    }
    emit('save', { vertices: rawVerts, context });
    emit('close');
};

const onApply = () => {
    const rawVerts = vertices.value.map(v => ({ x: v.x, y: v.y }));
    let context: any = { mode: mode.value };
    if (mode.value === 'animation') {
        context.anim = selectedAnim.value;
        context.frame = selectedFrame.value;
    }
    emit('save', { vertices: rawVerts, context });
}

const onClose = () => emit('close');
</script>

<template>
    <div v-if="isOpen" class="fixed inset-0 z-[999] bg-black/80 flex items-center justify-center" @mouseup="handleMouseUp" @mousemove="handleMouseMove">
        <div class="bg-bg-panel w-[1000px] h-[700px] flex flex-col rounded shadow-2xl overflow-hidden border border-border">
            
            <!-- Toolbar -->
            <div class="h-14 border-b border-border bg-bg-header p-2 flex justify-between items-center">
                <div class="flex items-center gap-4">
                    <span class="font-bold text-lg">Edit Collision Mask</span>
                    
                    <div v-if="hasAnimator" class="flex bg-bg-dark rounded p-0.5 text-xs">
                         <button 
                            class="px-3 py-1.5 rounded transition-colors"
                            :class="mode === 'global' ? 'bg-accent-color text-text-accent shadow-sm' : 'text-text-secondary hover:text-text-primary'"
                        >
                            Global
                        </button>
                        <button 
                            class="px-3 py-1.5 rounded transition-colors"
                            :class="mode === 'animation' ? 'bg-accent-color text-text-accent shadow-sm' : 'text-text-secondary hover:text-text-primary'"
                        >
                            Animation
                        </button>
                    </div>

                    <div v-if="mode === 'animation' && hasAnimator" class="flex items-center gap-2 bg-bg-dark/30 px-2 py-1 rounded border border-border/50">
                        <select v-model="selectedAnim" class="u-input h-8 min-w-[120px]">
                             <option v-for="(_anim, name) in animator?.animations" :key="name" :value="name">
                                {{ name }}
                             </option>
                        </select>
                        <div class="flex items-center gap-1">
                             <span class="text-xs text-text-secondary">Frame:</span>
                             <select v-model.number="selectedFrame" class="u-input h-8 w-16 text-center">
                                 <option v-for="i in currentMaxFrames" :key="i-1" :value="i-1">
                                     {{ i-1 }}
                                 </option>
                             </select>
                        </div>
                    </div>
                </div>

                <div class="text-xs text-text-secondary">
                    Scroll to Zoom • Drag Pan • Drag Points • Click Edge to Add • DblClick Point to Remove
                </div>
            </div>

            <!-- Canvas Area -->
            <div 
                ref="containerRef"
                class="flex-1 bg-bg-base relative overflow-hidden select-none cursor-crosshair"
                @wheel="handleWheel"
                @mousedown="handleMouseDown"
            >
                
                 <!-- Texture (Sprite) -->
                 <img 
                    v-if="textureUrl"
                    :src="textureUrl"
                    @load="onImageLoad"
                    class="absolute select-none pointer-events-none image-pixelated opacity-70"
                    :style="{
                        left: `${viewCenter.x}px`,
                        top: `${viewCenter.y}px`,
                        transform: `translate(-50%, -50%) scale(${zoom})`,
                        width: naturalWidth ? 'auto' : undefined,
                        imageRendering: 'pixelated'
                    }"
                 />
                 
                 <!-- Vertices & Lines -->
                 <svg class="absolute inset-0 w-full h-full pointer-events-none overflow-visible">
                    <polygon 
                        :points="vertices.map(v => {
                             const p = toCanvas(v.x, v.y);
                             return `${p.x},${p.y}`;
                        }).join(' ')"
                        fill="rgba(0, 255, 0, 0.2)"
                        stroke="#00FF00"
                        stroke-width="2"
                    />
                    
                    <!-- Clickable Edges (Invisible but thicker stroke) -->
                     <line 
                        v-for="(v, i) in vertices" 
                        :key="`edge-${i}`"
                        :x1="toCanvas(v.x, v.y).x"
                        :y1="toCanvas(v.x, v.y).y"
                        :x2="toCanvas(vertices[(i + 1) % vertices.length]?.x || 0, vertices[(i + 1) % vertices.length]?.y || 0).x"
                        :y2="toCanvas(vertices[(i + 1) % vertices.length]?.x || 0, vertices[(i + 1) % vertices.length]?.y || 0).y"
                        stroke="transparent"
                        stroke-width="10"
                        class="cursor-copy pointer-events-auto hover:stroke-white/10"
                        @click.stop="onClickEdge(i)"
                        title="Click to Add Point"
                    />
                 </svg>

                 <!-- Interactive Points -->
                 <div 
                    v-for="(v, idx) in vertices" 
                    :key="v.id"
                    class="absolute w-3 h-3 -ml-1.5 -mt-1.5 bg-accent-color border border-white rounded-full cursor-move hover:scale-125 transition-transform z-10"
                    :style="{
                        left: `${toCanvas(v.x, v.y).x}px`,
                        top: `${toCanvas(v.x, v.y).y}px`
                    }"
                    @mousedown="(e) => onMouseDownVertex(e, v.id)"
                    @dblclick.stop="onRemoveVertex(v.id)"
                    title="Drag to Move • DblClick to Remove"
                 >
                    <div class="absolute -top-4 w-full text-center text-[10px] text-white font-mono pointer-events-none drop-shadow-md">
                        {{ idx }}
                    </div>
                 </div>

            </div>

            <!-- Footer -->
            <div class="h-12 border-t border-border bg-bg-header px-4 flex items-center justify-between shrink-0">
                <div class="flex gap-2 items-center">
                    <button @click="resetToBox" class="u-button px-3 py-1 bg-red-900/50 hover:bg-red-800 text-xs">Reset Box</button>
                    <div class="w-px h-4 bg-border mx-1"></div>
                    
                    <!-- Zoom Controls -->
                     <button @click="zoom = Math.max(1, zoom - 1)" class="w-6 h-6 bg-bg-input rounded flex items-center justify-center hover:bg-bg-hover">-</button>
                     <span class="text-xs w-12 text-center font-mono">{{ zoom }}x</span>
                     <button @click="zoom = Math.min(40, zoom + 1)" class="w-6 h-6 bg-bg-input rounded flex items-center justify-center hover:bg-bg-hover">+</button>
                </div>
                
                <div class="flex gap-2">
                    <button @click="onClose" class="u-button px-4 py-1 bg-bg-input">Cancel</button>
                    <button @click="onApply" class="u-button px-4 py-1">Apply (Keep Open)</button>
                    <button @click="onSave" class="u-button px-4 py-1 bg-accent-color text-text-accent">Save & Close</button>
                </div>
            </div>
        </div>
    </div>
</template>

<style scoped>
.image-pixelated {
    image-rendering: pixelated;
}
</style>
