<script setup lang="ts">
import { useUIStore } from '../../../stores/useUIStore';

const ui = useUIStore();
</script>

<template>
    <div class="fixed inset-0 bg-black/50 z-[10000] flex items-center justify-center backdrop-blur-sm">
        <div class="bg-bg-panel border border-border rounded-lg shadow-xl p-6 w-[400px] flex flex-col gap-4">
            <h3 class="font-bold text-lg text-text-primary text-center">{{ ui.loadingMessage || 'Processing...' }}</h3>
            
            <!-- Spinner / Progress Bar -->
            <div class="w-full h-2 bg-bg-dark rounded-full overflow-hidden relative">
                <!-- Determinate -->
                <div v-if="ui.progressMode === 'determinate'" 
                     class="h-full bg-accent-color transition-all duration-200 ease-out"
                     :style="{ width: `${Math.max(0, Math.min(100, ui.progressValue))}%` }"
                ></div>
                <!-- Indeterminate -->
                <div v-else 
                     class="h-full bg-accent-color w-1/3 absolute indeterminate-anim"
                ></div>
            </div>

            <div class="flex justify-between text-xs text-text-secondary">
                <span v-if="ui.progressMode === 'determinate'">{{ Math.round(ui.progressValue) }}%</span>
                <span v-else>Please wait...</span>
                
                <span v-if="ui.progressDetail" class="truncate max-w-[200px]">{{ ui.progressDetail }}</span>
            </div>
        </div>
    </div>
</template>

<style scoped>
@keyframes slide {
    0% { left: -33%; }
    100% { left: 100%; }
}
.indeterminate-anim {
    animation: slide 1.5s infinite linear;
}
</style>
