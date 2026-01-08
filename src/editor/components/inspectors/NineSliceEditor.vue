<script setup lang="ts">
import { computed, ref, watch, onMounted } from 'vue';
import { getFileSystem } from '../../../api/FileSystem';
import AssetPickerModal from '../modals/AssetPickerModal.vue';

const props = defineProps<{
    nineSlice: any;
    entity?: any; // Added to match SpriteEditor pattern potentially
}>();

const emit = defineEmits(['update']);
const isPickerOpen = ref(false);
const thumbnailUrl = ref('');

const component = computed(() => props.nineSlice);

const onUpdate = () => {
    emit('update');
};

const openPicker = () => {
    isPickerOpen.value = true;
};

const updateComponent = (field: string, value: any) => {
    if (!component.value) return;
    component.value[field] = value;
    onUpdate();
};

const updateThumbnail = async () => {
    if (component.value && component.value.texture) {
        thumbnailUrl.value = await getFileSystem().getAssetURL(component.value.texture);
    } else {
        thumbnailUrl.value = '';
    }
};

watch(() => component.value?.texture, () => {
    updateThumbnail();
}, { immediate: true });

onMounted(() => {
    updateThumbnail();
});

const onSelectAsset = (path: string) => {
    // Normalize path
    const normPath = path.replace(/\\/g, '/');
    updateComponent('texture', normPath);
    isPickerOpen.value = false;
};

const onDropTexture = async (event: DragEvent) => {
    const data = event.dataTransfer?.getData('application/json');
    if (data) {
         try {
            const payload = JSON.parse(data);
             if (payload.type === 'asset' && payload.assetType === 'image') {
                updateComponent('texture', payload.path.replace(/\\/g, '/'));
            }
        } catch (e) { console.error(e); }
        return;
    }
    
    const path = event.dataTransfer?.getData('text/plain');
    if (path) {
        // Normalize path
        const normPath = path.replace(/\\/g, '/');
        updateComponent('texture', normPath);
    }
};

</script>

<template>
    <div class="p-4 space-y-4" v-if="component">
        <!-- Texture Section -->
        <div class="flex items-center justify-between group">
            <span class="text-xs text-text-secondary w-16">Texture</span>
            <div 
                class="flex-1 bg-bg-dark rounded border border-border-dim p-2 flex items-center gap-2 cursor-pointer hover:border-primary transition-colors"
                @drop.prevent="onDropTexture"
                @dragover.prevent
                @click="openPicker"
            >
                <div class="w-8 h-8 bg-bg-darker rounded flex items-center justify-center overflow-hidden border border-border-dim">
                     <img v-if="thumbnailUrl" :src="thumbnailUrl" class="w-full h-full object-cover" />
                     <span v-else class="text-[10px] text-text-muted">None</span>
                </div>
                <span class="text-xs text-text-primary truncate flex-1 block">
                    {{ component.texture ? component.texture.split(/[\\/]/).pop() : 'Drag Image or Click' }}
                </span>
                <button 
                    @click.stop="openPicker" 
                    class="px-2 py-1 bg-bg-input border border-border rounded hover:bg-bg-hover text-xs flex items-center justify-center"
                    title="Browse Assets"
                >
                    📂
                </button>
            </div>
        </div>

        <!-- Dimensions -->
        <div class="grid grid-cols-2 gap-2">
            <div class="flex items-center gap-2">
                <span class="text-xs text-text-secondary w-16">Width</span>
                <input 
                    type="number" 
                    :value="component.width" 
                    @input="e => updateComponent('width', Number((e.target as HTMLInputElement).value))"
                    class="flex-1 bg-bg-dark border border-border-dim rounded px-2 py-1 text-xs text-text-primary focus:border-primary outline-none"
                    step="1"
                />
            </div>
            <div class="flex items-center gap-2">
                <span class="text-xs text-text-secondary w-12">Height</span>
                <input 
                    type="number" 
                    :value="component.height" 
                    @input="e => updateComponent('height', Number((e.target as HTMLInputElement).value))"
                    class="flex-1 bg-bg-dark border border-border-dim rounded px-2 py-1 text-xs text-text-primary focus:border-primary outline-none"
                    step="1"
                />
            </div>
        </div>

        <!-- Slices (Grid Layout) -->
        <div class="space-y-2">
            <span class="text-xs text-text-secondary block">Slices (L / R / T / B)</span>
            <div class="grid grid-cols-2 gap-2">
                 <div class="flex items-center gap-2">
                    <span class="text-xs text-text-muted w-8">Left</span>
                    <input 
                        type="number" 
                        :value="component.left" 
                        @input="e => updateComponent('left', Number((e.target as HTMLInputElement).value))"
                        class="flex-1 bg-bg-dark border border-border-dim rounded px-2 py-1 text-xs text-text-primary focus:border-primary outline-none"
                    />
                </div>
                <div class="flex items-center gap-2">
                    <span class="text-xs text-text-muted w-8">Right</span>
                    <input 
                        type="number" 
                        :value="component.right" 
                        @input="e => updateComponent('right', Number((e.target as HTMLInputElement).value))"
                        class="flex-1 bg-bg-dark border border-border-dim rounded px-2 py-1 text-xs text-text-primary focus:border-primary outline-none"
                    />
                </div>
                <div class="flex items-center gap-2">
                    <span class="text-xs text-text-muted w-8">Top</span>
                    <input 
                        type="number" 
                        :value="component.top" 
                        @input="e => updateComponent('top', Number((e.target as HTMLInputElement).value))"
                        class="flex-1 bg-bg-dark border border-border-dim rounded px-2 py-1 text-xs text-text-primary focus:border-primary outline-none"
                    />
                </div>
                <div class="flex items-center gap-2">
                    <span class="text-xs text-text-muted w-8">Bott</span>
                    <input 
                        type="number" 
                        :value="component.bottom" 
                        @input="e => updateComponent('bottom', Number((e.target as HTMLInputElement).value))"
                        class="flex-1 bg-bg-dark border border-border-dim rounded px-2 py-1 text-xs text-text-primary focus:border-primary outline-none"
                    />
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
