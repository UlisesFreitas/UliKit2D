<script setup lang="ts">


const props = defineProps<{
    audio: {
        clip: string;
        volume: number;
        loop: boolean;
        playOnAwake: boolean;
    };
}>();

const emit = defineEmits(['update']);

const update = () => {
    emit('update');
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
             <!-- TODO: Add Drag & Drop zone or File Picker -->
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
    </div>
</template>
