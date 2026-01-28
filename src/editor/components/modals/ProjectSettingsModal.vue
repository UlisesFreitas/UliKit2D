<script setup lang="ts">
import { ref } from 'vue';
import { useProjectSettingsStore } from '../../../stores/useProjectSettingsStore';
// import { ProjectSettingsManager } from '../../managers/ProjectSettingsManager'; // Removed
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
const activeTab = ref<'general' | 'display' | 'input' | 'time' | 'audio' | 'physics' | 'editor' | 'tags' | 'layouts'>('general');

const onClose = () => {
    if (store.isDirty) {
        // Optional: Confirm discard?
        // For now, just close. Changes in store persist in memory until restart or manual revert.
    }
    emit('update:open', false);
};

const onSave = async () => {
    // Save to Disk via Manifest (ProjectManager)
    const { ProjectManager } = await import('../../managers/ProjectManager');
    await ProjectManager.saveProject();

    ui.showToast({ title: 'Settings Saved', description: 'Project configuration updated.', type: 'success' });
    store.applySettings();
    emit('update:open', false);
};

const onApply = () => {
    store.applySettings();
    ui.showToast({ title: 'Settings Applied', description: 'Changes applied to runtime.' });
};

// Collision Matrix Helpers (Bitwise)
const getCollision = (rowIdx: number, colIdx: number) => {
    const matrix = store.settings.physics.layerCollisionMatrix;
    if (!matrix) return true;
    
    // Default = Collide All (0xFFFFFFFF)
    const mask = matrix[rowIdx] ?? 0xFFFFFFFF;
    
    // Check bit
    return (mask & (1 << colIdx)) !== 0;
};

const toggleCollision = (rowIdx: number, colIdx: number) => {
    if (!store.settings.physics.layerCollisionMatrix) store.settings.physics.layerCollisionMatrix = {};
    const matrix = store.settings.physics.layerCollisionMatrix;
    
    const currentMask = matrix[rowIdx] ?? 0xFFFFFFFF;
    const targetMask = matrix[colIdx] ?? 0xFFFFFFFF;
    
    const isColliding = (currentMask & (1 << colIdx)) !== 0;
    
    if (isColliding) {
        // TURN OFF (Clear bit)
        // ~(1 << colIdx) creates mask where only that bit is 0, rest 1.
        matrix[rowIdx] = currentMask & ~(1 << colIdx);
        matrix[colIdx] = targetMask & ~(1 << rowIdx);
    } else {
        // TURN ON (Set bit)
        matrix[rowIdx] = currentMask | (1 << colIdx);
        matrix[colIdx] = targetMask | (1 << rowIdx);
    }
    
    store.isDirty = true;
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
                            v-for="tab in ['General', 'Display', 'Input', 'Time', 'Audio', 'Physics', 'Editor', 'Tags & Layers', 'Layouts']"
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

                        <!-- INPUT TAB -->
                        <div v-if="activeTab === 'input'" class="space-y-6 animate-fade-in">
                            <h3 class="text-lg font-bold text-accent mb-4">Input Manager</h3>

                            <!-- Actions -->
                            <div class="space-y-4">
                                <div class="flex justify-between items-center border-b border-white/10 pb-2">
                                    <h4 class="font-bold text-sm">Actions (Buttons)</h4>
                                    <button @click="store.settings.input.actions['NewAction'] = ['Space']" class="text-xs bg-bg-hover hover:bg-accent px-2 py-1 rounded transition">+ Add Action</button>
                                </div>
                                
                                <div v-if="Object.keys(store.settings.input.actions).length === 0" class="text-text-secondary text-xs italic">
                                    No actions defined.
                                </div>

                                <div v-for="(keys, name) in store.settings.input.actions" :key="name" class="bg-bg-panel border border-border rounded p-3">
                                    <div class="flex items-center justify-between mb-2">
                                        <div class="flex items-center gap-2">
                                            <span class="text-text-secondary text-xs">Name:</span>
                                            <!-- Rename Logic (Simple Hack: Delete & Re-add if logic needed, for now just allow editing Key, not Name easily without sophisticated UI component) -->
                                            <!-- Actually let's use a non-model input for name or advanced refactor later. For now read-only name or basic support -->
                                            <span class="font-bold text-sm">{{ name }}</span> 
                                        </div>
                                        <button @click="delete store.settings.input.actions[name]" class="text-red-500 hover:text-red-400 text-xs">Remove</button>
                                    </div>
                                    <div class="flex flex-wrap gap-2">
                                        <div v-for="(_key, kIndex) in keys" :key="kIndex" class="flex items-center bg-bg-base rounded px-2 py-1 text-xs border border-white/10">
                                            <input v-model="store.settings.input.actions[name]![kIndex]" class="bg-transparent outline-none w-20 text-center" />
                                            <button @click="store.settings.input.actions[name]!.splice(kIndex, 1)" class="ml-2 text-white/50 hover:text-white">×</button>
                                        </div>
                                        <button @click="store.settings.input.actions[name]?.push('')" class="text-xs bg-white/5 hover:bg-white/10 px-2 py-1 rounded text-white/70">+</button>
                                    </div>
                                </div>
                            </div>

                            <!-- Axes -->
                             <div class="space-y-4">
                                <div class="flex justify-between items-center border-b border-white/10 pb-2">
                                    <h4 class="font-bold text-sm">Axes (Analog/Digital)</h4>
                                    <button @click="store.settings.input.axes['NewAxis'] = { negative: 'Left', positive: 'Right', gravity: 3, sensitivity: 3, dead: 0.001 }" class="text-xs bg-bg-hover hover:bg-accent px-2 py-1 rounded transition">+ Add Axis</button>
                                </div>

                                <div v-if="Object.keys(store.settings.input.axes).length === 0" class="text-text-secondary text-xs italic">
                                    No axes defined.
                                </div>
                                
                                <div v-for="(config, name) in store.settings.input.axes" :key="name" class="bg-bg-panel border border-border rounded p-3 text-xs">
                                     <div class="flex items-center justify-between mb-2">
                                        <span class="font-bold text-sm">{{ name }}</span>
                                        <button @click="delete store.settings.input.axes[name]" class="text-red-500 hover:text-red-400">Remove</button>
                                    </div>
                                    
                                    <div class="grid grid-cols-2 gap-4">
                                        <div class="space-y-2">
                                            <div class="flex justify-between">
                                                <span class="text-text-secondary">Negative</span>
                                                <input v-model="config.negative" class="bg-bg-input border border-border px-1 w-24 rounded" />
                                            </div>
                                            <div class="flex justify-between">
                                                <span class="text-text-secondary">Positive</span>
                                                <input v-model="config.positive" class="bg-bg-input border border-border px-1 w-24 rounded" />
                                            </div>
                                            <div class="flex justify-between">
                                                <span class="text-text-secondary">Alt Neg</span>
                                                <input v-model="config.altNegative" class="bg-bg-input border border-border px-1 w-24 rounded" />
                                            </div>
                                            <div class="flex justify-between">
                                                <span class="text-text-secondary">Alt Pos</span>
                                                <input v-model="config.altPositive" class="bg-bg-input border border-border px-1 w-24 rounded" />
                                            </div>
                                        </div>
                                        
                                        <div class="space-y-2">
                                            <div class="flex justify-between">
                                                <span class="text-text-secondary">Gravity</span>
                                                <input v-model.number="config.gravity" type="number" class="bg-bg-input border border-border px-1 w-16 rounded text-right" />
                                            </div>
                                            <div class="flex justify-between">
                                                <span class="text-text-secondary">Sensitivity</span>
                                                <input v-model.number="config.sensitivity" type="number" class="bg-bg-input border border-border px-1 w-16 rounded text-right" />
                                            </div>
                                            <div class="flex justify-between">
                                                <span class="text-text-secondary">Dead Zone</span>
                                                <input v-model.number="config.dead" type="number" step="0.01" class="bg-bg-input border border-border px-1 w-16 rounded text-right" />
                                            </div>
                                        </div>
                                    </div>
                                </div>
                            </div>
                        </div>

                        <!-- TIME TAB -->
                        <div v-if="activeTab === 'time'" class="space-y-4 animate-fade-in">
                             <h3 class="text-lg font-bold text-accent mb-4">Time Settings</h3>
                             
                             <div class="grid grid-cols-1 gap-4">
                                <div class="flex flex-col gap-1">
                                    <label class="text-xs text-text-secondary">Fixed Timestep</label>
                                    <input v-model.number="store.settings.time.fixedTimestep" type="number" step="0.001" class="bg-bg-input border border-border rounded px-3 py-1.5 text-sm text-text-primary outline-none focus:border-accent transition-colors" />
                                </div>
                                <div class="flex flex-col gap-1">
                                    <label class="text-xs text-text-secondary">Maximum Allowed Timestep</label>
                                    <input v-model.number="store.settings.time.maxAllowedTimestep" type="number" step="0.001" class="bg-bg-input border border-border rounded px-3 py-1.5 text-sm text-text-primary outline-none focus:border-accent transition-colors" />
                                </div>
                                <div class="flex flex-col gap-1">
                                    <label class="text-xs text-text-secondary">Time Scale</label>
                                    <input v-model.number="store.settings.time.timeScale" type="number" step="0.1" class="bg-bg-input border border-border rounded px-3 py-1.5 text-sm text-text-primary outline-none focus:border-accent transition-colors" />
                                </div>
                                <div class="flex flex-col gap-1">
                                    <label class="text-xs text-text-secondary">Maximum Particle Timestep</label>
                                    <input type="number" value="0.03" disabled class="bg-bg-input border border-border rounded px-3 py-1.5 text-sm text-text-disabled outline-none opacity-50 cursor-not-allowed" />
                                    <p class="text-[10px] text-text-secondary opacity-70">Not implemented yet (Particles System).</p>
                                </div>
                             </div>
                        </div>

                        <!-- AUDIO TAB -->
                        <div v-if="activeTab === 'audio'" class="space-y-6 animate-fade-in">
                             <h3 class="text-lg font-bold text-accent mb-4">Audio Settings</h3>
                             
                             <div class="flex flex-col gap-1">
                                <label class="text-xs text-text-secondary">Master Volume</label>
                                <div class="flex items-center gap-2">
                                     <input v-model.number="store.settings.audio.masterVolume" type="range" min="0" max="1" step="0.01" class="flex-1 accent-accent" />
                                     <span class="text-xs w-8 text-right">{{ (store.settings.audio.masterVolume * 100).toFixed(0) }}%</span>
                                </div>
                             </div>

                             <div class="border-t border-white/10 pt-4">
                                <h4 class="font-bold text-sm mb-2">Channels / Buses</h4>
                                <div v-for="(config, name) in store.settings.audio.channels" :key="name" class="flex items-center gap-4 bg-bg-panel p-2 rounded mb-2">
                                     <div class="w-16 font-bold text-xs">{{ name }}</div>
                                     <input v-model.number="config.volume" type="range" min="0" max="1" step="0.01" class="flex-1 accent-accent" :disabled="config.muted" />
                                     <span class="text-xs w-8 text-right">{{ (config.volume * 100).toFixed(0) }}%</span>
                                     <div class="flex items-center gap-1">
                                        <input v-model="config.muted" type="checkbox" :id="'mute-'+name" class="accent-red-500" />
                                        <label :for="'mute-'+name" class="text-xs text-text-secondary">Mute</label>
                                     </div>
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

                             <!-- Collision Matrix -->
                            <div class="mt-6">
                                <h4 class="font-bold text-sm mb-2">Collision Matrix</h4>
                                <div class="overflow-x-auto bg-bg-panel border border-border rounded p-4">
                                    <table class="w-full text-xs">
                                        <thead>
                                            <tr>
                                                <th class="p-1"></th>
                                                <template v-for="(layer, cIndex) in store.settings.layers" :key="'h-'+cIndex">
                                                    <th v-if="layer" class="p-1 text-center font-normal text-text-secondary rotate-45 h-16 w-8">{{ layer }}</th>
                                                </template>
                                            </tr>
                                        </thead>
                                        <tbody>
                                            <template v-for="(rowLayer, rIndex) in store.settings.layers" :key="'r-'+rIndex">
                                                <tr v-if="rowLayer">
                                                    <td class="p-1 text-right font-bold text-text-primary px-2 whitespace-nowrap">{{ rowLayer }}</td>
                                                    <template v-for="(colLayer, cIndex) in store.settings.layers" :key="'c-'+cIndex">
                                                        <td v-if="colLayer" class="p-1 text-center">
                                                            <input 
                                                                type="checkbox" 
                                                                :checked="getCollision(rIndex, cIndex)" 
                                                                @change="toggleCollision(rIndex, cIndex)"
                                                                class="accent-accent cursor-pointer"
                                                            />
                                                        </td>
                                                    </template>
                                                </tr>
                                            </template>
                                        </tbody>
                                    </table>
                                </div>
                                <p class="text-[10px] text-text-secondary mt-2">Unchecked pairs will not collide physically.</p>
                            </div>
                        </div>

                        <!-- EDITOR TAB -->
                         <div v-if="activeTab === 'editor'" class="space-y-4 animate-fade-in">
                             <h3 class="text-lg font-bold text-accent mb-4">Editor Configuration</h3>
                             
                             <div class="flex flex-col gap-4 p-4 bg-bg-panel rounded border border-border">
                                <h4 class="text-sm font-bold text-text-primary border-b border-border pb-2 mb-2">Command History (Undo/Redo)</h4>
                                
                                <div class="grid grid-cols-2 gap-4">
                                    <div class="flex flex-col gap-1">
                                        <label class="text-xs text-text-secondary">Max Steps</label>
                                        <input v-model.number="store.settings.editor.historyMaxSteps" type="number" min="1" max="1000" class="bg-bg-input border border-border rounded px-3 py-1.5 text-sm text-text-primary outline-none focus:border-accent transition-colors" />
                                        <p class="text-[10px] text-text-secondary opacity-70">Maximum number of undo steps stored.</p>
                                    </div>
                                    <div class="flex flex-col gap-1">
                                        <label class="text-xs text-text-secondary">Max Bytes (Approx)</label>
                                        <input v-model.number="store.settings.editor.historyMaxBytes" type="number" min="0" class="bg-bg-input border border-border rounded px-3 py-1.5 text-sm text-text-primary outline-none focus:border-accent transition-colors" />
                                         <p class="text-[10px] text-text-secondary opacity-70">Soft limit in bytes (0 = Unlimited). Currently unused.</p>
                                    </div>
                                </div>
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
                                     <button @click="store.addLayer('NewLayer')" class="text-xs bg-bg-hover hover:bg-accent hover:text-white px-2 py-1 rounded transition">+</button>
                                </div>
                                 <div class="flex flex-col gap-2">
                                     <div v-for="(_layer, index) in store.settings.layers" :key="index" class="flex items-center bg-bg-panel border border-border rounded px-2 py-1 text-xs">
                                        <span class="mr-2 text-text-disabled">{{ index }}:</span>
                                        <input 
                                            :value="store.settings.layers[index]" 
                                            @change="(e) => store.renameLayer(index, (e.target as HTMLInputElement).value)"
                                            class="bg-transparent outline-none flex-1"
                                            :disabled="index === 0"
                                            :class="{'text-text-disabled': index === 0}"
                                        />
                                         <button 
                                            v-if="index !== 0"
                                            @click="store.removeLayer(index)" 
                                            class="ml-2 text-red-500 hover:text-red-400"
                                        >
                                            ×
                                        </button>
                                        <div v-else class="ml-2 w-3"></div> <!-- Spacer -->
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
                    <button @click="onClose" class="px-4 py-2 text-sm font-medium rounded shadow-sm text-white bg-zinc-700 hover:bg-zinc-600 transition-colors border border-transparent">Cancel</button>
                    <button @click="onApply" class="px-4 py-2 text-sm font-medium rounded shadow-sm text-white bg-zinc-700 hover:bg-zinc-600 transition-colors border border-transparent">Apply</button>
                    <button @click="onSave" class="px-6 py-2 text-sm font-bold rounded shadow-sm text-white bg-zinc-700 hover:bg-zinc-600 transition-colors border border-transparent">
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
