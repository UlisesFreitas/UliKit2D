<script setup lang="ts">
import { ref } from 'vue';
import { useProjectSettingsStore } from '../../../stores/useProjectSettingsStore';
import { ProjectSettingsManager } from '../../managers/ProjectSettingsManager';
import {
  DialogRoot,
  DialogPortal,
  DialogOverlay,
  DialogContent,
  DialogTitle,
  DialogDescription,
  DialogClose,
} from "radix-vue";
import { useUIStore } from '../../../stores/useUIStore';

const props = defineProps<{
    open: boolean;
}>();

const emit = defineEmits<{
    (e: 'update:open', value: boolean): void;
}>();

const store = useProjectSettingsStore();
const ui = useUIStore();
const activeTab = ref<'general' | 'display' | 'physics' | 'tags' | 'layouts'>('general');

const onClose = () => {
    if (store.isDirty) {
        // Optional: Confirm discard?
        // For now, just close. Changes in store persist in memory until restart or manual revert.
    }
    emit('update:open', false);
};

const onSave = async () => {
    // Save to Disk
    await ProjectSettingsManager.saveSettings();
    ui.showToast({ title: 'Settings Saved', description: 'Project configuration updated.', type: 'success' });
    store.applySettings();
    emit('update:open', false);
};

const onApply = () => {
    store.applySettings();
    ui.showToast({ title: 'Settings Applied', description: 'Changes applied to runtime.' });
};
</script>

<template>
    <DialogRoot :open="open" @update:open="$emit('update:open', $event)">
        <DialogPortal>
            <DialogOverlay class="fixed inset-0 bg-black/50 z-50 transition-opacity backdrop-blur-sm" />
            <DialogContent class="fixed top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 bg-bg-panel border border-border rounded-lg shadow-xl z-50 w-[800px] h-[600px] flex flex-col focus:outline-none">
                
                <!-- Header -->
                <div class="h-12 border-b border-border flex items-center justify-between px-4 bg-bg-header rounded-t-lg">
                    <DialogTitle class="text-sm font-bold text-text-primary">Project Settings</DialogTitle>
                    <DialogDescription style="position: absolute; width: 1px; height: 1px; padding: 0; margin: -1px; overflow: hidden; clip: rect(0, 0, 0, 0); white-space: nowrap; border-width: 0;">
                        Configure project global settings
                    </DialogDescription>
                     <DialogClose class="text-text-secondary hover:text-text-primary">✕</DialogClose>
                </div>

                <div class="flex-1 flex overflow-hidden">
                    <!-- Sidebar Tabs -->
                    <div class="w-48 border-r border-border bg-bg-base/50 flex flex-col py-2">
                        <button 
                            v-for="tab in ['General', 'Display', 'Physics', 'Tags & Layers', 'Layouts']"
                            :key="tab"
                            @click="activeTab = (tab.split(' ')[0] || '').toLowerCase() as any"
                            class="px-4 py-2 text-left text-sm transition-colors border-l-2"
                            :class="activeTab === (tab.split(' ')[0] || '').toLowerCase() 
                                ? 'bg-bg-selection text-accent border-accent' 
                                : 'text-text-secondary border-transparent hover:text-text-primary hover:bg-bg-hover'"
                        >
                            {{ tab }}
                        </button>
                    </div>

                    <!-- Content Area -->
                    <div class="flex-1 p-6 overflow-y-auto bg-bg-base">
                        
                        <!-- GENERAL TAB -->
                        <div v-if="activeTab === 'general'" class="space-y-4 animate-fade-in">
                            <h3 class="text-lg font-bold text-accent mb-4">General Settings</h3>
                            
                            <div class="grid grid-cols-1 gap-4">
                                <div class="flex flex-col gap-1">
                                    <label class="text-xs text-text-secondary">Project Title</label>
                                    <input v-model="store.settings.general.title" type="text" class="bg-bg-input border border-border rounded px-3 py-1.5 text-sm text-text-primary outline-none focus:border-accent transition-colors" />
                                </div>
                                <div class="flex flex-col gap-1">
                                    <label class="text-xs text-text-secondary">Version</label>
                                    <input v-model="store.settings.general.version" type="text" class="bg-bg-input border border-border rounded px-3 py-1.5 text-sm text-text-primary outline-none focus:border-accent transition-colors" />
                                </div>
                                <div class="flex flex-col gap-1">
                                    <label class="text-xs text-text-secondary">Company / Author</label>
                                    <input v-model="store.settings.general.company" type="text" class="bg-bg-input border border-border rounded px-3 py-1.5 text-sm text-text-primary outline-none focus:border-accent transition-colors" />
                                </div>
                            </div>
                        </div>

                        <!-- DISPLAY TAB -->
                        <div v-if="activeTab === 'display'" class="space-y-4 animate-fade-in">
                            <h3 class="text-lg font-bold text-accent mb-4">Display & Graphics</h3>
                            
                            <div class="grid grid-cols-2 gap-4">
                                <div class="flex flex-col gap-1">
                                    <label class="text-xs text-text-secondary">Resolution Width</label>
                                    <input v-model.number="store.settings.display.width" type="number" class="bg-bg-input border border-border rounded px-3 py-1.5 text-sm text-text-primary outline-none focus:border-accent transition-colors" />
                                </div>
                                <div class="flex flex-col gap-1">
                                    <label class="text-xs text-text-secondary">Resolution Height</label>
                                    <input v-model.number="store.settings.display.height" type="number" class="bg-bg-input border border-border rounded px-3 py-1.5 text-sm text-text-primary outline-none focus:border-accent transition-colors" />
                                </div>
                            </div>
                            
                            <div class="flex items-center gap-2 mt-4">
                                <input v-model="store.settings.display.fullscreen" type="checkbox" id="fullscreen" class="accent-accent" />
                                <label for="fullscreen" class="text-sm">Start in Fullscreen</label>
                            </div>

                            <div class="flex items-center gap-2">
                                <input v-model="store.settings.display.pixelArt" type="checkbox" id="pixelart" class="accent-accent" />
                                <label for="pixelart" class="text-sm">Pixel Art Mode (Nearest Neighbor)</label>
                            </div>

                             <div class="flex flex-col gap-1 mt-4">
                                <label class="text-xs text-text-secondary">Background Color</label>
                                <div class="flex gap-2">
                                    <input v-model="store.settings.display.backgroundColor" type="color" class="h-8 w-16 bg-transparent border border-border rounded cursor-pointer" />
                                    <input v-model="store.settings.display.backgroundColor" type="text" class="bg-bg-input border border-border rounded px-3 py-1.5 text-sm text-text-primary outline-none focus:border-accent transition-colors flex-1" />
                                </div>
                            </div>
                        </div>

                        <!-- PHYSICS TAB -->
                        <div v-if="activeTab === 'physics'" class="space-y-4 animate-fade-in">
                             <h3 class="text-lg font-bold text-accent mb-4">Physics World</h3>
                             
                             <div class="flex flex-col gap-2 p-4 bg-bg-panel rounded border border-border">
                                <label class="text-xs font-bold text-text-primary">Gravity Vector</label>
                                <div class="flex gap-4">
                                    <div class="flex items-center gap-2">
                                        <span class="text-text-secondary text-xs">X:</span>
                                        <input v-model.number="store.settings.physics.gravity.x" type="number" class="bg-bg-input border border-border rounded px-3 py-1.5 text-sm text-text-primary outline-none focus:border-accent transition-colors w-24" />
                                    </div>
                                    <div class="flex items-center gap-2">
                                        <span class="text-text-secondary text-xs">Y:</span>
                                        <input v-model.number="store.settings.physics.gravity.y" type="number" class="bg-bg-input border border-border rounded px-3 py-1.5 text-sm text-text-primary outline-none focus:border-accent transition-colors w-24" />
                                    </div>
                                </div>
                             </div>

                             <div class="flex items-center gap-2 mt-4">
                                <input v-model="store.settings.physics.debugDraw" type="checkbox" id="debugDraw" class="accent-accent" />
                                <label for="debugDraw" class="text-sm">Enable Debug Draw (Colliders)</label>
                            </div>
                        </div>

                        <!-- TAGS TAB -->
                        <div v-if="activeTab === 'tags'" class="space-y-4 animate-fade-in">
                            <h3 class="text-lg font-bold text-accent mb-4">Tags & Layers</h3>

                            <!-- Tags -->
                            <div class="mb-6">
                                <div class="flex justify-between items-center mb-2">
                                    <label class="text-sm font-bold">Tags</label>
                                    <button @click="store.settings.tags.push('NewTag')" class="text-xs bg-bg-hover hover:bg-accent-color hover:text-text-accent px-2 py-1 rounded transition">+</button>
                                </div>
                                <div class="flex flex-wrap gap-2">
                                    <div v-for="(_tag, index) in store.settings.tags" :key="index" class="flex items-center bg-bg-panel border border-border rounded px-2 py-1 text-xs">
                                        <input v-model="store.settings.tags[index]" class="bg-transparent outline-none w-20" />
                                        <button @click="store.settings.tags.splice(index, 1)" class="ml-2 text-red-500 hover:text-red-400">×</button>
                                    </div>
                                </div>
                            </div>
                            
                             <!-- Layers -->
                            <div>
                                <div class="flex justify-between items-center mb-2">
                                    <label class="text-sm font-bold">Collision Layers</label>
                                     <button @click="store.settings.layers.push('NewLayer')" class="text-xs bg-bg-hover hover:bg-accent hover:text-white px-2 py-1 rounded transition">+</button>
                                </div>
                                 <div class="flex flex-col gap-2">
                                    <div v-for="(_layer, index) in store.settings.layers" :key="index" class="flex items-center bg-bg-panel border border-border rounded px-2 py-1 text-xs">
                                        <span class="mr-2 text-text-disabled">{{ index }}:</span>
                                        <input v-model="store.settings.layers[index]" class="bg-transparent outline-none flex-1" />
                                         <button @click="store.settings.layers.splice(index, 1)" class="ml-2 text-red-500 hover:text-red-400">×</button>
                                    </div>
                                </div>
                            </div>
                        </div>

                        <!-- LAYOUTS TAB -->
                        <div v-if="activeTab === 'layouts'" class="space-y-4 animate-fade-in">
                             <h3 class="text-lg font-bold text-accent mb-4">Saved Layouts</h3>
                             
                             <div v-if="!store.settings.layouts || Object.keys(store.settings.layouts).length === 0" class="text-text-secondary italic text-sm">
                                 No saved layouts. Use "Layout -> Save Layout..." to create one.
                             </div>

                             <div class="flex flex-col gap-2">
                                <div v-for="(_json, name) in store.settings.layouts" :key="name" class="flex items-center justify-between bg-bg-panel border border-border rounded px-4 py-3">
                                    <div class="flex items-center gap-3">
                                         <div class="w-8 h-8 rounded bg-bg-base flex items-center justify-center text-accent">
                                            <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="3" width="18" height="18" rx="2" ry="2"/><line x1="3" y1="9" x2="21" y2="9"/><line x1="9" y1="21" x2="9" y2="9"/></svg>
                                         </div>
                                         <span class="font-bold text-sm text-text-primary">{{ name }}</span>
                                    </div>
                                    <button 
                                        @click="delete store.settings.layouts[name]; store.isDirty = true;" 
                                        class="text-text-secondary hover:text-red-500 transition-colors p-1"
                                        title="Delete Layout"
                                    >
                                        <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="3 6 5 6 21 6"/><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/><line x1="10" y1="11" x2="10" y2="17"/><line x1="14" y1="11" x2="14" y2="17"/></svg>
                                    </button>
                                </div>
                            </div>
                        </div>

                    </div>
                </div>

                <!-- Footer -->
                <div class="h-14 border-t border-border bg-bg-header px-6 flex items-center justify-end gap-3 rounded-b-lg">
                    <button @click="onClose" class="px-4 py-2 text-sm text-text-secondary hover:text-text-primary transition">Cancel</button>
                    <button @click="onApply" class="px-4 py-2 text-sm bg-bg-hover border border-border rounded hover:bg-bg-selection transition">Apply</button>
                    <button @click="onSave" class="px-6 py-2 text-sm bg-accent-color text-text-accent font-bold rounded shadow hover:bg-accent-hover transition">
                        Save Project
                    </button>
                </div>

             </DialogContent>
        </DialogPortal>
    </DialogRoot>
</template>

<style scoped>


.animate-fade-in {
    animation: fadeIn 0.2s ease-out;
}

@keyframes fadeIn {
    from { opacity: 0; transform: translateY(5px); }
    to { opacity: 1; transform: translateY(0); }
}
</style>
