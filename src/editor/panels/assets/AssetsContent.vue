<template>
    <div 
        class="assets-content flex-1 h-full overflow-y-auto bg-bg-base p-2" 
        @click.self="closeContextMenu"
        @dragover.prevent 
        @drop.prevent="onDrop"
    >
        <div 
            class="grid-container"
            :class="gridClass"
        >
            <div 
                v-for="file in assetStore.visibleFiles" 
                :key="file.path" 
                class="file-item select-none"
                :class="{
                    'is-folder text-accent-color': file.type === 'directory',
                    'list-row': assetStore.zoomLevel === 0,
                    'grid-card': assetStore.zoomLevel > 0
                }"
                draggable="true"
                @dragstart="onDragStart($event, file)"
                @dblclick="onDoubleClick(file)"
                @contextmenu="showContextMenu($event, file)"
            >
                <!-- ICON -->
                <div class="icon-container flex items-center justify-center shrink-0">
                    <img v-if="thumbnails[file.path]" :src="thumbnails[file.path]" class="w-full h-full object-contain pointer-events-none" />
                    <span v-else class="text-2xl select-none emoji-icon">
                        {{ file.type === 'directory' ? '📁' : isImage(file.name) ? '🖼️' : getFileIcon(file.name) }}
                    </span>
                </div>
                
                <!-- NAME -->
                <div class="name-container">
                    <span class="file-name truncate">{{ file.name }}</span>
                    <span v-if="assetStore.zoomLevel === 0" class="file-details text-xs text-text-disabled ml-auto">
                        {{ file.type === 'directory' ? 'Folder' : 'File' }}
                    </span>
                </div>
            </div>
        </div>
        
        <!-- Empty State -->
        <div v-if="assetStore.visibleFiles.length === 0" class="w-full text-center text-text-disabled mt-10">
            {{ assetStore.searchQuery ? 'No results found' : 'Empty Folder' }}
        </div>

        <!-- Custom Context Menu -->
        <Teleport to="body">
            <div v-if="menuState.visible" 
                 ref="contextMenuRef"
                 class="fixed bg-bg-panel border border-border shadow-lg rounded z-[9999] py-1 min-w-[140px]"
                 :style="menuStyle">
                 <div class="px-3 py-1 text-[10px] font-bold text-text-secondary truncate max-w-[200px]">{{ menuState.file?.name }}</div>
                 <div class="h-[1px] bg-border my-1"></div>
                <button 
                    v-if="menuState.file?.path !== 'assets'"
                    @click="deleteAsset" 
                    class="w-full text-left px-3 py-1.5 hover:bg-bg-selection hover:text-accent-danger text-xs text-accent-danger transition-colors"
                >
                    Delete
                </button>
                 <!-- More options can go here like Rename, Show in Explorer -->
            </div>
        </Teleport>
    </div>
</template>

<script setup lang="ts">
import { ref, onMounted, onUnmounted, watch, computed, nextTick } from 'vue';
import { useAssetStore, type FileNode } from '../../../stores/useAssetStore';
import { useUIStore } from '../../../stores/useUIStore';
import { getFileSystem } from '../../../api/FileSystem';
import { projectState, ProjectManager } from '../../managers/ProjectManager';

const assetStore = useAssetStore();
const ui = useUIStore();
const thumbnails = ref<Record<string, string>>({});

// Context Menu State
const menuState = ref({
    visible: false,
    x: 0,
    y: 0,
    file: null as any
});

// Grid Classes based on Zoom
const gridClass = computed(() => {
    switch(assetStore.zoomLevel) {
        case 0: return 'view-list flex flex-col gap-1';
        case 1: return 'view-grid-small grid gap-2';
        case 2: return 'view-grid-medium grid gap-2';
        case 3: return 'view-grid-large grid gap-4';
        default: return 'view-grid-medium grid gap-2';
    }
});

const getFileIcon = (name: string) => {
    if (name.endsWith('.json')) return '📄';
    if (name.endsWith('.ts') || name.endsWith('.js')) return '📜';
    if (name.endsWith('.wav') || name.endsWith('.mp3')) return '🎵';
    return '📄';
};

const isImage = (filename: string) => {
    return /\.(png|jpg|jpeg|webp|bmp|gif)$/i.test(filename);
};

const loadThumbnails = async () => {
    const fs = getFileSystem();
    for (const file of assetStore.visibleFiles) {
        if (file.type === 'file' && isImage(file.name)) {
            if (!thumbnails.value[file.path]) {
                const url = await fs.getAssetURL(file.path);
                thumbnails.value[file.path] = url;
            }
        }
    }
};

watch(() => assetStore.visibleFiles, () => {
    loadThumbnails();
}, { deep: true, immediate: true });

// --- INTERACTION HANDLERS ---

const contextMenuRef = ref<HTMLElement | null>(null);
const menuStyle = ref({ top: '0px', left: '0px' });

const closeContextMenu = () => {
    menuState.value.visible = false;
};

const showContextMenu = async (e: MouseEvent, file: any) => {
    e.preventDefault();
    e.stopPropagation(); // Stop bubbling (fixes some event issues)
    
    // 1. Initial State (Visible but maybe wrong pos)
    menuState.value = {
        visible: true,
        x: e.clientX,
        y: e.clientY,
        file: file
    };
    
    // 2. Wait for Render
    await nextTick();
    
    // 3. Measure and Adjust
    if (contextMenuRef.value) {
        const menuRect = contextMenuRef.value.getBoundingClientRect();
        const winWidth = window.innerWidth;
        const winHeight = window.innerHeight;
        
        let x = e.clientX;
        let y = e.clientY;
        
        // Flip X if too close to right
        if (x + menuRect.width > winWidth) {
            x -= menuRect.width;
        }
        
        // Flip Y if too close to bottom
        if (y + menuRect.height > winHeight) {
             y -= menuRect.height;
        }
        
        menuStyle.value = {
            top: `${y}px`,
            left: `${x}px`
        };
    }
};

const deleteAsset = async () => {
    const file = menuState.value.file;
    if (!file) return;
    closeContextMenu();

    if (file.name === 'assets' && file.path === 'assets') {
        ui.showToast({ title: 'Protected', description: 'The assets folder cannot be deleted.', type: 'warning' });
        return;
    }

    if (await ui.confirm({
        title: 'Delete Asset',
        message: `Delete '${file.name}'?`,
        confirmText: 'Delete',
        isDanger: true
    })) {
        await ProjectManager.deleteAsset(file.path);
    }
};

const onDoubleClick = (file: FileNode) => {
    if (file.type === 'directory') {
        assetStore.changeDirectory(file.path);
    } else {
        // Future: Open file in appropriate editor
        console.log('Open File:', file.path);
    }
};

const onDragStart = (e: DragEvent, file: FileNode) => {
    if (e.dataTransfer) {
        e.dataTransfer.setData('text/plain', file.path);
        e.dataTransfer.effectAllowed = 'copy';
    }
};

const onDrop = async (e: DragEvent) => {
    const items = e.dataTransfer?.items;
    if (!items || items.length === 0) return;
    if (!projectState.currentProjectPath) return;

    // Recursive Scan Helper
    const scanFiles = async (item: any, path: string): Promise<{ file: File, path: string }[]> => {
        if (item.isFile) {
            return new Promise((resolve) => {
                item.file((file: File) => {
                    resolve([{ file: file, path: path + file.name }]);
                });
            });
        } else if (item.isDirectory) {
            const reader = item.createReader();
            const entries: any[] = await new Promise((resolve) => {
                 const allEntries: any[] = [];
                 const readEntries = () => {
                     reader.readEntries((result: any[]) => {
                         if (result.length === 0) resolve(allEntries);
                         else {
                             allEntries.push(...result);
                             readEntries();
                         }
                     });
                 };
                 readEntries();
            });
            
            let results: { file: File, path: string }[] = [];
            for (const entry of entries) {
                results = results.concat(await scanFiles(entry, path + item.name + '/'));
            }
            return results;
        }
        return [];
    };

    // Collect all files
    const allFiles: { file: File, path: string }[] = [];
    
    // 1. Synchronously capture entries to prevent DataTransfer list invalidation
    const entries: any[] = [];
    for (let i = 0; i < items.length; i++) {
        const itemData = items[i];
        if (!itemData) continue;
        // @ts-ignore
        const entry = itemData.webkitGetAsEntry ? itemData.webkitGetAsEntry() : null;
        if (entry) {
            entries.push(entry);
        } else {
             // Fallback
             const file = itemData.getAsFile();
             if (file) entries.push(file); // Push File object treating as entry for logic below or handle separate
        }
    }

    // 2. Process Entries Async
    for (const entry of entries) {
        if (entry instanceof File) {
             allFiles.push({ file: entry, path: entry.name });
        } else {
             const results = await scanFiles(entry, '');
             allFiles.push(...results);
        }
    }

    const currentRelPath = assetStore.currentPath || '';
    
    // Use Centralized Import Logic with Structured Data
    await ProjectManager.importAssets(allFiles, currentRelPath);
};

// --- GLOBAL CLICK LISTENER ---
onMounted(() => {
    window.addEventListener('click', closeContextMenu);
});
onUnmounted(() => {
    window.removeEventListener('click', closeContextMenu);
});

</script>

<style scoped>
/* GRID COLUMNS definition based on classes */
.view-grid-small {
    grid-template-columns: repeat(auto-fill, minmax(60px, 1fr));
}
.view-grid-medium {
    grid-template-columns: repeat(auto-fill, minmax(90px, 1fr));
}
.view-grid-large {
    grid-template-columns: repeat(auto-fill, minmax(120px, 1fr));
}

/* FILE ITEM STYLES */
.file-item {
    cursor: pointer;
    border: 1px solid transparent;
    border-radius: 4px;
    color: var(--text-primary);
    position: relative;
    overflow: hidden;
}
.file-item:hover {
    background-color: var(--bg-hover);
    border-color: var(--border-color);
}

/* GRID MODE CARD STYLE */
.grid-card {
    display: flex;
    flex-direction: column;
    align-items: center;
    padding: 8px;
    aspect-ratio: 1/1; /* Square cards */
}
.grid-card .icon-container {
    flex: 1;
    width: 100%;
    overflow: hidden;
    margin-bottom: 4px;
}
.grid-card .emoji-icon {
    font-size: 2rem;
}
/* Adjust icon size based on grid size? */
.view-grid-small .emoji-icon { font-size: 1.5rem; }
.view-grid-large .emoji-icon { font-size: 3rem; }

.grid-card .name-container {
    width: 100%;
    text-align: center;
}
.grid-card .file-name {
    font-size: 0.75rem;
    line-height: 1.1;
    display: -webkit-box;
    -webkit-line-clamp: 2;
    line-clamp: 2;
    -webkit-box-orient: vertical;
    overflow: hidden;
    word-break: break-all;
}

/* LIST MODE STYLE */
.list-row {
    display: flex;
    align-items: center;
    padding: 4px 8px;
    height: 32px;
}
.list-row .icon-container {
    width: 24px;
    height: 24px;
    margin-right: 8px;
}
.list-row .emoji-icon {
    font-size: 1rem;
}
.list-row .name-container {
    flex: 1;
    display: flex;
    align-items: center;
    min-width: 0;
}
.list-row .file-name {
    font-size: 0.8rem;
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
}
</style>
