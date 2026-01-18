<script setup lang="ts">
import { ref, computed, onUnmounted } from 'vue';
import { type Entity } from '../../../engine/ecs/ECS';
import { projectState } from '../../managers/ProjectManager';
import { getFileSystem } from '../../../api/FileSystem';
import { useUIStore } from '../../../stores/useUIStore';
import AssetPickerModal from './AssetPickerModal.vue';

const props = defineProps<{
    isOpen: boolean;
    entity: Entity;
}>();

const emit = defineEmits(['close', 'update']);
const ui = useUIStore();

const version = ref(0);
// const fileInput = ref<HTMLInputElement | null>(null); // Removed
const showAssetPicker = ref(false);
const targetAnimForPicker = ref<string>('');

const animations = computed(() => {
    version.value;
    if (!props.entity.animator) return {};
    // Return a shallow clone to ensure reactivity triggers even if ref stays same
    return { ...(props.entity.animator.animations || {}) };
});

const animKeys = computed(() => Object.keys(animations.value));

const close = () => {
    stopPreviewLoop();
    emit('close');
};

const addAnimation = () => {
    if (!props.entity.animator) return;

    let name = 'Animation 1';
    let count = 1;
    const currentAnims = props.entity.animator.animations || {};
    
    while (currentAnims[name]) {
        count++;
        name = `Animation ${count}`;
    }
    
    // Ensure nested object initialization
    if (!props.entity.animator.animations) props.entity.animator.animations = {};
    
    props.entity.animator.animations[name] = {
        frames: [],
        loop: true,
        speed: 12
    };
    version.value++;
    emit('update');
};

const removeAnimation = async (name: string) => {
    if (!props.entity.animator || !props.entity.animator.animations) return;
    
    if (await ui.confirm({ title: 'Delete Animation', message: `Delete '${name}'?`, confirmText: 'Delete', isDanger: true })) {
        if (showPreview.value && previewAnimName.value === name) {
            closePreview();
        }
        delete props.entity.animator.animations[name];
        version.value++;
        emit('update');
        ui.showToast({ title: 'Deleted', description: `Animation '${name}' deleted.`, type: 'success' });
    }
};

const updateName = (oldName: string, newName: string) => {
    if (oldName === newName) return;
    if (!newName.trim()) return;
    if (!props.entity.animator || !props.entity.animator.animations) return;

    if (props.entity.animator.animations[newName]) {
        ui.showToast({ title: 'Error', description: 'Name already exists', type: 'error' });
        return;
    }
    
    const data = props.entity.animator.animations[oldName];
    if (data) {
        props.entity.animator.animations[newName] = data;
        delete props.entity.animator.animations[oldName];
        
        // Update preview state if renaming current
        if (showPreview.value && previewAnimName.value === oldName) {
            previewAnimName.value = newName;
        }
        
        version.value++;
        emit('update');
    }
};

const removeFrame = (animName: string, index: number) => {
    if (!props.entity.animator?.animations?.[animName]) return;
    props.entity.animator.animations[animName].frames.splice(index, 1);
    version.value++;
    emit('update');
};

const openFilePicker = (animName: string) => {
    targetAnimForPicker.value = animName;
    showAssetPicker.value = true;
};

const onAssetSelected = (path: string | string[]) => {
    const animName = targetAnimForPicker.value;
    if (!animName || !props.entity.animator?.animations?.[animName]) return;
    
    if (Array.isArray(path)) {
        props.entity.animator.animations[animName].frames.push(...path);
    } else {
        props.entity.animator.animations[animName].frames.push(path);
    }
    version.value++;
    emit('update');
};

// Helper for Auto-Import
const importExternalFile = async (rawPath: string, _animName: string): Promise<string> => {
    // Normalization
    let finalPath = rawPath.replace(/\\/g, '/');
    if (finalPath.startsWith('file:///')) finalPath = decodeURI(finalPath.slice(8));
    
    // Auto-Import Logic for Electron
    const fs = getFileSystem();
    const projectPath = typeof projectState.currentProjectPath === 'string' ? projectState.currentProjectPath.replace(/\\/g, '/') : '';

    console.log(`[Animator] Checking file: ${finalPath}`);
    console.log(`[Animator] isElectron: ${fs.isElectron}, ProjectPath: '${projectPath}'`);
    
    if (projectPath) {
            // Check if file is outside project assets
            // We normalize everything to forward slashes for comparison
            // For Web, if it's a blob URL, it is definitely 'outside'
            const isBlob = finalPath.startsWith('blob:') || finalPath.startsWith('data:');
            const isOutside = !finalPath.startsWith(projectPath) || isBlob;

            if (isOutside) {
                console.log(`[Animator] Creating import for external file (Blob/Outside): ${finalPath}`);
                
                // Destination: assets/imported
                // Strategy: Use UUID to ensure uniqueness and flat structure.
                const uuid = crypto.randomUUID ? crypto.randomUUID().slice(0, 8) : Math.random().toString(36).slice(2, 10);
                
                let originalName = 'image.png';
                if (!isBlob) {
                     originalName = finalPath.split('/').pop() || `imported_${Date.now()}.png`;
                     originalName = originalName.split('?')[0] ?? originalName;
                }
                
                // Ensure extension
                if (!originalName.includes('.')) originalName += '.png';

                const customFilename = `${uuid}_${originalName}`;
                // Ensure destDir doesn't double slash
                const cleanProjectPath = projectPath.endsWith('/') ? projectPath.slice(0, -1) : projectPath;
                const destDir = `${cleanProjectPath}/assets/imported`;
                
                console.log(`[Animator] Importing to destDir: ${destDir} with name: ${customFilename}`);

                try {
                    // Pass customFilename as 3rd optional argument
                    // @ts-ignore - we know our FS supports it now
                    const result = await fs.importFile(finalPath, destDir, customFilename);
                    
                    if (result.success && result.path) {
                        console.log(`[Animator] Import Success. Result Path: ${result.path}`);
                        
                        // Convert absolute result to relative path from project root
                        const absPath = result.path.replace(/\\/g, '/');
                        
                        // For Web, internal paths are like /MyWebProject/assets/...
                        // For Electron, C:/...
                        
                        // We want just 'assets/imported/xxx'
                        if (absPath.startsWith(cleanProjectPath)) {
                             // cleanProjectPath = /MyWebProject
                             // absPath = /MyWebProject/assets/imported/...
                             finalPath = absPath.slice(new RegExp(`^${cleanProjectPath}/?`).exec(absPath)?.[0].length || 0);
                        } else {
                             finalPath = absPath;
                             // Try to strip leading slash if valid relative
                             if (finalPath.startsWith('/')) finalPath = finalPath.slice(1);
                        }
                        
                         console.log(`[Animator] Final Relative Path: ${finalPath}`);

                    } else {
                        console.error(`[Animator] Failed to import ${finalPath}:`, result.error);
                        ui.showToast({ title: 'Import Failed', description: `Failed to import file: ${result.error}`, type: 'error' });
                        // Return empty or original? If failed, do not save blob as it won't persist
                        return ''; 
                    }
                } catch (err) {
                    console.error(`[Animator] Error importing file:`, err);
                    ui.showToast({ title: 'Error', description: `Error importing file: ${err}`, type: 'error' });
                    return '';
                }
            } else {
                 // It IS in the project path already
                 console.log(`[Animator] File is already in project: ${finalPath}`);
                 if (finalPath.startsWith(projectPath)) {
                    finalPath = finalPath.slice(projectPath.length + 1);
                 }
            }
    } else {
        console.warn('[Animator] No project path found!');
    }
    return finalPath;
};

// Drag & Drop Handler
const onDropFrame = async (e: DragEvent, animName: string) => {
    if (!props.entity.animator?.animations?.[animName]) return;
    
    const newFrames: string[] = [];
    const fs = getFileSystem();
    
    console.log(`[Animator] Drop event on ${animName}`);

    // 1. Check for Files (External Drop)
    if (e.dataTransfer?.files && e.dataTransfer.files.length > 0) {
         for (let i = 0; i < e.dataTransfer.files.length; i++) {
             const file = e.dataTransfer.files[i];
             if (!file) continue;
             
             let rawPath = '';
             if (fs.isElectron) {
                 rawPath = fs.getPathForFile(file);
             }
             if (!rawPath) {
                 // @ts-ignore
                 rawPath = file.path ? file.path : URL.createObjectURL(file);
             }

             if (rawPath && rawPath.match(/\.(png|jpg|jpeg|gif|webp)$/i)) {
                 const finalPath = await importExternalFile(rawPath, animName);
                 if (finalPath) newFrames.push(finalPath);
             }
         }
    } 
    // 2. Check for Text/Plain (Internal Asset Drop)
    else {
        const path = e.dataTransfer?.getData('text/plain');
        if (path && path.match(/\.(png|jpg|jpeg|gif|webp)$/i)) {
             newFrames.push(path); // Internal assets are usually relative paths
        }
    }

    if (newFrames.length > 0) {
         props.entity.animator.animations[animName].frames = [
             ...props.entity.animator.animations[animName].frames, 
             ...newFrames
         ];
         version.value++;
         emit('update');
         console.log('[Animator] Drop update emitted');
    }
};


// Preview Logic (Large Modal)
const showPreview = ref(false);
const previewAnimName = ref('');
const previewIndex = ref(0);
const previewTimer = ref<number | null>(null);
const zoomLevel = ref(1);

// Async URL Cache
const frameUrlCache = ref<Map<string, string>>(new Map());
const pendingResolves = new Set<string>();

const resolveFrame = (path: string) => {
    if (!path) return '';
    if (path.startsWith('blob:') || path.startsWith('data:')) return path;

    // Check cache
    if (frameUrlCache.value.has(path)) {
        return frameUrlCache.value.get(path)!;
    }

    // Return placeholder and trigger resolved
    if (!pendingResolves.has(path)) {
        pendingResolves.add(path);
        const fs = getFileSystem();
        
        // Use the centralized, robust getAssetURL from FileSystem
        fs.getAssetURL(path).then(url => {
            frameUrlCache.value.set(path, url);
            pendingResolves.delete(path);
        }).catch(err => {
            console.error(`[Animator] Failed to resolve URL for ${path}`, err);
            pendingResolves.delete(path);
        });
    }

    // Return a temporary placeholder or the raw path (which might fail initially but will update)
    // For Electron, we can try a best-guess sync construct as backup, but for Web it will fail.
    // Let's just return empty string or a spinner? 
    // Or return path for now to reduce flicker if it accidentally works.
    return ''; 
};

const handleWheel = (e: WheelEvent) => {
    if (!showPreview.value) return;
    const delta = e.deltaY > 0 ? -0.1 : 0.1;
    zoomLevel.value = Math.max(0.1, Math.min(5, zoomLevel.value + delta));
};

const openPreview = (name: string) => {
    const anim = props.entity.animator?.animations?.[name];
    if (!anim || !anim.frames.length) {
        ui.showToast({ title: 'Preview Error', description: "Add frames to preview!", type: 'warning' });
        return;
    }
    previewAnimName.value = name;
    previewIndex.value = 0;
    zoomLevel.value = 1; // Reset zoom
    showPreview.value = true;
    startPreviewLoop();
};

const closePreview = () => {
    stopPreviewLoop();
    showPreview.value = false;
    previewAnimName.value = '';
};

const startPreviewLoop = () => {
    stopPreviewLoop();
    const anim = props.entity.animator?.animations?.[previewAnimName.value];
    if (!anim) return;

    const fps = anim.speed || 12;
    if (fps <= 0) return;

    previewTimer.value = window.setInterval(() => {
        if (!anim.frames || anim.frames.length === 0) {
            previewIndex.value = 0;
            return;
        }
        
        let next = previewIndex.value + 1;
        if (next >= anim.frames.length) {
            if (anim.loop) {
                next = 0;
            } else {
                next = anim.frames.length - 1;
            }
        }
        previewIndex.value = next;
    }, 1000 / fps);
};

const stopPreviewLoop = () => {
    if (previewTimer.value !== null) {
        clearInterval(previewTimer.value);
        previewTimer.value = null;
    }
};

onUnmounted(() => {
    stopPreviewLoop();
});

</script>

<template>
    <div v-if="isOpen" class="fixed inset-0 z-[100] flex items-center justify-center bg-black/80 backdrop-blur-sm" @click.self="close">
        <div class="bg-bg-panel border border-border rounded-lg shadow-2xl w-[90vw] h-[85vh] flex flex-col overflow-hidden animate-fade-in relative">
            
            <!-- PREVIEW MODAL OVERLAY -->
            <div v-if="showPreview" class="absolute inset-0 z-50 bg-black/90 flex flex-col items-center justify-center animate-fade-in" @click.self="closePreview">
                <div class="relative bg-bg-panel border border-border rounded-lg p-6 shadow-2xl flex flex-col items-center max-w-4xl w-full max-h-[90%]">
                    
                    <button @click="closePreview" class="absolute top-4 right-4 text-text-secondary hover:text-text-primary text-2xl">✕</button>
                    
                    <h3 class="text-xl font-bold mb-4 text-text-primary">{{ previewAnimName }} <span class="text-sm font-normal text-text-secondary">Preview</span></h3>
                    
                    <!-- Viewport -->
                    <div 
                        class="bg-checkerboard border border-border rounded w-full h-[400px] flex items-center justify-center overflow-hidden mb-6 relative"
                        @wheel.prevent="handleWheel"
                    >
                        <template v-if="props.entity.animator?.animations?.[previewAnimName]?.frames?.length">
                            <img 
                                :src="resolveFrame(props.entity.animator?.animations?.[previewAnimName]?.frames?.[previewIndex] || '')" 
                                class="object-contain pixelated relative z-10 transition-transform duration-75"
                                :style="{ transform: `scale(${zoomLevel})` }"
                            />
                            
                            <!-- Zoom Overlay Info -->
                            <div class="absolute top-2 right-2 px-2 py-1 bg-black/50 text-white text-xs rounded z-20 font-mono">
                                {{ Math.round(zoomLevel * 100) }}%
                            </div>

                            <div class="absolute bottom-2 right-2 px-2 py-1 bg-black/50 text-white text-xs rounded z-20 font-mono">
                                Frame: {{ previewIndex + 1 }} / {{ props.entity.animator?.animations?.[previewAnimName]?.frames?.length }}
                            </div>

                            <!-- Zoom Controls (Bottom Left) -->
                            <div class="absolute bottom-2 left-2 flex gap-1 z-20">
                                <button @click="zoomLevel = Math.max(0.1, zoomLevel - 0.5)" class="bg-black/50 text-white w-6 h-6 rounded hover:bg-black/70">-</button>
                                <button @click="zoomLevel = 1" class="bg-black/50 text-white px-2 h-6 rounded hover:bg-black/70 text-xs">Reset</button>
                                <button @click="zoomLevel = Math.min(5, zoomLevel + 0.5)" class="bg-black/50 text-white w-6 h-6 rounded hover:bg-black/70">+</button>
                            </div>

                        </template>
                        <div v-else class="text-text-secondary">No Frames</div>
                    </div>

                    <!-- Controls -->
                    <div class="flex items-center gap-6" v-if="props.entity.animator?.animations?.[previewAnimName]">
                        <div class="flex flex-col items-center">
                            <span class="text-[10px] uppercase text-text-secondary">FPS</span>
                            <input 
                                type="number" 
                                v-model.number="props.entity.animator!.animations![previewAnimName]!.speed" 
                                @change="startPreviewLoop"
                                class="w-16 bg-bg-input border border-border rounded px-2 py-1 text-center font-bold"
                            />
                        </div>

                        <button 
                            @click="previewTimer ? stopPreviewLoop() : startPreviewLoop()"
                            class="w-12 h-12 rounded-full bg-accent-color hover:bg-opacity-90 flex items-center justify-center text-text-accent text-xl shadow-lg transition-transform hover:scale-105 active:scale-95"
                        >
                            {{ previewTimer ? '⏸' : '▶' }}
                        </button>

                         <div class="flex flex-col items-center cursor-pointer">
                            <span class="text-[10px] uppercase text-text-secondary">Loop</span>
                            <input 
                                type="checkbox" 
                                v-model="props.entity.animator!.animations![previewAnimName]!.loop" 
                                class="w-5 h-5 accent-accent-color cursor-pointer" 
                            />
                        </div>
                    </div>

                </div>
            </div>
            


            <!-- Header -->
            <div class="h-12 bg-bg-header border-b border-border flex justify-between items-center px-4 shrink-0">
                <div class="flex items-center space-x-2">
                    <span class="text-2xl">🎬</span>
                    <span class="font-bold text-lg text-text-primary">Animator Manager</span>
                    <span class="text-sm text-text-secondary px-2 border-l border-border ml-2">{{ entity.name }}</span>
                </div>
                <button @click="close" class="text-text-secondary hover:text-text-primary text-xl">✕</button>
            </div>

            <!-- Content -->
            <div class="flex-1 overflow-y-auto p-4 space-y-4 bg-bg-base/50">
                
                <div v-if="animKeys.length === 0" class="flex flex-col items-center justify-center h-full text-text-secondary opacity-50">
                    <div class="text-4xl mb-2">🎞️</div>
                    <p>No animations created yet.</p>
                    <button @click="addAnimation" class="mt-4 px-4 py-2 bg-accent-color text-text-accent rounded hover:bg-opacity-90">Create First Animation</button>
                </div>

                <!-- Use object iteration to get value directly and avoid undefined checks -->
                <div v-else v-for="(anim, name) in (animations as Record<string, any>)" :key="name" class="bg-bg-panel border border-border rounded-md shadow-sm overflow-hidden flex flex-col">
                    
                    <!-- Row Header -->
                    <div class="flex items-center gap-4 p-2 bg-bg-header/50 border-b border-border">
                        <!-- Preview Toggle -->
                        <button 
                            @click="openPreview(name as string)" 
                            class="w-8 h-8 flex items-center justify-center rounded bg-bg-input hover:bg-bg-hover text-accent-color transition-colors"
                            title="Open Large Preview"
                        >
                            <span class="text-lg">👁️</span>
                        </button>

                        <!-- Name -->
                        <div class="flex-1 flex flex-col">
                            <label class="text-[10px] text-text-secondary uppercase font-bold">Name</label>
                            <input 
                                :value="name" 
                                @change="e => updateName(name as string, (e.target as HTMLInputElement).value)"
                                class="bg-transparent border-b border-transparent hover:border-border focus:border-accent-color outline-none font-bold text-text-primary w-full"
                            />
                        </div>

                        <!-- Settings -->
                        <div class="flex items-center gap-4">
                            <div class="flex flex-col w-16">
                                <label class="text-[10px] text-text-secondary uppercase">Speed (FPS)</label>
                                <input type="number" v-model.number="anim.speed" class="bg-bg-input border border-border rounded px-1 text-xs" />
                            </div>
                            
                            <div class="flex flex-col items-center">
                                <label class="text-[10px] text-text-secondary uppercase mb-1">Loop</label>
                                <input type="checkbox" v-model="anim.loop" class="accent-accent-color" />
                            </div>

                             <button @click="removeAnimation(name as string)" class="text-text-secondary hover:text-red-500 p-2" title="Delete Animation">
                                🗑️
                            </button>
                        </div>
                    </div>

                    <!-- Frames Strip -->
                    <div class="p-2 bg-bg-base/30">
                        <div 
                            class="flex items-center gap-2 overflow-x-auto pb-2 min-h-[80px] custom-scrollbar"
                            @dragover.prevent
                            @drop.prevent="onDropFrame($event, name as string)"
                        >
                            <!-- Empty/Add State -->
                            <div 
                                v-if="!anim.frames || anim.frames.length === 0" 
                                class="flex-none w-32 h-20 border-2 border-dashed border-border rounded flex flex-col items-center justify-center text-xs text-text-secondary text-center px-1 cursor-pointer hover:border-accent-color hover:text-accent-color transition-colors"
                                @click="openFilePicker(name as string)"
                            >
                                <span>📂 Add Frames</span>
                                <span class="text-[9px] opacity-70">(or Drag & Drop)</span>
                            </div>

                            <!-- Frame List -->
                            <div 
                                v-for="(frame, idx) in (anim.frames as string[])" 
                                :key="idx" 
                                class="flex-none group relative w-20 h-20 bg-bg-panel border border-border rounded flex items-center justify-center overflow-hidden"
                                :class="{'ring-2 ring-accent-color': showPreview && previewAnimName === name && (previewIndex === idx)}"
                            >
                                <span class="absolute top-1 left-1 text-[10px] bg-black/50 px-1 rounded text-white z-10">{{ idx }}</span>
                                <button @click="removeFrame(name as string, idx)" class="z-10 absolute top-0 right-0 p-1 text-red-400 opacity-0 group-hover:opacity-100 bg-black/50 rounded-bl transition-opacity">×</button>
                                
                                <!-- Thumb -->
                                <div class="w-full h-full flex items-center justify-center p-1 bg-checkerboard">
                                     <!-- Ensure we display something -->
                                     <img v-if="frame.startsWith('blob:') || frame.startsWith('data:') || frame.includes('/') || frame.includes('\\')" :src="resolveFrame(frame)" class="max-w-full max-h-full object-contain pixelated" />
                                     <div v-else class="text-[10px] text-center break-all p-1">{{ frame.split(/[/\\]/).pop() }}</div>
                                </div>
                            </div>

                            <!-- Add Slot at end -->
                             <div 
                                v-if="anim.frames && anim.frames.length > 0"
                                class="flex-none w-20 h-20 border border-transparent flex items-center justify-center text-text-secondary opacity-30 hover:opacity-100 cursor-pointer bg-bg-panel rounded hover:bg-bg-hover"
                                @click="openFilePicker(name as string)"
                                title="Add Frames"
                            >
                                <div class="text-4xl font-light">+</div>
                            </div>
                        </div>
                    </div>
                </div>

                <!-- Add Button Bottom -->
                <div v-if="animKeys.length > 0" class="flex justify-center pt-4 pb-8">
                    <button @click="addAnimation" class="u-button px-6 py-2 shadow-lg">+ Create New Animation</button>
                </div>

            </div>
        </div>

        <!-- Asset Picker Modal -->
        <Teleport to="body">
            <AssetPickerModal 
                :isOpen="showAssetPicker"
                type="image"
                :multiSelect="true"
                :onSelect="onAssetSelected"
                :onClose="() => showAssetPicker = false"
            />
        </Teleport>
    </div>
</template>

<style scoped>
.pixelated {
    image-rendering: pixelated;
}
.bg-checkerboard {
    background-image:
      linear-gradient(45deg, #222 25%, transparent 25%),
      linear-gradient(-45deg, #222 25%, transparent 25%),
      linear-gradient(45deg, transparent 75%, #222 75%),
      linear-gradient(-45deg, transparent 75%, #222 75%);
    background-size: 20px 20px;
    background-position: 0 0, 0 10px, 10px -10px, -10px 0px;
}
.custom-scrollbar::-webkit-scrollbar {
    height: 8px;
}
.custom-scrollbar::-webkit-scrollbar-track {
    background: rgba(0,0,0,0.1);
    border-radius: 4px;
}
.custom-scrollbar::-webkit-scrollbar-thumb {
    background: var(--border-color);
    border-radius: 4px;
}
.custom-scrollbar::-webkit-scrollbar-thumb:hover {
    background: var(--text-secondary);
}
.animate-fade-in {
    animation: fadeIn 0.2s ease-out;
}
@keyframes fadeIn {
    from { opacity: 0; transform: scale(0.95); }
    to { opacity: 1; transform: scale(1); }
}
</style>
