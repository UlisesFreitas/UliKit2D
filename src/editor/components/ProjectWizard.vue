<script setup lang="ts">
import { ref } from 'vue';
import { ProjectManager } from '../managers/ProjectManager';
import { getFileSystem } from '../../api/FileSystem';

import { useUIStore } from '../../stores/useUIStore';

const step = ref<'HOME' | 'CREATE'>('HOME');
const projectName = ref('');
const projectLocation = ref('');
const isElectron = (window as any).electronAPI !== undefined;
const ui = useUIStore();

const PROJECT_NAMES = [
    "Quantum Pulse", "Neon Forge", "Project Zenith", "Nexus Alpha", 
    "Cyber Glyph", "Aether Core", "Titan Script", "Silver Edge", 
    "Prism Flow", "Orion Peak", "Logic Gate", "Hyper Drive", 
    "Void Sphere", "Pixel Storm", "Astro Code", "Vortex Mind", 
    "Solar Flare", "Infinite Loop", "Iron Link", "Giga Bit", 
    "Nova Spark", "Data Drift", "Omega Point", "Delta Shift", 
    "Flux Capacitor", "Cobalt Blue", "Gravity Well", "Echo Shell", 
    "Phantom Phase", "Shadow Mesh", "Sonic Boom", "Terra Form", 
    "Plasma Grid", "Krypton Key", "Atomic Node", "Binary Star", 
    "Cortex Hub", "Digital Zen", "Entity X", "Fusion Cell", 
    "Glitch Mode", "Helix Rise", "Icarus Wing", "Jade Matrix"
];

const getRandomName = () => PROJECT_NAMES[Math.floor(Math.random() * PROJECT_NAMES.length)] || 'New Project';

const goToCreate = () => {
    projectName.value = getRandomName();
    step.value = 'CREATE';
};

const selectLocation = async () => {
    const fs = getFileSystem();
    const result = await fs.selectFolder();
    // Handle both string paths (Electron/Web legacy) and Handles (Web)
    if (typeof result === 'string') {
        projectLocation.value = result;
    } else if (result && 'name' in result) {
         projectLocation.value = result.name; 
    }
};

const onCreate = async () => {
    if (!projectName.value) {
        ui.showToast({ title: 'Validation Error', description: 'Please enter a project name', type: 'error' });
        return;
    }

    if (isElectron && !projectLocation.value) {
        ui.showToast({ title: 'Validation Error', description: 'Please select a location', type: 'error' });
        return;
    }

    // Prevent double nesting: if location ends with name, use location as fullPath
    let fullPath = '';
    if (isElectron) {
        const loc = projectLocation.value.replace(/\\/g, '/');
        const name = projectName.value;
        if (loc.endsWith(`/${name}`)) {
             fullPath = loc;
        } else {
             fullPath = `${loc}/${name}`;
        }
    } else {
        fullPath = projectName.value;
    }

    await ProjectManager.createProject(fullPath);
};

const recentProjects = ref<{name: string, path: string}[]>([]);

const loadProjects = async () => {
    recentProjects.value = ProjectManager.getRecents();
};

import { onMounted } from 'vue';
onMounted(() => {
    loadProjects();
});

const openRecent = (path: string) => {
    ProjectManager.openProject(path);
};
</script>

<template>
    <div class="fixed inset-0 z-50 bg-bg-base text-text-primary flex flex-col font-sans select-none">
        
        <!-- Header -->
        <div class="h-16 border-b border-border flex items-center px-8 bg-bg-header">
            <div class="text-2xl font-bold text-accent mr-2">UliKit2D</div>
            <div class="text-sm text-text-secondary mt-1">Project Hub</div>
        </div>

        <!-- Content -->
        <div class="flex-1 flex overflow-hidden">
            
            <!-- Left Sidebar (Recent Projects) -->
            <div class="w-64 bg-bg-panel border-r border-border p-4 flex flex-col">
                <div class="flex justify-between items-center mb-4">
                    <div class="text-sm font-bold text-text-secondary uppercase tracking-wider">Projects</div>
                    <button @click="loadProjects" class="text-xs text-accent hover:text-accent-hover" title="Refresh">↻</button>
                </div>
                
                <div class="flex-1 overflow-y-auto space-y-1">
                    <button 
                        v-for="proj in recentProjects" 
                        :key="proj.name"
                        @click="openRecent(proj.path)"
                        class="w-full text-left px-3 py-2 rounded hover:bg-bg-hover text-sm border border-transparent hover:border-border transition flex items-center group"
                    >
                        <span class="mr-2 text-lg">📁</span>
                        <div class="flex-1 min-w-0">
                            <div class="truncate font-medium group-hover:text-accent transition-colors">{{ proj.name }}</div>
                        </div>
                    </button>

                    <div v-if="recentProjects.length === 0" class="text-xs text-gray-500 italic p-2 text-center">
                        No projects found
                    </div>
                </div>
            </div>

            <!-- Main Area -->
            <div class="flex-1 flex items-center justify-center bg-bg-base p-8 relative">
                
                <!-- STEP: HOME -->
                <div v-if="step === 'HOME'" class="flex gap-8 max-w-4xl w-full justify-center animate-fade-in">
                    
                    <!-- New Project Card -->
                    <button @click="goToCreate" 
                        class="group flex flex-col items-center justify-center w-64 h-64 bg-bg-panel border border-border rounded-xl hover:border-accent hover:bg-bg-hover transition-all duration-200 shadow-lg hover:shadow-accent/20">
                        <div class="w-16 h-16 rounded-full bg-accent/10 flex items-center justify-center mb-4 group-hover:bg-accent/20 transition">
                            <span class="text-3xl text-accent">+</span>
                        </div>
                        <div class="text-xl font-bold">New Project</div>
                        <div class="text-sm text-text-secondary mt-2">Start from scratch</div>
                    </button>

                    <!-- Open Project Card -->
                    <button @click="ProjectManager.openProject()" 
                        class="group flex flex-col items-center justify-center w-64 h-64 bg-bg-panel border border-border rounded-xl hover:border-text-primary hover:bg-bg-hover transition-all duration-200 shadow-lg">
                        <div class="w-16 h-16 rounded-full bg-text-secondary/10 flex items-center justify-center mb-4 group-hover:bg-text-secondary/20 transition">
                            <span class="text-3xl text-text-secondary">📂</span>
                        </div>
                        <div class="text-xl font-bold">Open Project</div>
                        <div class="text-sm text-text-secondary mt-2">Load existing</div>
                    </button>

                </div>

                <!-- STEP: CREATE -->
                <div v-if="step === 'CREATE'" class="w-full max-w-lg bg-bg-panel border border-border rounded-xl p-8 shadow-2xl animate-slide-up">
                    <h2 class="text-2xl font-bold mb-6 flex items-center">
                        <button @click="step = 'HOME'" class="mr-4 text-text-secondary hover:text-text-primary transition">←</button>
                        Create New Project
                    </h2>

                    <div class="space-y-6">
                        <!-- Project Name -->
                        <div>
                            <label class="block text-sm font-medium text-text-secondary mb-2">Project Name</label>
                            <input v-model="projectName" type="text" placeholder="MyAwesomeGame" autofocus
                                class="w-full bg-bg-input border border-border rounded px-3 py-2 text-text-primary focus:border-accent outline-none transition" />
                        </div>

                        <!-- Location (Electron Only) -->
                        <div v-if="isElectron">
                            <label class="block text-sm font-medium text-text-secondary mb-2">Location</label>
                            <div class="flex gap-2">
                                <input v-model="projectLocation" type="text" readonly
                                    class="flex-1 bg-bg-input border border-border rounded px-3 py-2 text-text-primary cursor-not-allowed opacity-75" />
                                <button @click="selectLocation" class="bg-bg-header border border-border rounded px-4 hover:bg-bg-hover transition">
                                    ...
                                </button>
                            </div>
                        </div>

                        <!-- Info Web -->
                        <div v-if="!isElectron" class="bg-blue-500/10 border border-blue-500/20 p-3 rounded text-xs text-blue-200">
                            Web Mode: Projects are saved in browser storage. Clearing browser data will delete them.
                        </div>

                        <!-- Actions -->
                        <div class="flex justify-end pt-4">
                            <button @click="onCreate" 
                                class="bg-accent text-white font-bold py-2 px-6 rounded hover:bg-accent-hover transition flex items-center shadow-lg shadow-accent/20">
                                Create Project
                            </button>
                        </div>
                    </div>
                </div>

            </div>
        </div>

        <!-- Footer -->
        <div class="h-8 bg-bg-header border-t border-border flex items-center justify-center text-xs text-text-secondary px-4">
            UliKit2D Engine v0.0.1
        </div>
    </div>
</template>

<style scoped>
.animate-fade-in {
    animation: fadeIn 0.3s ease-out;
}
.animate-slide-up {
    animation: slideUp 0.3s cubic-bezier(0.16, 1, 0.3, 1);
}

@keyframes fadeIn {
    from { opacity: 0; transform: scale(0.98); }
    to { opacity: 1; transform: scale(1); }
}

@keyframes slideUp {
    from { opacity: 0; transform: translateY(20px); }
    to { opacity: 1; transform: translateY(0); }
}
</style>
