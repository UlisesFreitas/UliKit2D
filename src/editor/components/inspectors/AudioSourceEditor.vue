<script setup lang="ts">
import { ref } from 'vue';
import AssetPickerModal from '../modals/AssetPickerModal.vue';


const props = defineProps<{
    audio: {
        clip: string;
        volume: number;
        loop: boolean;
        playOnAwake: boolean;
        channel?: string;
    };
}>();

const emit = defineEmits(['update']);

const update = () => {
    emit('update');
};

const isPickerOpen = ref(false);

const openPicker = () => {
    isPickerOpen.value = true;
};

const onSelectAsset = (path: string | string[]) => {
    const singlePath = Array.isArray(path) ? path[0] : path;
    if (!singlePath) return;

    // Normalize path
    const normPath = singlePath.replace(/\\/g, '/');
    props.audio.clip = normPath;
    update();
};
</script>

<template>
    <div class="grid grid-cols-1 gap-2 text-xs">
        <!-- Clip Path -->
        <div class="flex items-center space-x-2">
             <label class="text-text-secondary w-16">Clip</label>
             <input 
                v-model="audio.clip"
                @input="update"
                class="u-input flex-1 min-w-0"
                placeholder="assets/sound.mp3"
             />
             <button 
                @click="openPicker" 
                class="px-2 py-1 bg-bg-input border border-border rounded hover:bg-bg-hover text-xs flex items-center justify-center min-w-[30px]"
                title="Browse Assets"
             >
                📂
             </button>
        </div>

        <!-- Channel Selector -->
        <div class="flex items-center space-x-2">
             <label class="text-text-secondary w-16">Channel</label>
             <select 
                v-model="audio.channel"
                @change="update"
                class="u-input flex-1 min-w-0 h-6 px-1"
                title="Audio Mixer Channel"
             >
                <option value="SFX">SFX</option>
                <option value="Music">Music</option>
             </select>
        </div>

        <!-- Volume -->
        <div class="flex items-center space-x-2">
             <label class="text-text-secondary w-16">Volume</label>
             <input 
                type="range" 
                v-model.number="audio.volume"
                @input="update"
                min="0"
                max="1"
                step="0.05"
                class="flex-1"
             />
             <span class="w-8 text-right">{{ Math.round(audio.volume * 100) }}%</span>
        </div>

        <!-- Toggles -->
        <div class="flex space-x-4">
            <label class="flex items-center cursor-pointer space-x-2">
                <input 
                    type="checkbox" 
                    v-model="audio.loop"
                    @change="update"
                    class="h-4 w-4 bg-bg-input border-border text-accent-color rounded"
                />
                <span class="text-text-primary">Loop</span>
            </label>
            
            <label class="flex items-center cursor-pointer space-x-2">
                <input 
                    type="checkbox" 
                    v-model="audio.playOnAwake"
                    @change="update"
                    class="h-4 w-4 bg-bg-input border-border text-accent-color rounded"
                />
                <span class="text-text-primary">Play on Awake</span>
            </label>
        </div>

        <!-- Asset Picker Modal -->
        <Teleport to="body">
            <AssetPickerModal 
                :isOpen="isPickerOpen" 
                type="audio" 
                @select="onSelectAsset" 
                @close="isPickerOpen = false" 
            />
        </Teleport>
    </div>
</template>
