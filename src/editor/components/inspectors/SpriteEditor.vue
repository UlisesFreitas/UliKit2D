<script setup lang="ts">
import { ref, watch, onMounted } from 'vue';
import AssetPickerModal from '../modals/AssetPickerModal.vue';

const props = defineProps<{
    sprite: any;
    entity?: any;
}>();

const emit = defineEmits(['update']);

const isPickerOpen = ref(false);

const onUpdate = () => {
    emit('update');
};

const openPicker = () => {
    isPickerOpen.value = true;
};

const thumbnailUrl = ref('');

const stopAnimation = () => {
    if (props.entity && props.entity.animator) {
        if (props.entity.animator.isPlaying || props.entity.animator.currentAnim) {
            console.log('[SpriteEditor] Stopping active animation to set manual sprite');
            props.entity.animator.isPlaying = false;
            props.entity.animator.currentAnim = ''; // Clear current anim so System doesn't override
        }
    }
}

const updateAnchor = (axis: 'x'|'y', val: number) => {
    if (!props.sprite.anchor) props.sprite.anchor = { x: 0.5, y: 0.5 };
    props.sprite.anchor[axis] = val;
    onUpdate();
};

const applyPreset = (val: string) => {
    const [x, y] = val.split(',').map(Number);
    if (!props.sprite.anchor) props.sprite.anchor = { x: 0.5, y: 0.5 };
    props.sprite.anchor.x = x;
    props.sprite.anchor.y = y;
    onUpdate();
};

const onSelectAsset = (path: string | string[]) => {
    // Handle array
    const singlePath = Array.isArray(path) ? path[0] : path;
    if (!singlePath) return;

    // 1. Mutate
    // Normalize path to forward slashes
    const normPath = singlePath.replace(/\\/g, '/');
    
    stopAnimation();
    
    props.sprite.texture = normPath;
    
    // 2. Immediate visual update
    thumbnailUrl.value = ''; // Force loading state
    updateThumbnail();

    // 3. Notify parent
    onUpdate();
};

const onDrop = async (e: DragEvent) => {
    // --- ASSET PIPELINE 3.0 STRICT MODE ---
    const assetJson = e.dataTransfer?.getData('application/ulikit-asset');
    
    if (!assetJson) {
        console.warn('[SpriteEditor] Ignored drop: No Asset data found.');
        return;
    }

    try {
        const asset = JSON.parse(assetJson);
        
        // Strict Type Check
        if (asset.type !== 'texture') {
            console.warn(`[SpriteEditor] Ignored asset type '${asset.type}'. Expected 'texture'.`);
            return;
        }

        console.log(`[SpriteEditor] Dropped Valid Asset:`, asset);
        
        stopAnimation();

        // Use GUID-safe path or direct path from payload
        // Ideally we store GUID, but for now we update the Path property in ECS
        props.sprite.texture = asset.path;
        
        thumbnailUrl.value = '';
        updateThumbnail();
        onUpdate();

    } catch (err) {
        console.error('[SpriteEditor] Failed to parse asset drop:', err);
    }
};



const updateThumbnail = async () => {
    const rawPath = props.sprite.texture;
    if (!rawPath) {
        thumbnailUrl.value = '';
        return;
    }

    try {
        const { resourceManager } = await import('../../../engine/resources/ResourceManager');
        thumbnailUrl.value = await resourceManager.getUrl(rawPath);
    } catch (e) {
        console.error('[SpriteEditor] Failed to resolve thumbnail:', e);
        thumbnailUrl.value = rawPath;
    }
};

// Watch for Entity Switching (Identity change)
watch(() => props.sprite, () => {
    updateThumbnail();
}, { deep: true });

onMounted(async () => {
    updateThumbnail();
    
    // Listen for live updates
    const { eventBus } = await import('../../../engine/core/EventBus');
    eventBus.on('asset-changed', (path: string) => {
        // If our texture changed, refresh
        if (props.sprite.texture === path || props.sprite.texture?.endsWith(path)) {
             console.log('[SpriteEditor] Asset changed, refreshing thumbnail:', path);
             updateThumbnail();
        }
    });
});


</script>

<template>
    <div class="flex flex-col gap-2">
        <!-- Main Row: Thumbnail + Input + Pick -->
        <div class="flex gap-2">
            <!-- Thumbnail Preview -->
            <div 
                class="w-16 h-16 bg-checkerboard rounded border border-border flex-shrink-0 flex items-center justify-center overflow-hidden cursor-pointer hover:border-accent-color transition-colors group"
                @click="openPicker"
                @dragover.prevent
                @drop.prevent="onDrop"
                title="Click to pick texture, or drop here"
            >
                <img 
                    v-if="thumbnailUrl" 
                    :src="thumbnailUrl" 
                    class="w-full h-full object-contain"
                    style="image-rendering: pixelated"
                    @error="(e) => console.error('[SpriteEditor] Image load failed:', thumbnailUrl, e)"
                    @load="() => console.log('[SpriteEditor] Image loaded successfully:', thumbnailUrl)"
                />
                <span v-else class="text-2xl opacity-20 group-hover:opacity-50 transition-opacity">
                    {{ sprite.texture ? '⏳' : '🖼️' }}
                </span>
            </div>

            <!-- Controls -->
            <!-- Controls -->
            <div class="flex-1 flex flex-col gap-2 justify-center">
                 <div class="flex gap-1 items-center">
                    <!-- Filename Display (Read-only) -->
                    <div 
                        class="flex-1 text-xs text-text-primary px-2 py-1.5 bg-bg-input border border-border rounded truncate select-all cursor-default"
                        :title="sprite.texture"
                        @dragover.prevent
                        @drop.prevent="onDrop"
                        draggable="false"
                    >
                        {{ sprite.texture ? sprite.texture.split(/[\\/]/).pop() : 'No Texture' }}
                    </div>
                    
                    <button 
                        @click="openPicker" 
                        class="px-2 py-1.5 bg-bg-input border border-border rounded hover:bg-bg-hover text-xs flex items-center justify-center min-w-[30px]"
                        title="Browse Assets"
                    >
                        📂
                    </button>
                 </div>
                 
                 <!-- Tint -->
                 
                 <!-- Tint -->
                 <div class="flex items-center gap-2">
                    <label class="text-xs text-text-secondary w-12">Tint</label>
                    <div class="relative flex-1">
                        <input 
                            type="color" 
                            class="absolute inset-0 w-full h-full opacity-0 cursor-pointer"
                            :value="'#'+((sprite.tint || 0xFFFFFF).toString(16).padStart(6, '0'))" 
                            @input="(e:any) => { sprite.tint = parseInt(e.target.value.substring(1), 16); onUpdate(); }" 
                        />
                         <div class="w-full h-5 rounded border border-border flex items-center px-2 text-xs font-mono bg-bg-input" :style="{ backgroundColor: '#' + ((sprite.tint || 0xFFFFFF).toString(16).padStart(6, '0')) }">
                            #{{ (sprite.tint || 0xFFFFFF).toString(16).toUpperCase().padStart(6, '0') }}
                         </div>
                    </div>
                 </div>

                 <!-- Anchor -->
                 <div class="flex flex-col gap-1 mt-1 border-t border-border pt-2">
                    <div class="flex items-center justify-between">
                         <label class="text-xs text-text-secondary">Anchor / Pivot</label>
                         <select 
                             class="u-input text-[10px] px-1 py-0.5"
                             @change="(e:any) => applyPreset(e.target.value)"
                         >
                            <option value="" disabled selected>Presets</option>
                            <option value="0.5,0.5">Center</option>
                            <option value="0,0">Top Left</option>
                            <option value="0.5,0">Top Center</option>
                            <option value="1,0">Top Right</option>
                            <option value="0,0.5">Left</option>
                            <option value="1,0.5">Right</option>
                            <option value="0,1">Bottom Left</option>
                            <option value="0.5,1">Bottom Center</option>
                            <option value="1,1">Bottom Right</option>
                         </select>
                    </div>
                    
                    <div class="flex gap-2">
                         <!-- X -->
                        <div class="flex items-center gap-1 flex-1">
                            <span class="text-[10px] text-text-disabled font-bold text-red-400">X</span>
                            <input 
                                type="number" 
                                step="0.1"
                                class="u-input px-1"
                                :value="sprite.anchor?.x ?? 0.5"
                                @input="(e:any) => updateAnchor('x', parseFloat(e.target.value))"
                            />
                        </div>
                        <!-- Y -->
                        <div class="flex items-center gap-1 flex-1">
                            <span class="text-[10px] text-text-disabled font-bold text-green-400">Y</span>
                             <input 
                                type="number" 
                                step="0.1"
                                class="u-input px-1"
                                :value="sprite.anchor?.y ?? 0.5"
                                @input="(e:any) => updateAnchor('y', parseFloat(e.target.value))"
                            />
                        </div>
                    </div>
                 </div>
            </div>
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

<style scoped>
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
