<script setup lang="ts">
import { usePreferencesStore } from '../../../stores/usePreferencesStore';
import BaseDialog from '../ui/BaseDialog.vue';
import { useEditorStore } from '../../../stores/useEditorStore';
import { SceneManager } from '../../../engine/managers/SceneManager';
import { useUIStore } from '../../../stores/useUIStore';
import { watch } from 'vue';

const props = defineProps<{
    open: boolean;
}>();

const emit = defineEmits<{
    (e: 'update:open', value: boolean): void;
}>();

const prefs = usePreferencesStore();
const store = useEditorStore();
const ui = useUIStore();

const onSave = () => {
    // Logic is reactive, so just notify and close
    ui.showToast({ title: 'Grid Settings Saved', description: 'Preferences updated successfully.', type: 'success' });
    emit('update:open', false);
};

// Sync Prefs -> SceneManager (Logic)
watch(() => [prefs.grid.width, prefs.grid.height], ([w, h]) => {
    SceneManager.setLayerGridSize(store.activeLayerId, w || 32, h || 32);
});

// Sync SceneManager (Logic) -> Prefs (Visuals) when opening or switching layer
watch(() => [props.open, store.activeLayerId], () => {
    if (props.open) {
        const layer = SceneManager.getLayerById(store.activeLayerId);
        if (layer && layer.gridSize) {
             // Only update if different to avoid loop? 
             // Watch above will trigger setLayerGridSize again, which is harmless (idempotent-ish).
             if (prefs.grid.width !== layer.gridSize.x) prefs.grid.width = layer.gridSize.x;
             if (prefs.grid.height !== layer.gridSize.y) prefs.grid.height = layer.gridSize.y;
        }
    }
}, { immediate: true });
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
        
        <div class="flex justify-end gap-3 p-4 border-t border-border rounded-b-lg">
            <button class="px-4 py-2 text-sm font-medium rounded shadow-sm text-white bg-zinc-700 hover:bg-zinc-600 transition-colors border border-transparent" @click="emit('update:open', false)">Close</button>
            <button class="px-4 py-2 text-sm font-medium rounded shadow-sm text-white bg-zinc-700 hover:bg-zinc-600 transition-colors border border-transparent" @click="onSave">Save</button>
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

</style>
