<script setup lang="ts">
import { usePreferencesStore } from '../../../stores/usePreferencesStore';
import BaseDialog from '../ui/BaseDialog.vue';

const props = defineProps<{
    open: boolean;
}>();

const emit = defineEmits<{
    (e: 'update:open', value: boolean): void;
}>();

const prefs = usePreferencesStore();
</script>

<template>
    <BaseDialog 
        :open="open" 
        title="Grid Settings" 
        @update:open="(val) => emit('update:open', val)"
    >
        <div class="grid-settings-form space-y-4 p-4">
            
            <!-- Visibility & Mode -->
            <div class="flex items-center justify-between">
                <label class="text-sm font-medium">Show Grid</label>
                <input type="checkbox" v-model="prefs.grid.visible" class="toggle-checkbox" />
            </div>

            <div class="flex items-center justify-between">
                <label class="text-sm font-medium">Isometric Mode</label>
                <input type="checkbox" v-model="prefs.grid.isIsometric" class="toggle-checkbox" />
            </div>

            <hr class="border-border" />

            <!-- Dimensions -->
            <div class="grid grid-cols-2 gap-4">
                <div class="flex flex-col">
                    <label class="text-xs text-text-secondary mb-1">Cell Width (px)</label>
                    <input type="number" v-model="prefs.grid.width" class="input-base" min="1" />
                </div>
                <div class="flex flex-col">
                    <label class="text-xs text-text-secondary mb-1">Cell Height (px)</label>
                    <input type="number" v-model="prefs.grid.height" class="input-base" min="1" />
                </div>
            </div>

            <!-- Offsets -->
            <div class="grid grid-cols-2 gap-4">
                <div class="flex flex-col">
                    <label class="text-xs text-text-secondary mb-1">X Offset</label>
                    <input type="number" v-model="prefs.grid.offsetX" class="input-base" />
                </div>
                <div class="flex flex-col">
                    <label class="text-xs text-text-secondary mb-1">Y Offset</label>
                    <input type="number" v-model="prefs.grid.offsetY" class="input-base" />
                </div>
            </div>

            <!-- Color -->
            <div class="flex flex-col">
                 <label class="text-xs text-text-secondary mb-1">Grid Color</label>
                 <div class="flex items-center gap-2">
                     <input type="color" v-model="prefs.grid.color" class="w-8 h-8 p-0 border-none bg-transparent cursor-pointer" />
                     <input type="text" v-model="prefs.grid.color" class="input-base flex-1" />
                 </div>
            </div>

        </div>
        
        <div class="flex justify-end p-4 border-t border-border">
            <button class="btn-primary" @click="emit('update:open', false)">Close</button>
        </div>
    </BaseDialog>
</template>

<style scoped>
.input-base {
    background-color: var(--bg-input);
    color: var(--text-primary);
    border: 1px solid var(--border-color);
    border-radius: 4px;
    padding: 6px;
    font-size: 13px;
    outline: none;
}
.input-base:focus {
    border-color: var(--primary-color);
}
.btn-primary {
    background-color: var(--primary-color);
    color: white;
    padding: 6px 12px;
    border-radius: 4px;
    font-size: 13px;
    font-weight: 500;
}
.btn-primary:hover {
    opacity: 0.9;
}
</style>
