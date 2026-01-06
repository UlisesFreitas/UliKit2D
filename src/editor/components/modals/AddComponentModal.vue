<script setup lang="ts">
import { ref, onMounted, computed, watch } from 'vue';
import { getFileSystem } from '../../../api/FileSystem';

const props = defineProps<{
    isOpen: boolean;
    existingComponents: string[]; // List of component keys already on the entity
}>();

const emit = defineEmits(['close', 'add']);

const activeTab = ref<'core'|'scripts'>('core');
const searchQuery = ref('');
const availableScripts = ref<string[]>([]);
const isLoadingScripts = ref(false);

const CORE_COMPONENTS = [
    { type: 'sprite', name: 'Sprite Renderer', icon: '🖼️', description: 'Renders a 2D image' },
    { type: 'camera', name: 'Camera', icon: '📷', description: 'Renders the scene' },
    { type: 'rigidBody', name: 'RigidBody 2D', icon: '🧱', description: 'Physics body' },
    { type: 'boxCollider', name: 'Box Collider 2D', icon: '📦', description: 'Box shape collision' },
    { type: 'animator', name: 'Sprite Animator', icon: '🎬', description: 'Frame-based animation' },
    { type: 'audioSource', name: 'Audio Source', icon: '🔊', description: 'Plays sound clips' },
    { type: 'label', name: 'Text Label', icon: '📝', description: 'Displays text' }
];

const loadScripts = async () => {
    isLoadingScripts.value = true;
    try {
        const fs = getFileSystem();
        const files = await fs.readdir('assets'); // Assuming flat structure or shallow scan for now
        // TODO: Recursive scan if needed, or filter specifically for .js
        const scripts = files
            .filter(f => f.type === 'file' && f.name.endsWith('.js'))
            .map(f => f.path);
            
        availableScripts.value = scripts;
    } catch (e) {
        console.error('Failed to load scripts:', e);
        availableScripts.value = [];
    } finally {
        isLoadingScripts.value = false;
    }
};

onMounted(() => {
    if (props.isOpen) loadScripts();
});

watch(() => props.isOpen, (newVal) => {
    if (newVal) {
        searchQuery.value = '';
        activeTab.value = 'core';
        loadScripts();
    }
});

const filteredCore = computed(() => {
    return CORE_COMPONENTS.filter(c => 
        c.name.toLowerCase().includes(searchQuery.value.toLowerCase()) &&
        !props.existingComponents.includes(c.type) // Core components are unique usually? Or allow multiple?
        // Actually, let's allow re-adding logic to be handled by parent or disable if unique.
        // Assuming unique for now based on InspectorPanel logic
    );
});

const filteredScripts = computed(() => {
    return availableScripts.value.filter(path => 
        path.toLowerCase().replace(/\\/g, '/').split('/').pop()?.includes(searchQuery.value.toLowerCase())
    );
});

const selectCore = (type: string) => {
    emit('add', { type, data: {} });
    emit('close');
};

const selectScript = (path: string) => {
    emit('add', { type: 'script', data: { path } });
    emit('close');
};

const closeModal = () => {
    emit('close');
};
</script>

<template>
    <div v-if="isOpen" class="fixed inset-0 z-50 flex items-center justify-center bg-black bg-opacity-50" @click.self="closeModal">
        <div class="bg-bg-panel border border-border rounded shadow-xl w-[500px] h-[600px] flex flex-col overflow-hidden">
            <!-- Header -->
            <div class="p-3 border-b border-border flex justify-between items-center bg-bg-header">
                <h3 class="font-bold text-text-primary">Add Component</h3>
                <button @click="closeModal" class="text-text-secondary hover:text-text-primary">✕</button>
            </div>

            <!-- Search -->
            <div class="p-3 bg-bg-base border-b border-border">
                <input 
                    v-model="searchQuery"
                    ref="searchInput"
                    class="u-input w-full p-2" 
                    placeholder="Search components..." 
                    autofocus
                />
            </div>

            <!-- Tabs -->
            <div class="flex border-b border-border bg-bg-panel">
                <button 
                    class="flex-1 py-2 text-sm font-bold border-b-2 transition-colors"
                    :class="activeTab === 'core' ? 'border-accent-color text-accent-color' : 'border-transparent text-text-secondary hover:text-text-primary'"
                    @click="activeTab = 'core'"
                >
                    Core
                </button>
                <button 
                    class="flex-1 py-2 text-sm font-bold border-b-2 transition-colors"
                    :class="activeTab === 'scripts' ? 'border-accent-color text-accent-color' : 'border-transparent text-text-secondary hover:text-text-primary'"
                    @click="activeTab = 'scripts'"
                >
                    Scripts
                </button>
            </div>

            <!-- List -->
            <div class="flex-1 overflow-y-auto p-2 bg-bg-base">
                <!-- Core Components -->
                <div v-if="activeTab === 'core'" class="flex flex-col gap-1">
                    <div 
                        v-for="comp in filteredCore" 
                        :key="comp.type"
                        class="p-2 rounded hover:bg-bg-hover cursor-pointer border border-transparent hover:border-border flex items-center gap-3 group"
                        @click="selectCore(comp.type)"
                    >
                        <div class="text-2xl">{{ comp.icon }}</div>
                        <div class="flex-1">
                            <div class="font-bold text-sm text-text-primary">{{ comp.name }}</div>
                            <div class="text-xs text-text-secondary">{{ comp.description }}</div>
                        </div>
                        <div class="opacity-0 group-hover:opacity-100 text-accent-color text-xs">Add ➜</div>
                    </div>
                    <div v-if="filteredCore.length === 0" class="text-center text-text-secondary py-4 italic">
                        No matching core components.
                    </div>
                </div>

                <!-- Scripts -->
                <div v-if="activeTab === 'scripts'" class="flex flex-col gap-1">
                    <div v-if="isLoadingScripts" class="text-center py-4">Loading...</div>
                    <template v-else>
                         <div 
                            v-for="scriptPath in filteredScripts" 
                            :key="scriptPath"
                            class="p-2 rounded hover:bg-bg-hover cursor-pointer border border-transparent hover:border-border flex items-center gap-3 group"
                            @click="selectScript(scriptPath)"
                        >
                            <div class="text-xl">📜</div>
                            <div class="flex-1">
                                <div class="font-bold text-sm text-text-primary break-all">
                                    {{ scriptPath.replace(/\\/g, '/').split('/').pop() }}
                                </div>
                                <div class="text-xs text-text-secondary truncate" :title="scriptPath">
                                    {{ scriptPath }}
                                </div>
                            </div>
                            <div class="opacity-0 group-hover:opacity-100 text-accent-color text-xs">Add ➜</div>
                        </div>
                        <div v-if="filteredScripts.length === 0" class="text-center text-text-secondary py-4 italic">
                            No matching scripts found in assets/.
                        </div>
                    </template>
                </div>
            </div>
        </div>
    </div>
</template>

<style scoped>
/* Scoped styles */
</style>
