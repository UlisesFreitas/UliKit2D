<script setup lang="ts">
import { computed, ref, onMounted, onUnmounted, toRaw } from 'vue';
import { useEditorStore } from '../../stores/useEditorStore';
import { world } from '../../engine/ecs/ECS';
import { eventBus } from '../../engine/core/EventBus';
import { projectState } from '../managers/ProjectManager';
import { getFileSystem } from '../../api/FileSystem';

import TransformEditor from '../components/inspectors/TransformEditor.vue';
import CameraEditor from '../components/inspectors/CameraEditor.vue';
import SpriteEditor from '../components/inspectors/SpriteEditor.vue';
import RigidBodyEditor from '../components/inspectors/RigidBodyEditor.vue';
import BoxColliderEditor from '../components/inspectors/BoxColliderEditor.vue';
import AudioSourceEditor from '../components/inspectors/AudioSourceEditor.vue';
import LabelEditor from '../components/inspectors/LabelEditor.vue';
import AnimatorEditor from '../components/inspectors/AnimatorEditor.vue';
import ScriptInspector from '../components/inspectors/ScriptInspector.vue';
import BitmapTextEditor from '../components/inspectors/BitmapTextEditor.vue';
// ... imports
import NineSliceEditor from '../components/inspectors/NineSliceEditor.vue';

import AddComponentModal from '../components/modals/AddComponentModal.vue';

// ...



const editorStore = useEditorStore();
const revision = ref(0);
const isAddModalOpen = ref(false);

const handleEntityUpdate = (id: string) => {
    if (editorStore.selectedEntityId === id) {
        revision.value++;
    }
};

onMounted(() => {
    eventBus.on('entity-updated', handleEntityUpdate);
});

onUnmounted(() => {
    eventBus.off('entity-updated', handleEntityUpdate);
});

const selectedEntity = computed(() => {
    if (!editorStore.selectedEntityId) return null;
    return world.where(e => e.id === editorStore.selectedEntityId).first || null;
});

// Computed "Flat" list of inspector items
const inspectorItems = computed(() => {
    revision.value; // Dependency
    if (!selectedEntity.value) return [];

    const items: { type: string; key: string; data: any; index?: number }[] = [];
    const ent = selectedEntity.value as any;

    // 1. Transform always first
    if (ent.transform) {
        items.push({ type: 'component', key: 'transform', data: ent.transform });
    }

    // 2. Other Components
    for (const key in ent) {
        if (['id', 'name', 'visible', 'transform', 'script'].includes(key)) continue;
        items.push({ type: 'component', key, data: ent[key] });
    }

    // 3. Scripts (Exploded into individual items)
    if (ent.script && Array.isArray(ent.script)) {
        ent.script.forEach((scriptData: any, idx: number) => {
            items.push({ type: 'script', key: `script-${idx}`, data: scriptData, index: idx });
        });
    }

    return items;
});



// Helper to parse default parameters from script content
const parseScriptParameters = async (path: string) => {
    try {
        const fs = getFileSystem();
        const content = await fs.readFile(path);
        const params: Record<string, any> = {};

        // Strategy 1: Look for "export const properties = { ... }" pattern (JSON-like)
        const propsRegex = /export\s+const\s+properties\s*=\s*({[\s\S]*?});/;
        const propsMatch = propsRegex.exec(content);
        
        if (propsMatch && propsMatch[1]) {
            // Found a properties object. Let's parse the inner key-values manually 
            // to avoid using eval/JSON.parse on raw code.
            const inner = propsMatch[1];
            // Match "key: value," or "key: value"
            const kvRegex = /(\w+)\s*:\s*(.+?)(,|$|\n)/g;
            let m;
            while ((m = kvRegex.exec(inner)) !== null) {
                if (!m[1] || !m[2]) continue;
                const key = m[1];
                let valStr = m[2].trim();
                // cleanup trailing comma if caught
                if (valStr.endsWith(',')) valStr = valStr.slice(0, -1);
                
                // Parse primitive values
                if (valStr === 'true') params[key] = true;
                else if (valStr === 'false') params[key] = false;
                else if (!isNaN(Number(valStr))) params[key] = Number(valStr);
                else if (valStr.startsWith('"') || valStr.startsWith("'")) params[key] = valStr.slice(1, -1);
            }
        } 
        
        // Strategy 2: Look for top-level assignments "var/let/const x = y;" or just "x = y;"
        // This acts as a fallback or simpler format support
        const simpleRegex = /^\s*(?:export\s+)?(?:const|let|var)?\s*(\w+)\s*=\s*(.+?);/gm;
        let match: RegExpExecArray | null;
        while ((match = simpleRegex.exec(content)) !== null) {
            if (!match[1] || !match[2]) continue;
            // Avoid capturing 'properties' itself if it matched above
            if (match[1] === 'properties') continue;

            const key = match[1];
            let valueStr = match[2].trim();
            
            if (valueStr === 'true') params[key] = true;
            else if (valueStr === 'false') params[key] = false;
            else if (!isNaN(Number(valueStr))) params[key] = Number(valueStr);
            else if (valueStr.startsWith('"') || valueStr.startsWith("'")) params[key] = valueStr.slice(1, -1);
        }

        return params;
    } catch (e) {
        console.warn('Failed to parse script parameters:', e);
        return {};
    }
};

const onComponentUpdate = () => {
    revision.value++;
    projectState.isDirty = true;
    if (selectedEntity.value) {
        eventBus.emit('entity-updated', selectedEntity.value.id);
    }
};

const removeComponent = (key: string) => {
    if (!selectedEntity.value) return;
    world.removeComponent(selectedEntity.value, key as any);
    onComponentUpdate();
};

const removeScript = (index: number) => {
    if (!selectedEntity.value) return;
    const currentScripts = (selectedEntity.value as any).script;
    if (!currentScripts || !Array.isArray(currentScripts)) return;

    const scripts = [...currentScripts];
    scripts.splice(index, 1);
    
    // Use toRaw to ensure we are modifying the original ECS entity, not a Vue proxy
    const rawEntity = toRaw(selectedEntity.value);

    if (scripts.length === 0) {
        // If no scripts left, remove the component entirely to clean up ECS state
        // Use explicit removing
        world.removeComponent(rawEntity, 'script');
    } else {
        // Update with new array
        world.addComponent(rawEntity, 'script', scripts);
    }
    
    onComponentUpdate();
};

const handleAddComponent = async (payload: { type: string, data: any }) => {
    if (!selectedEntity.value) return;

    // Use toRaw for Miniplex operations
    const rawEntity = toRaw(selectedEntity.value);

    if (payload.type === 'script') {
        const currentScripts = selectedEntity.value.script || [];
        
        // Parse parameters first
        const defaults = await parseScriptParameters(payload.data.path);
        
        // Add new script
        const newScripts = [...currentScripts, { path: payload.data.path, parameters: defaults }];
        
        // If it's the first script, add the component, otherwise update it
        // Note: Miniplex addComponent overwrites if exists? Or we just assign prop?
        // Using addComponent is safer to ensure index registration
        world.addComponent(rawEntity, 'script', newScripts);
    } else {
        // Native component defaults
        let data = payload.data;
        if (payload.type === 'rigidBody' && Object.keys(data).length === 0) {
            data = { mass: 1, isStatic: false, friction: 0.5, restitution: 0.0 };
        } else if (payload.type === 'boxCollider' && Object.keys(data).length === 0) {
            // Default size matching the sprite or generic
            data = { width: 100, height: 100 };
            if (rawEntity.sprite) {
                // If has sprite, try to match size? (Ideally read image, but this is async/complex here)
                // For now stick to safe default
            }
        } else if (payload.type === 'audioSource' && Object.keys(data).length === 0) {
             data = { clip: '', volume: 1.0, loop: false, playOnAwake: true };
        } else if (payload.type === 'label' && Object.keys(data).length === 0) {
             data = { text: 'New Text', fontSize: 24, fontFamily: 'Arial', color: '#ffffff', align: 'center' };
        } else if (payload.type === 'animator' && Object.keys(data).length === 0) {
             data = { currentAnim: '', isPlaying: false, speed: 1, elapsedTime: 0, animations: {} };
        } else if (payload.type === 'bitmapText' && Object.keys(data).length === 0) {
             data = { text: 'Bitmap Text', fontSize: 32, fontName: '', tint: 0xffffff, align: 'left' };
        } else if (payload.type === 'nineSliceSprite' && Object.keys(data).length === 0) {
             data = { texture: '', width: 100, height: 100, left: 10, right: 10, top: 10, bottom: 10 };

        }

        world.addComponent(rawEntity, payload.type as any, data);
    }
    
    onComponentUpdate();
};

const existingComponentKeys = computed(() => {
    if (!selectedEntity.value) return [];
    return Object.keys(selectedEntity.value).filter(k => !['id', 'name', 'visible', 'script'].includes(k));
});

// Collapsible State
import { reactive } from 'vue';
const collapsedState = reactive<Record<string, boolean>>({});

const toggleCollapse = (key: string) => {
    collapsedState[key] = !collapsedState[key];
};

</script>

<template>
  <div class="panel h-full flex flex-col">
    <div class="header p-2 bg-bg-header font-bold border-b border-border">Inspector</div>
    
    <div v-if="selectedEntity" class="content flex-1 overflow-y-auto p-2">
        <div class="mb-4 flex items-center space-x-2">
            <!-- Visibility Toggle -->
            <input 
                type="checkbox" 
                v-model="selectedEntity.visible" 
                class="h-4 w-4 rounded border-border bg-bg-input text-accent-color focus:ring-offset-bg-base cursor-pointer"
                title="Toggle Visibility"
                @change="onComponentUpdate"
            />
            
            <!-- Name Input -->
            <input 
                v-model="selectedEntity.name" 
                class="u-input flex-1 font-bold" 
                placeholder="Entity Name"
                @input="onComponentUpdate"
            />
            
            <!-- ID Tooltip -->
            <div class="relative group cursor-help">
                <div class="w-5 h-5 rounded-full border border-text-secondary flex items-center justify-center text-xs text-text-secondary hover:text-text-primary hover:border-text-primary transition-colors">
                    ?
                </div>
                <div class="absolute right-0 top-6 hidden group-hover:block z-50 p-2 bg-black bg-opacity-90 text-white text-xs rounded shadow-lg border border-gray-700 whitespace-nowrap font-mono">
                    ID: {{ selectedEntity.id }}
                </div>
            </div>
        </div>

        <!-- Component List -->
        <div v-for="item in inspectorItems" :key="item.key" class="mb-4">
            
            <!-- A. Scripts handled by ScriptInspector -->
            <ScriptInspector 
                v-if="item.type === 'script'"
                :script="item.data"
                :index="item.index!"
                :entity="selectedEntity"
                @update="onComponentUpdate"
                @remove="removeScript"
            />

            <!-- B. Standard Components -->
            <div v-else class="p-2 border border-border rounded bg-bg-panel group">
                <div class="flex justify-between items-center mb-2 cursor-pointer select-none" @click="toggleCollapse(item.key)">
                    <div class="flex items-center">
                        <span class="mr-2 text-xs text-text-secondary">{{ collapsedState[item.key] ? '▶' : '▼' }}</span>
                        <div class="font-bold text-sm capitalize">{{ item.key }}</div>
                    </div>
                    <button 
                        v-if="item.key !== 'transform' && !(item.key === 'sprite' && (selectedEntity as any).animator)" 
                        @click.stop="removeComponent(item.key)"
                        class="text-xs text-text-secondary hover:text-red-500 opacity-0 group-hover:opacity-100 transition-opacity"
                        title="Remove Component"
                    >
                        ✕
                    </button>
                </div>

                <div class="p-2" v-show="!collapsedState[item.key]">
                    <TransformEditor 
                        v-if="item.key === 'transform'"
                        :transform="item.data" 
                        :revision="revision" 
                        @update="onComponentUpdate" 
                    />
                    
                    <SpriteEditor 
                        v-else-if="item.key === 'sprite'" 
                        :sprite="item.data"
                        :entity="selectedEntity"
                        @update="onComponentUpdate" 
                    />        
                    <CameraEditor 
                        v-else-if="item.key === 'camera'" 
                        :camera="item.data" 
                        @update="onComponentUpdate" 
                    />

                    <RigidBodyEditor 
                        v-else-if="item.key === 'rigidBody'" 
                        :body="item.data" 
                        @update="onComponentUpdate" 
                    />

                    <BoxColliderEditor 
                        v-else-if="item.key === 'boxCollider'" 
                        :collider="item.data" 
                        @update="onComponentUpdate" 
                    />

                    <AudioSourceEditor 
                        v-else-if="item.key === 'audioSource'" 
                        :audio="item.data" 
                        @update="onComponentUpdate" 
                    />

                    <LabelEditor 
                        v-else-if="item.key === 'label'" 
                        :label="item.data" 
                        @update="onComponentUpdate" 
                    />

                    <AnimatorEditor 
                        v-else-if="item.key === 'animator'" 
                        :entity="(selectedEntity as any)" 
                        @update="onComponentUpdate" 
                    />

                    <BitmapTextEditor 
                        v-else-if="item.key === 'bitmapText'" 
                        :entity="(selectedEntity as any)" 
                        @update="onComponentUpdate" 
                    />

                    <NineSliceEditor 
                        v-else-if="item.key === 'nineSliceSprite'" 
                        :nineSlice="item.data" 
                        @update="onComponentUpdate" 
                    />

                    <!-- Fallback -->
                    <div v-else class="text-xs text-text-secondary">
                        Generic Component ({{ item.key }})
                    </div>
                </div>
            </div>
        </div>
        
        <!-- Add Component Button -->
        <div class="mt-4 border-t border-border pt-4 flex justify-center">
             <button @click="isAddModalOpen = true" class="u-button w-full py-2">
                + Add Component
            </button>
        </div>

    </div>
    
    <div v-else class="content flex-1 flex items-center justify-center text-text-secondary italic">
        No entity selected
    </div>

    <!-- Modal -->
    <Teleport to="body">
        <AddComponentModal 
            :isOpen="isAddModalOpen" 
            :existingComponents="existingComponentKeys"
            @close="isAddModalOpen = false"
            @add="handleAddComponent"
        />
    </Teleport>

  </div>
</template>

<style scoped>
.panel {
  background-color: var(--bg-panel);
  color: var(--text-primary);
}
</style>
