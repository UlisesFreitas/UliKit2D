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

const onSelectAsset = (path: string | string[]) => {
    // Handle array case
    const singlePath = Array.isArray(path) ? path[0] : path;
    if (!singlePath) return;

    // Normalize path
    const normPath = singlePath.replace(/\\/g, '/');
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


         <!-- Anchor -->
         <div class="flex flex-col gap-1 border-t border-border-dim pt-2">
            <div class="flex items-center justify-between">
                 <label class="text-xs text-text-secondary">Anchor / Pivot</label>
                 <select 
                     class="bg-bg-dark border border-border-dim rounded text-[10px] text-text-primary px-1 py-0.5 outline-none"
                     @change="(e:any) => {
                        const [x, y] = e.target.value.split(',').map(Number);
                        // We need a helper or direct update. Let's do direct for now since we have updateComponent
                        // But updateComponent takes one field. We need to update nested or object.
                        // Best way: Create a new anchor object
                        const newAnchor = { x, y };
                        updateComponent('anchor', newAnchor);
                     }"
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
                    <span class="text-[10px] text-text-muted font-bold">X</span>
                    <input 
                        type="number" 
                        step="0.1"
                        class="w-full bg-bg-dark border border-border-dim rounded px-1 text-xs text-text-primary outline-none"
                        :value="component.anchor?.x ?? 0.5"
                        @input="(e:any) => {
                             const val = parseFloat(e.target.value);
                             const curY = component.anchor?.y ?? 0.5;
                             updateComponent('anchor', { x: val, y: curY });
                        }"
                    />
                </div>
                <!-- Y -->
                <div class="flex items-center gap-1 flex-1">
                    <span class="text-[10px] text-text-muted font-bold">Y</span>
                     <input 
                        type="number" 
                        step="0.1"
                        class="w-full bg-bg-dark border border-border-dim rounded px-1 text-xs text-text-primary outline-none"
                        :value="component.anchor?.y ?? 0.5"
                        @input="(e:any) => {
                             const val = parseFloat(e.target.value);
                             const curX = component.anchor?.x ?? 0.5;
                             updateComponent('anchor', { x: curX, y: val });
                        }"
                    />
                </div>
            </div>
         </div>

        <!-- Margins (Borders) -->
        <div class="space-y-2 border-t border-border-dim pt-2">
            <span class="text-xs text-text-secondary font-bold">Borders (Margins)</span>
            
            <div class="grid grid-cols-2 gap-2">
                <!-- Top / Bottom -->
                <div class="flex items-center gap-2">
                    <span class="text-xs text-text-muted w-10">Top</span>
                    <input 
                        type="number" 
                        :value="component.top" 
                        @input="e => updateComponent('top', Number((e.target as HTMLInputElement).value))"
                        class="flex-1 bg-bg-dark border border-border-dim rounded px-2 py-1 text-xs text-text-primary focus:border-primary outline-none"
                    />
                </div>
                <div class="flex items-center gap-2">
                    <span class="text-xs text-text-muted w-10">Bottom</span>
                    <input 
                        type="number" 
                        :value="component.bottom" 
                        @input="e => updateComponent('bottom', Number((e.target as HTMLInputElement).value))"
                        class="flex-1 bg-bg-dark border border-border-dim rounded px-2 py-1 text-xs text-text-primary focus:border-primary outline-none"
                    />
                </div>
                
                <!-- Left / Right -->
                 <div class="flex items-center gap-2">
                    <span class="text-xs text-text-muted w-10">Left</span>
                    <input 
                        type="number" 
                        :value="component.left" 
                        @input="e => updateComponent('left', Number((e.target as HTMLInputElement).value))"
                        class="flex-1 bg-bg-dark border border-border-dim rounded px-2 py-1 text-xs text-text-primary focus:border-primary outline-none"
                    />
                </div>
                <div class="flex items-center gap-2">
                    <span class="text-xs text-text-muted w-10">Right</span>
                    <input 
                        type="number" 
                        :value="component.right" 
                        @input="e => updateComponent('right', Number((e.target as HTMLInputElement).value))"
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
