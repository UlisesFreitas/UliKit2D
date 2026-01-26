<template>
    <div 
        class="assets-content flex-1 h-full overflow-y-auto bg-bg-base p-2 relative outline-none" 
        @click.self="() => {
             // If simple click on background (and not end of drag), clear
             if (!dragState.isSelecting) assetStore.clearSelection();
        }"
        @mousedown="onMouseDown"
        @contextmenu.self.prevent="() => { /* Context menu on background? Future feature */ }"
        @dragover.prevent 
        @drop.prevent="onDrop"
        @keydown="onKeyDown"
        tabindex="0"
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
                    'is-selected': assetStore.selectedPaths.has(file.path),
                    'list-row': assetStore.zoomLevel === 0,
                    'grid-card': assetStore.zoomLevel > 0
                }"
                draggable="true"
                @dragstart="onDragStart($event, file)"
                @click.stop="onFileClick($event, file)"
                @dblclick="onDoubleClick(file)"
                @contextmenu="showContextMenu($event, file)"
                :data-path="file.path"
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
        
        <!-- Selection Rect -->
        <div v-if="dragState.isSelecting" 
             class="absolute border border-accent-color bg-accent-color/20 pointer-events-none z-50"
             :style="{
                 left: Math.min(dragState.startX, dragState.currentX) + 'px',
                 top: Math.min(dragState.startY, dragState.currentY) + 'px',
                 width: Math.abs(dragState.currentX - dragState.startX) + 'px',
                 height: Math.abs(dragState.currentY - dragState.startY) + 'px'
             }"
        ></div>

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
                 
                 <!-- Header: Show Selection Count if > 1 -->
                 <div class="px-3 py-1 text-[10px] font-bold text-text-secondary truncate max-w-[200px]">
                    {{ assetStore.selectedPaths.size > 1 ? `${assetStore.selectedPaths.size} items` : menuState.file?.name }}
                 </div>
                 <div class="h-[1px] bg-border my-1"></div>
                
                <!-- Rename (Single Only) -->
                <button 
                    v-if="assetStore.selectedPaths.size <= 1"
                    @click="promptRename" 
                    class="w-full text-left px-3 py-1.5 hover:bg-bg-selection text-xs hover:text-text-primary transition-colors"
                >
                    Rename
                </button>
                 <div class="h-[1px] bg-border my-1" v-if="assetStore.selectedPaths.size <= 1"></div>
                
                <!-- Delete (Batch) -->
                <button 
                    v-if="canDeleteSelection"
                    @click="deleteSelection" 
                    class="w-full text-left px-3 py-1.5 hover:bg-bg-selection hover:text-accent-danger text-xs text-accent-danger transition-colors"
                >
                    Delete {{ assetStore.selectedPaths.size > 1 ? `(${assetStore.selectedPaths.size})` : '' }}
                </button>
            </div>
        </Teleport>
    </div>
</template>

<script setup lang="ts">
import { ref, onMounted, onUnmounted, watch, computed, nextTick, reactive } from 'vue';
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

const dragState = reactive({
    isSelecting: false,
    startX: 0,
    startY: 0,
    currentX: 0,
    currentY: 0
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
    e.stopPropagation();
    
    // Select if not selected (Right click should select)
    // If clicking on an already selected item in multi-select, keep selection!
    if (!assetStore.selectedPaths.has(file.path)) {
        assetStore.select(file.path);
    }
    
    // 1. Initial State
    menuState.value = {
        visible: true,
        x: e.clientX,
        y: e.clientY,
        file: file
    };
    
    await nextTick();
    
    if (contextMenuRef.value) {
        const menuRect = contextMenuRef.value.getBoundingClientRect();
        const winWidth = window.innerWidth;
        const winHeight = window.innerHeight;
        
        let x = e.clientX;
        let y = e.clientY;
        
        if (x + menuRect.width > winWidth) x -= menuRect.width;
        if (y + menuRect.height > winHeight) y -= menuRect.height;
        
        menuStyle.value = { top: `${y}px`, left: `${x}px` };
    }
};

const onFileClick = (e: MouseEvent, file: FileNode) => {
    if (e.ctrlKey || e.metaKey) {
        assetStore.toggleSelection(file.path);
    } else if (e.shiftKey) {
        assetStore.selectRange(file.path);
    } else {
        assetStore.select(file.path);
    }
};

const onDoubleClick = (file: FileNode) => {
    if (file.type === 'directory') {
        assetStore.changeDirectory(file.path);
    } else {
        console.log('Open File:', file.path);
    }
};

// Drag Selection Logic
const onMouseDown = (e: MouseEvent) => {
    // Only left click and on background (not if target is file-item)
    // Actually, identifying if we clicked a file-item is tricky if bubbling.
    // We used @click.stop on file-item, so this won't fire for file clicks if we rely on bubbling?
    // Wait, onFileClick has .stop
    
    if (e.button !== 0) return;
    if ((e.target as HTMLElement).closest('.file-item')) return; // Should be handled by .stop, but safety.
    
    // Clear selection if simple click on BG
    if (!e.ctrlKey && !e.metaKey && !e.shiftKey) {
        assetStore.clearSelection();
    }
    
    dragState.isSelecting = true;
    
    // Calculate Relative Start (compensate for container position + scroll)
    const container = e.currentTarget as HTMLElement;
    const rect = container.getBoundingClientRect();
    
    dragState.startX = e.clientX - rect.left + container.scrollLeft;
    dragState.startY = e.clientY - rect.top + container.scrollTop;
    dragState.currentX = dragState.startX;
    dragState.currentY = dragState.startY;
    
    // Cache rect and initial scroll reference if needed, but we re-query container in move for scroll
    (dragState as any).containerRect = rect;
    
    document.addEventListener('mousemove', onMouseMove);
    document.addEventListener('mouseup', onMouseUp);
};

const onMouseMove = (e: MouseEvent) => {
    if (!dragState.isSelecting) return;
    
    const container = document.querySelector('.assets-content');
    if (container) {
        const r = container.getBoundingClientRect();
        // Use fresh rect to handle window resize/scroll quirks, and fresh scrollLeft
         dragState.currentX = e.clientX - r.left + container.scrollLeft;
         dragState.currentY = e.clientY - r.top + container.scrollTop;
    }
};

const onMouseUp = (e: MouseEvent) => {
    if (!dragState.isSelecting) return;
    dragState.isSelecting = false;
    document.removeEventListener('mousemove', onMouseMove);
    document.removeEventListener('mouseup', onMouseUp);
    
    // Calculate Selection
    const r = {
        x: Math.min(dragState.startX, dragState.currentX),
        y: Math.min(dragState.startY, dragState.currentY),
        w: Math.abs(dragState.currentX - dragState.startX),
        h: Math.abs(dragState.currentY - dragState.startY)
    };
    
    // If box is tiny, treat as click and done (already cleared above)
    if (r.w < 5 && r.h < 5) return;

    // Find overlapping elements
    // We need to check intersection in RELATIVE coordinates or Viewport?
    // easiest is Viewport rects.
    // So convert our R (which is relative/absolute) back to viewport? 
    // OR measure elements relative to container.
    
    // Let's use Viewport for Intersection Check (Standard API)
    // Convert selection box back to viewport for check
    
    const container = document.querySelector('.assets-content');
    if (!container) return;
    const contRect = container.getBoundingClientRect();
    
    // Box in Viewport Coords:
    // x = r.x (rel) + contRect.left - cont.scrollLeft
    const viewR = {
        left: r.x + contRect.left - container.scrollLeft,
        top: r.y + contRect.top - container.scrollTop,
        right: r.x + r.w + contRect.left - container.scrollLeft,
        bottom: r.y + r.h + contRect.top - container.scrollTop
    };

    const fileItems = document.querySelectorAll('.file-item');
    const newSelection = new Set<string>();
    
    // If ctrl held, we ADD to selection, else we replace? 
    // Usually Drag Select implies "Select these". 
    // If Ctrl held, merge.
    if (e.ctrlKey || e.metaKey) {
        assetStore.selectedPaths.forEach(p => newSelection.add(p));
    }

    fileItems.forEach((el) => {
        const rect = el.getBoundingClientRect();
        
        // Check Intersection (Viewport vs Viewport)
        const overlaps = !(rect.right < viewR.left || 
                           rect.left > viewR.right || 
                           rect.bottom < viewR.top || 
                           rect.top > viewR.bottom);
                           
        if (overlaps) {
             // Find path from... key? vue loop?
             // Accessing vue data from DOM is hacking.
             // Better: Iterate visibleFiles and assume order matches DOM or use data attribute.
             // We can put data-path on element
             const path = (el as HTMLElement).getAttribute('data-path');
             if (path) {
                 if (e.ctrlKey || e.metaKey) {
                    // Toggle behavior in box select? Or Just Add? Usually Add.
                    newSelection.add(path);
                 } else {
                    newSelection.add(path);
                 }
             }
        }
    });
    
    // Commit
    assetStore.selectedPaths = newSelection;
    if (newSelection.size > 0) {
        assetStore.lastSelectedPath = Array.from(newSelection).pop() || null;
    }
};

const promptRename = async () => {
    // Only valid for single selection
    if (assetStore.selectedPaths.size !== 1) return;
    const path = Array.from(assetStore.selectedPaths)[0];
    const file = assetStore.files.find(f => f.path === path);
    
    if (!file) return;
    closeContextMenu();

    if (file.path === 'assets') {
         ui.showToast({ title: 'Error', description: 'Cannot rename root assets folder.', type: 'error' });
         return;
    }

    const newName = await ui.prompt({
        title: 'Rename Asset',
        message: `Enter new name for ${file.name}:`,
        defaultValue: file.name,
        confirmText: 'Rename',
        placeholder: 'New Name'
    });

    if (newName && newName !== file.name) {
        await ProjectManager.renameAsset(file.path, newName);
    }
};

const canDeleteSelection = computed(() => {
    // Cannot delete if any selected path is 'assets'
    // or if selection is empty
    if (assetStore.selectedPaths.size === 0) return false;
    return !assetStore.selectedPaths.has('assets');
});

const deleteSelection = async () => {
    if (!canDeleteSelection.value) return;
    closeContextMenu();
    
    const count = assetStore.selectedPaths.size;
    const message = count === 1 
        ? `Delete '${(Array.from(assetStore.selectedPaths)[0]?.split('/').pop() || 'Item')}'?` 
        : `Delete ${count} items?`;

    if (await ui.confirm({
        title: 'Delete Assets',
        message: message,
        confirmText: 'Delete',
        isDanger: true
    })) {
        // Batch Delete
        const paths = Array.from(assetStore.selectedPaths);
        // Sort paths to potentially delete children before parents? 
        // Actually ProjectManager.deleteAsset handles recursive, so order usually fine unless nested selected.
        // If we select "A" and "A/B", deleting A kills B. Deleting B then fails.
        // Filter out paths that are descendants of other selected paths.
        
        const sorted = paths.sort(); // Lexicographical sort puts parents before children
        const toDelete: string[] = [];
        
        for (const p of sorted) {
            // If any existing toDelete is a parent of p, skip p
            // e.g. "assets/A" is in toDelete. p is "assets/A/B".
            // "assets/A/B".startsWith("assets/A/") is true.
            const isDescendant = toDelete.some(parent => p.startsWith(parent + '/'));
            if (!isDescendant) {
                toDelete.push(p);
            }
        }
        
        // Delete remaining
        for (const p of toDelete) {
             await ProjectManager.deleteAsset(p);
        }
        
        assetStore.clearSelection();
    }
};

// --- DRAG STUFF ---

const onDragStart = (e: DragEvent, file: FileNode) => {
    const dt = e.dataTransfer;
    if (dt) {
        // If dragging a selected item, move ALL selected items
        // If dragging an unselected item, select it first (handled by click/mousedown usually, but dragstart might be faster)
        
        let paths = Array.from(assetStore.selectedPaths);
        
        if (!assetStore.selectedPaths.has(file.path)) {
            // Dragging an unselected item -> Select it exclusively
            assetStore.select(file.path);
            paths = [file.path];
        }
        
        // We can only put string data. JSON encode list?
        // Or standard is usually list of files if native.
        // For internal, we can put a custom JSON.
        
        const dragData = JSON.stringify(paths);
        dt.setData('application/ulikit-assets', dragData);
        dt.setData('text/plain', file.path); // Fallback for single
        dt.effectAllowed = 'copyMove';
        
        // Custom Drag Image?
        // dt.setDragImage(...)
    }
};

// ... onDrop (keep existing logic + support internal moves if needed later) ...

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

// --- KEYBOARD NAV ---
const onKeyDown = (e: KeyboardEvent) => {
    if (assetStore.visibleFiles.length === 0) return;
    
    const isGrid = assetStore.zoomLevel > 0;
    const container = document.querySelector('.assets-content');
    const cols = (isGrid && container) 
        ? Math.floor(container.clientWidth / (assetStore.zoomLevel === 1 ? 76 : assetStore.zoomLevel === 2 ? 106 : 136)) || 1 
        : 1; 
    
    let index = -1;
    if (assetStore.lastSelectedPath && assetStore.selectedPaths.size > 0) {
        // Must find index in VISIBLE files, not raw files
        index = assetStore.visibleFiles.findIndex(f => f.path === assetStore.lastSelectedPath);
    }
    
    // If no selection, select first
    if (index === -1) {
        if (e.key === 'ArrowDown' || e.key === 'ArrowRight' || e.key === 'ArrowUp' || e.key === 'ArrowLeft') {
            index = 0;
            selectIndex(index);
        }
        return;
    }
    
    let handled = false;
    
    // If List View (cols=1), ArrowRight acts like Down, ArrowLeft acts like Up (optional, or just do nothing)
    // But standard is: Right/Left move 1, Up/Down move 1 (in list) OR move row (in grid)
    
    if (e.key === 'ArrowDown') {
        const next = index + (isGrid ? cols : 1);
        if (next < assetStore.visibleFiles.length) selectIndex(next);
        else selectIndex(assetStore.visibleFiles.length - 1); // Clamp
        handled = true;
    } else if (e.key === 'ArrowUp') {
        const prev = index - (isGrid ? cols : 1);
        if (prev >= 0) selectIndex(prev);
        else selectIndex(0); // Clamp
        handled = true;
    } else if (e.key === 'ArrowRight') {
        if (isGrid) {
            const next = index + 1;
            if (next < assetStore.visibleFiles.length) selectIndex(next);
            handled = true;
        } else {
             // In list view, Right might expand folder? Left collapse?
             // For now, let's make Right = Down, Left = Up? Or just Ignore?
             // User typical expectation: standard list navigates with Up/Down. Right/Left might do nothing or expand.
             // We'll leave Right/Left for Grid only or make them traverse 1 by 1.
             // "saltar del primero al ultimo" happened because index was wrong.
             // Let's safe guard Right/Left to +1/-1
             const next = index + 1;
             if (next < assetStore.visibleFiles.length) selectIndex(next);
             handled = true;
        }
    } else if (e.key === 'ArrowLeft') {
        if (isGrid) {
            const prev = index - 1;
            if (prev >= 0) selectIndex(prev);
            handled = true;
        } else {
             const prev = index - 1;
             if (prev >= 0) selectIndex(prev);
             handled = true;
        }
    }
    
    if (handled) {
        e.preventDefault();
    }
};

const selectIndex = (i: number) => {
    const file = assetStore.visibleFiles[i];
    if (file) {
        assetStore.select(file.path);
        // Scroll into view
        // Need nextTick for DOM update
        nextTick(() => {
            const el = document.querySelector(`[data-path="${CSS.escape(file.path)}"]`);
            if (el) el.scrollIntoView({ block: 'nearest' });
        });
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
.file-item.is-selected {
    background-color: var(--bg-selection);
    border-color: var(--accent-color);
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
