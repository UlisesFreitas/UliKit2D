<script setup lang="ts">
import { ref, watch, onMounted } from 'vue';
import { getFileSystem } from '../../../api/FileSystem';
import AssetPickerModal from '../modals/AssetPickerModal.vue';

const props = defineProps<{
    sprite: { texture: string; tint?: number };
}>();

const emit = defineEmits(['update']);

const isPickerOpen = ref(false);

const onUpdate = () => {
    emit('update');
};

const openPicker = () => {
    isPickerOpen.value = true;
};

const onSelectAsset = (path: string) => {
    // 1. Mutate
    props.sprite.texture = path;
    
    // 2. Immediate visual update
    thumbnailUrl.value = ''; // Force loading state
    updateThumbnail();

    // 3. Notify parent
    onUpdate();
};

const onDrop = (e: DragEvent) => {
    const path = e.dataTransfer?.getData('text/plain');
    if (path) {
        // Validate Image Extension
        if (!/\.(png|jpg|jpeg|webp|bmp|gif)$/i.test(path)) {
            console.warn('[SpriteEditor] Ignored non-image drop:', path);
            return;
        }

        props.sprite.texture = path;
        thumbnailUrl.value = '';
        updateThumbnail();
        onUpdate();
    }
};

const thumbnailUrl = ref('');

const updateThumbnail = async () => {
    const rawPath = props.sprite.texture;
    if (!rawPath) {
        thumbnailUrl.value = '';
        return;
    }

    try {
        const fs = getFileSystem();
        thumbnailUrl.value = await fs.getAssetURL(rawPath);
    } catch (e) {
        console.error('[SpriteEditor] Failed to resolve thumbnail:', e);
        thumbnailUrl.value = rawPath;
    }
};

// Watch for Entity Switching (Identity change)
watch(() => props.sprite, () => {
    updateThumbnail();
});

onMounted(() => {
    updateThumbnail();
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
                        class="flex-1 text-xs text-text-primary px-2 py-1.5 bg-bg-input border border-border rounded truncate select-all"
                        :title="sprite.texture"
                        @dragover.prevent
                        @drop.prevent="onDrop"
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
