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
            <div v-if="menuState.visible && activeFile" 
                 class="fixed bg-bg-panel border border-border shadow-lg rounded z-[9999] py-1 min-w-[140px]"
                 :style="menuStyle">
                 <div class="px-3 py-1 text-[10px] font-bold text-text-secondary truncate max-w-[200px]">{{ activeFile.name }}</div>
                 <div class="h-[1px] bg-border my-1"></div>
                <button 
                    v-if="activeFile.path !== 'assets'"
                    @click="startRename" 
                    class="w-full text-left px-3 py-1.5 hover:bg-bg-selection hover:text-text-primary text-xs text-text-secondary transition-colors"
                >
                    Rename
                </button>
                <button 
                    v-if="activeFile.path !== 'assets'"
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
import { ref, onMounted, onUnmounted, watch, computed } from 'vue';
import { useAssetStore, type FileNode } from '../../../stores/useAssetStore';
import { useUIStore } from '../../../stores/useUIStore';
import { getFileSystem } from '../../../api/FileSystem';
import { AssetDatabase } from '../../managers/AssetDatabase';
import { projectState } from '../../managers/ProjectManager';

const assetStore = useAssetStore();
const ui = useUIStore();
const thumbnails = ref<Record<string, string>>({});

// Context Menu State
const menuState = ref({
    visible: false,
    x: 0,
    y: 0,
    bindBottom: false,
    filePath: ''
});

// Computed Active File (Live from Store)
const activeFile = computed(() => {
    if (!menuState.value.filePath) return null;
    return assetStore.visibleFiles.find(f => f.path === menuState.value.filePath) || null;
});

const menuStyle = computed(() => {
    const { x, y, bindBottom } = menuState.value;
    if (bindBottom) {
        return {
            left: `${x}px`,
            bottom: `${window.innerHeight - y}px`,
            top: 'auto'
        };
    }
    return {
        left: `${x}px`,
        top: `${y}px`,
        bottom: 'auto'
    };
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

const closeContextMenu = () => {
    menuState.value.visible = false;
};

const showContextMenu = (e: MouseEvent, file: any) => {
    e.preventDefault();
    
    // Smart Positioning
    // If we are near the bottom (arbitrary safety threshold, e.g. 150px), anchor to BOTTOM.
    const threshold = 150; 
    const windowHeight = window.innerHeight;
    const spaceBelow = windowHeight - e.clientY;
    
    const isFlipUp = spaceBelow < threshold;

    // Force close first to trigger re-mount (Clears rendering artifacts/ghosting)
    menuState.value.visible = false;
    
    // Use nextTick equivalent to re-open
    setTimeout(() => {
        menuState.value = {
            visible: true,
            x: e.clientX,
            y: e.clientY,
            bindBottom: isFlipUp, // New flag
            filePath: file.path
        };
    }, 0);
};

const startRename = async () => {
    const file = activeFile.value;
    if (!file) return;

    // Logic Fix: Forbid renaming the root 'assets' folder
    if (file.name === 'assets' && (file.path === 'assets' || file.path === '/assets')) {
         ui.showToast({ title: 'Protected', description: 'The root assets folder cannot be renamed.', type: 'warning' });
         closeContextMenu();
         return;
    }
    
    closeContextMenu();

    const oldExt = file.name.includes('.') ? '.' + file.name.split('.').pop()! : '';
    let newNameInput = await ui.prompt({
        title: 'Rename Asset',
        message: 'Enter new name:',
        defaultValue: file.name
    });

    if (newNameInput) {
        // Validation: Append extension if user cleared it?
        // E.g. User types "foo", we make it "foo.png" if it was "bar.png"
        // Unless user explicitly types an extension?
        // Simple logic: If input has no extension, append old extension.
        if (oldExt && !newNameInput.includes('.')) {
            newNameInput += oldExt;
        }

        if (newNameInput !== file.name) {
            await assetStore.renameAsset(file.path, newNameInput);
        }
    }
};

const deleteAsset = async () => {
    const file = activeFile.value;
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
        const fs = getFileSystem();
        const success = await fs.deleteFile(file.path);
        if (!success) {
            ui.showToast({ title: 'Error', description: 'Failed to delete file', type: 'error' });
        }
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
        // 1. Text/Plain Support (Legacy & Scene View fallback)
        e.dataTransfer.setData('text/plain', file.path);

        // 2. Strict Asset Protocol (Synchronous)
        const db = AssetDatabase.instance;
        const guid = db.getAssetGuid(file.path);
        
        if (guid) {
            const payload = {
                guid: guid,
                type: db.getAsset(guid)?.type || 'unknown',
                path: file.path
            };
            
            e.dataTransfer.setData('application/ulikit-asset', JSON.stringify(payload));
            console.log('[Drag] Started Asset:', payload);
        } else {
             // If DB doesn't have it (e.g. just added), we can try to guess or just rely on path.
             // But usually DB is up to date since AssetStore updates driven by it.
             if (file.type === 'file') {
                 // Fallback payload without GUID? Or just skip?
                 // Let's send path-only payload if strict mode requires it.
                 /*
                 const payload = { guid: '', type: 'unknown', path: file.path };
                 e.dataTransfer.setData('application/ulikit-asset', JSON.stringify(payload));
                 */
             }
        }
        
        e.dataTransfer.effectAllowed = 'copy';
    }
};

const onDrop = async (e: DragEvent) => {
    const files = e.dataTransfer?.files;
    if (!files || files.length === 0) return;
    if (!projectState.currentProjectPath) return;

    const fs = getFileSystem();
    const currentRelPath = assetStore.currentPath || '';
    
    // Reuse logic from previous implementation
     for (let i = 0; i < files.length; i++) {
        const file = files[i]!;
        const destPath = currentRelPath ? `${currentRelPath}/${file.name}` : file.name;
        
        if (fs.isElectron) {
            const sourcePath = fs.getPathForFile(file);
            if (sourcePath) {
                const destFolder = projectState.currentProjectPath as string;
                const finalDestFolder = currentRelPath ? `${destFolder}/${currentRelPath}` : destFolder;
                await fs.importFile(sourcePath, finalDestFolder);
            }
        } else {
            await fs.writeFile(destPath, file);
        }
    }
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
