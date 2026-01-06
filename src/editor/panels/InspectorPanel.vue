<script setup lang="ts">
import { computed, ref, onMounted, onUnmounted } from 'vue';
import { useEditorStore } from '../../stores/useEditorStore';
import { world } from '../../engine/ecs/ECS';
import { eventBus } from '../../engine/core/EventBus';
import { projectState } from '../managers/ProjectManager';
import TransformEditor from '../components/inspectors/TransformEditor.vue';
import ScriptEditor from '../components/ScriptEditor.vue';
import CameraEditor from '../components/inspectors/CameraEditor.vue';
import SpriteEditor from '../components/inspectors/SpriteEditor.vue';

const editorStore = useEditorStore();
const revision = ref(0);

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

const entityComponents = computed(() => {
    // track revision to force update when components change internally
    revision.value; 
    if (!selectedEntity.value) return {};
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    const { id, name, visible, ...components } = selectedEntity.value;
    return components;
});

const selectedComponentToAdd = ref('');

const hasComponent = (name: string) => {
    return selectedEntity.value && (selectedEntity.value as any)[name];
};

// ...

const onComponentUpdate = () => {
    revision.value++;
    projectState.isDirty = true;
    console.log('Component updated', revision.value);
    if (selectedEntity.value) {
        eventBus.emit('entity-updated', selectedEntity.value.id);
    }
};

const removeComponent = (key: string) => {
    if (!selectedEntity.value) return;
    world.removeComponent(selectedEntity.value, key as any);
    onComponentUpdate();
};

const addComponent = () => {
    if (!selectedEntity.value || !selectedComponentToAdd.value) return;

    const type = selectedComponentToAdd.value;
    let data: any = {};

    switch (type) {
        case 'sprite': data = { texture: '' }; break; // Default to empty path
        case 'script': data = []; break;
        case 'camera': data = { zoom: 1, isPrimary: true }; break;
    }

    world.addComponent(selectedEntity.value, type as any, data);
    onComponentUpdate();
    selectedComponentToAdd.value = ''; // Reset
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
                <!-- Tooltip -->
                <div class="absolute right-0 top-6 hidden group-hover:block z-50 p-2 bg-black bg-opacity-90 text-white text-xs rounded shadow-lg border border-gray-700 whitespace-nowrap font-mono">
                    ID: {{ selectedEntity.id }}
                </div>
            </div>
        </div>

        <!-- Iterate over components of the selected entity -->
        <div v-for="(component, key) in entityComponents" :key="key" class="mb-4 p-2 border border-border rounded bg-bg-panel group">
            <div class="flex justify-between items-center mb-2">
                <div class="font-bold text-sm capitalize">{{ key }}</div>
                <button 
                    v-if="key !== 'transform'" 
                    @click="removeComponent(key)"
                    class="text-xs text-text-secondary hover:text-red-500 opacity-0 group-hover:opacity-100 transition-opacity"
                    title="Remove Component"
                >
                    ✕
                </button>
            </div>

            <div class="p-2">
                    <!-- Custom Editors -->
                    <template v-if="key === 'transform'">
                        <TransformEditor 
                            :transform="component" 
                            :revision="revision" 
                            @update="onComponentUpdate" 
                        />
                    </template>
                    
                    <!-- Script Editor -->
                    <template v-else-if="key === 'script'">
                         <ScriptEditor :entity="selectedEntity" />
                    </template>

                    <!-- Sprite Editor (New Component) -->
                    <template v-else-if="key === 'sprite'">
                        <SpriteEditor :sprite="component" @update="onComponentUpdate" />
                    </template>

                    <!-- Camera Editor -->
                    <template v-else-if="key === 'camera'">
                        <CameraEditor :camera="component" @update="onComponentUpdate" />
                    </template>

                    <!-- Generic Fallback -->
                    <template v-else>
                        <!-- Object Component -->
                        <div v-if="typeof component === 'object' && component !== null">
                            <div class="grid grid-cols-2 gap-4">
                                <div v-for="(val, prop) in component" :key="prop" class="flex flex-col">
                                    <label class="u-label truncate" :title="String(prop)">{{ prop }}</label>
                                    <input 
                                        v-if="typeof val === 'number'"
                                        type="number" 
                                        v-model.number="component[prop]"
                                        class="u-input"
                                        @input="onComponentUpdate"
                                    >
                                    <input 
                                        v-else-if="typeof val === 'string'"
                                        type="text" 
                                        v-model="component[prop]"
                                        class="u-input"
                                        @input="onComponentUpdate"
                                    >
                                    <input 
                                        v-else-if="typeof val === 'boolean'"
                                        type="checkbox" 
                                        v-model="component[prop]"
                                        @change="onComponentUpdate"
                                        class="mt-1 h-4 w-4 rounded border-border bg-bg-input text-accent-color focus:ring-offset-bg-base"
                                    >
                                </div>
                            </div>
                        </div>
                        <!-- Primitive Component (Tag or simple value) -->
                        <div v-else class="flex flex-col mb-2">
                             <input 
                                v-if="typeof component === 'number'"
                                type="number"
                                v-model.number="selectedEntity[key]"
                                class="u-input"
                                @input="onComponentUpdate"
                            />
                             <input 
                                v-else-if="typeof component === 'boolean'"
                                type="checkbox"
                                v-model="selectedEntity[key]"
                                @change="onComponentUpdate"
                                class="mt-1 h-4 w-4 rounded border-border bg-bg-input text-accent-color focus:ring-offset-bg-base"
                            />
                             <input 
                                v-else-if="typeof component === 'string'"
                                type="text"
                                v-model="selectedEntity[key]"
                                class="u-input"
                                @input="onComponentUpdate"
                            />
                        </div>
                    </template>
                </div>
        </div>
        
        <!-- Add Component Section -->
        <div class="mt-4 border-t border-border pt-4">
             <div class="flex gap-2">
                <select v-model="selectedComponentToAdd" class="u-input flex-1">
                    <option value="" disabled>Select Component...</option>
                    <option value="sprite" :disabled="!!hasComponent('sprite')">Sprite</option>
                    <option value="script" :disabled="!!hasComponent('script')">Script</option>
                    <option value="camera" :disabled="!!hasComponent('camera')">Camera</option>
                </select>
                <button @click="addComponent" class="u-button" :disabled="!selectedComponentToAdd">
                    Add
                </button>
             </div>
        </div>

    </div>
    
    <div v-else class="content flex-1 flex items-center justify-center text-text-secondary italic">
        No entity selected
    </div>
  </div>
</template>

<style scoped>
.panel {
  background-color: var(--bg-panel);
  color: var(--text-primary);
}
</style>
