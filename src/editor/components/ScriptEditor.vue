<script setup lang="ts">
import { ref, watch } from 'vue';
import type { Entity } from '../../engine/ecs/ECS';

import AssetPickerModal from './modals/AssetPickerModal.vue';
import { getFileSystem } from '../../api/FileSystem';

const props = defineProps<{
  entity: Entity
}>();

// Wrapper interface to give stable identity to scripts
interface ScriptUI {
    _id: string; // Internal visual ID
    path: string;
    parameters: any;
}

const scriptsUI = ref<ScriptUI[]>([]);
const availablePropsMap = ref<Map<string, Array<{name: string, default: any}>>> (new Map());
const currentParamsMap = ref<Map<string, Record<string, any>>> (new Map());

const getScriptName = (path: string) => {
    if (!path) return 'Empty Script';
    const parts = path.split(/[\\/]/);
    return parts[parts.length - 1];
};

// Sync back to ECS
const syncToEntity = () => {
    if (!props.entity) return;
    
    // Map UI structure back to simple data structure
    const data = scriptsUI.value.map(s => ({
        path: s.path,
        parameters: { ...s.parameters }
    }));
    
    // Assign a NEW array to force reactivity if needed, though Vue buffers might be smart.
    // Ideally we should replace the array content or re-assign.
    props.entity.script = data;
};

const loadScriptProperties = async (path: string, id: string) => {
    if (!path) {
        availablePropsMap.value.set(id, []);
        return;
    }

    try {
        const fs = getFileSystem();
        const url = await fs.getAssetURL(path);
        
        // For Blob URLs, omit cache buster
        const isBlob = url.startsWith('blob:');
        const cacheBuster = isBlob ? '' : `?t=${Date.now()}`;

        // @ts-ignore
        const module = await import(/* @vite-ignore */ url + cacheBuster);
        
        if (module.properties) {
            const propsList = Object.entries(module.properties).map(([key, defaultValue]) => ({
                name: key,
                default: defaultValue
            }));
            availablePropsMap.value.set(id, propsList);

            // Sync values from existing data to our map
            const scriptData = scriptsUI.value.find(s => s._id === id);
            if (scriptData) {
                const existingParams = scriptData.parameters || {};
                const newParams: Record<string, any> = {};

                propsList.forEach(p => {
                    // Preserve existing value if type matches or just exists, otherwise use default
                    newParams[p.name] = existingParams[p.name] !== undefined ? existingParams[p.name] : p.default;
                });

                currentParamsMap.value.set(id, newParams);
                scriptData.parameters = newParams;
                syncToEntity();
            }
        } else {
             availablePropsMap.value.set(id, []);
        }
    } catch (e) {
        console.warn('Failed to load script properties:', e);
        availablePropsMap.value.set(id, []);
    }
};

const updateParams = (id: string) => {
    const scriptData = scriptsUI.value.find(s => s._id === id);
    const params = currentParamsMap.value.get(id);
    if (scriptData && params) {
        scriptData.parameters = { ...params };
        syncToEntity();
    }
};

const init = () => {
    const sourceScripts = props.entity.script || [];
    
    // Rebuild UI array from source
    // Note: This resets IDs if called repeatedly on same entity ref-change?
    // We should only do this if entity ID changed or length mismatch?
    // For simplicity, we rebuild on entity change.
    
    scriptsUI.value = sourceScripts.map(s => ({
        _id: crypto.randomUUID(),
        path: s.path,
        parameters: s.parameters ? { ...s.parameters } : {}
    }));
    
    // Load properties for all
    scriptsUI.value.forEach(s => loadScriptProperties(s.path, s._id));
};

watch(() => props.entity, init, { immediate: true });

const addScript = () => {
    const newId = crypto.randomUUID();
    scriptsUI.value.push({ _id: newId, path: '', parameters: {} });
    syncToEntity();
};

const removeScript = (index: number) => {
    const script = scriptsUI.value[index];
    if (script) {
        // Clean up maps
        availablePropsMap.value.delete(script._id);
        currentParamsMap.value.delete(script._id);
    }
    scriptsUI.value.splice(index, 1);
    syncToEntity();
};

// Modal Handling
const isPickerOpen = ref(false);
const activeScriptId = ref('');

const openPicker = (id: string) => {
    activeScriptId.value = id;
    isPickerOpen.value = true;
};

const onSelectAsset = (path: string) => {
    const script = scriptsUI.value.find(s => s._id === activeScriptId.value);
    if (script) {
        script.path = path;
        loadScriptProperties(path, script._id);
        syncToEntity();
    }
};

const onDrop = (e: DragEvent, id: string) => {
    const path = e.dataTransfer?.getData('text/plain');
    if (path) {
        const script = scriptsUI.value.find(s => s._id === id);
        if (script) {
            script.path = path;
            loadScriptProperties(path, id);
            syncToEntity();
        }
    }
};
</script>

<template>
  <div class="bg-bg-panel rounded p-2 mb-2">
    <div class="flex justify-between items-center font-bold mb-2 text-text-primary border-b border-border pb-1">
        <span>Scripts</span>
        <button @click="addScript" class="text-xs text-accent-color hover:text-white">+ Add Script</button>
    </div>
    
    <div v-if="scriptsUI.length === 0" class="text-xs text-text-secondary italic p-1">
        No scripts attached.
    </div>

    <div v-for="(script, idx) in scriptsUI" :key="script._id" class="mb-2 bg-bg-panel border border-border rounded overflow-hidden">
        <!-- Header -->
        <div class="flex justify-between items-center p-2 bg-bg-header border-b border-border select-none">
            <div class="flex items-center gap-2 overflow-hidden">
                <span class="text-accent-color">📜</span>
                <span class="font-bold text-xs truncate" :title="script.path">{{ getScriptName(script.path) }}</span>
            </div>
            <div class="flex items-center gap-1">
                 <button 
                    @click="removeScript(idx)" 
                    class="p-1 hover:bg-bg-hover hover:text-red-400 rounded text-text-secondary transition-colors"
                    title="Remove Script"
                >
                    <svg xmlns="http://www.w3.org/2000/svg" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><line x1="18" y1="6" x2="6" y2="18"></line><line x1="6" y1="6" x2="18" y2="18"></line></svg>
                </button>
            </div>
        </div>

        <!-- Body -->
        <div class="p-2 bg-bg-base/50">
             <!-- Parameters -->
            <div v-if="availablePropsMap.get(script._id)?.length" class="mb-3 space-y-2">
                <div v-for="prop in availablePropsMap.get(script._id)" :key="prop.name" class="flex items-center justify-between group">
                    <label class="text-xs text-text-secondary w-1/3 truncate" :title="prop.name">{{ prop.name }}</label>
                    <div class="w-2/3 flex justify-end" v-if="currentParamsMap.get(script._id)">
                        <input 
                            v-if="typeof prop.default === 'number'"
                            type="number"
                            v-model.number="currentParamsMap.get(script._id)![prop.name]"
                            @change="updateParams(script._id)"
                            class="u-input text-right"
                        />
                        <input 
                            v-else-if="typeof prop.default === 'boolean'"
                            type="checkbox"
                            v-model="currentParamsMap.get(script._id)![prop.name]"
                            @change="updateParams(script._id)"
                            class="h-4 w-4 rounded border-border bg-bg-input text-accent-color focus:ring-offset-bg-base cursor-pointer"
                        />
                        <input 
                            v-else
                            type="text"
                            v-model="currentParamsMap.get(script._id)![prop.name]"
                            @change="updateParams(script._id)"
                            class="u-input text-right"
                        />
                    </div>
                </div>
            </div>
             <div v-else class="text-xs text-text-secondary/50 italic mb-2 text-center">
                No parameters
            </div>

            <!-- Source File (Small) -->
            <div class="pt-2 border-t border-border flex items-center gap-2 opacity-60 hover:opacity-100 transition-opacity">
                <label class="text-[10px] uppercase text-text-secondary font-bold w-12 shrink-0">Source</label>
                <div 
                    class="flex-1 flex gap-1 bg-bg-input rounded border border-border overflow-hidden"
                    @dragover.prevent 
                    @drop.prevent="(e) => onDrop(e, script._id)"
                >
                     <input 
                        type="text" 
                        v-model="script.path" 
                        @change="loadScriptProperties(script.path, script._id)" 
                        class="bg-transparent border-none text-[10px] px-1 py-0.5 w-full focus:outline-none text-text-secondary"
                    />
                    <button 
                         @click="openPicker(script._id)"
                        class="px-1.5 hover:bg-bg-hover hover:text-white text-text-secondary border-l border-border"
                    >
                        📂
                    </button>
                </div>
            </div>
        </div>
    </div>

    <!-- Asset Picker -->
    <AssetPickerModal 
        v-if="isPickerOpen"
        :isOpen="isPickerOpen"
        type="script"
        :onSelect="onSelectAsset"
        :onClose="() => isPickerOpen = false"
    />
  </div>
</template>
