<script setup lang="ts">
import { computed, ref } from 'vue';
import { type Entity } from '../../../engine/ecs/ECS';
import { eventBus } from '../../../engine/core/EventBus';
import { getFileSystem } from '../../../api/FileSystem';

const props = defineProps<{
    entity: Entity;
}>();

const text = computed({
    get: () => props.entity.bitmapText?.text || '',
    set: (val) => {
        if (props.entity.bitmapText) {
            props.entity.bitmapText.text = val;
            emitUpdate();
        }
    }
});

const fontName = computed({
    get: () => props.entity.bitmapText?.fontName || '',
    set: (val) => {
        if (props.entity.bitmapText) {
            props.entity.bitmapText.fontName = val;
            emitUpdate();
        }
    }
});

const fontTexture = computed({
    get: () => props.entity.bitmapText?.fontTexture || '',
    set: (val) => {
        if (props.entity.bitmapText) {
            props.entity.bitmapText.fontTexture = val;
            emitUpdate();
        }
    }
});

const fontSize = computed({
    get: () => props.entity.bitmapText?.fontSize || 32,
    set: (val) => {
        if (props.entity.bitmapText) {
            props.entity.bitmapText.fontSize = val;
            emitUpdate();
        }
    }
});

const align = computed({
    get: () => props.entity.bitmapText?.align || 'left',
    set: (val) => {
        if (props.entity.bitmapText) {
            props.entity.bitmapText.align = val as any;
            emitUpdate();
        }
    }
});

const tint = computed({
    get: () => '#' + (props.entity.bitmapText?.tint || 0xffffff).toString(16).padStart(6, '0'),
    set: (val) => {
        if (props.entity.bitmapText) {
            props.entity.bitmapText.tint = parseInt(val.replace('#', ''), 16);
            emitUpdate();
        }
    }
});

const emitUpdate = () => {
    eventBus.emit('component-updated', props.entity.id);
};

const fileInputRef = ref<HTMLInputElement | null>(null);
const activeFileMode = ref<'fnt' | 'img'>('fnt');

const triggerFileSelect = (mode: 'fnt' | 'img') => {
    activeFileMode.value = mode;
    if (fileInputRef.value) {
        // Reset to allow re-selecting same file
        fileInputRef.value.value = '';
        fileInputRef.value.click();
    }
};

const handleFileSelect = (e: Event) => {
    const input = e.target as HTMLInputElement;
    if (input.files && input.files.length > 0) {
        const file = input.files[0];
        if (!file) return;

        const fs = getFileSystem();
        let path = fs.getPathForFile(file) || file.name;
        
        // Normalize
         if (path.startsWith('file:///')) {
            path = decodeURI(path.slice(8));
        }

        if (activeFileMode.value === 'fnt') {
            fontName.value = path;
        } else {
            fontTexture.value = path;
        }
    }
};

// Drag & Drop for Font File
const onDropFont = async (e: DragEvent) => {
    const data = e.dataTransfer?.getData('text/plain');
    if (data && data.toLowerCase().endsWith('.fnt')) {
        let finalPath = data;
        if (finalPath.startsWith('file:///')) {
            finalPath = decodeURI(finalPath.slice(8));
        }
        fontName.value = finalPath;
    }
};

const onDropTexture = async (e: DragEvent) => {
    const data = e.dataTransfer?.getData('text/plain');
    if (data && (data.toLowerCase().endsWith('.png') || data.toLowerCase().endsWith('.jpg'))) {
        let finalPath = data;
        if (finalPath.startsWith('file:///')) {
            finalPath = decodeURI(finalPath.slice(8));
        }
        fontTexture.value = finalPath;
    }
};

</script>

<template>
    <div class="space-y-2 p-1" v-if="props.entity.bitmapText">
        
        <!-- Text Content -->
        <div class="flex flex-col">
            <label class="text-xs text-text-secondary mb-1">Text Content</label>
            <textarea 
                v-model="text" 
                class="bg-bg-input border border-border rounded p-2 text-sm text-text-primary resize-y min-h-[60px] focus:border-accent-color outline-none"
                placeholder="Enter text..."
            ></textarea>
        </div>

        <!-- Font File -->
        <div class="grid grid-cols-[80px_1fr] items-center gap-2">
            <label class="text-xs text-text-secondary w-16">Font File</label>
            <div class="flex gap-1">
                <div 
                    class="flex-1 flex items-center gap-2 bg-bg-input border border-border rounded p-1 overflow-hidden"
                    @dragover.prevent
                    @drop.prevent="onDropFont"
                >
                    <input 
                        v-model="fontName" 
                        class="bg-transparent text-xs w-full outline-none px-1 text-text-primary"
                        placeholder="Drag .fnt file"
                        readonly
                    />
                </div>
                <button 
                    @click="triggerFileSelect('fnt')"
                    class="bg-bg-input hover:bg-bg-hover border border-border rounded px-2 py-1 text-xs"
                    title="Select Font"
                >
                    📂
                </button>
            </div>
        </div>

        <!-- Font Texture Override (Optional) -->
        <div class="grid grid-cols-[80px_1fr] items-center gap-2">
            <label class="text-xs text-text-secondary w-16" title="Optional texture override">Texture</label>
            <div class="flex gap-1">
                <div 
                    class="flex-1 flex items-center gap-2 bg-bg-input border border-border rounded p-1 overflow-hidden"
                    @dragover.prevent
                    @drop.prevent="onDropTexture"
                >
                    <input 
                        v-model="fontTexture" 
                        class="bg-transparent text-xs w-full outline-none px-1 text-text-primary"
                        placeholder="Default (from .fnt)"
                        readonly
                    />
                </div>
                <button 
                    @click="triggerFileSelect('img')"
                    class="bg-bg-input hover:bg-bg-hover border border-border rounded px-2 py-1 text-xs"
                    title="Select Texture"
                >
                    📂
                </button>
            </div>
        </div>

        <input 
            type="file" 
            ref="fileInputRef" 
            class="hidden" 
            @change="handleFileSelect"
            accept=".fnt,.xml,.png,.jpg,.jpeg"
        />

        <!-- Size & Color -->
        <div class="grid grid-cols-2 gap-2 mt-2">
            <div class="flex items-center gap-2">
                 <label class="text-xs text-text-secondary w-16">Size</label>
                 <input 
                    type="number" 
                    v-model.number="fontSize" 
                    class="flex-1 bg-bg-input border border-border rounded px-2 py-1 text-sm focus:border-accent-color outline-none min-w-0" 
                />
            </div>
            <div class="flex items-center gap-2">
                <label class="text-xs text-text-secondary w-16">Color</label>
                <div class="flex-1 flex items-center bg-bg-input border border-border rounded px-1">
                    <input 
                        type="color" 
                        v-model="tint" 
                        class="w-6 h-6 bg-transparent cursor-pointer border-none p-0" 
                    />
                    <span class="text-[10px] font-mono ml-1 text-text-secondary truncate">{{ tint.toUpperCase() }}</span>
                </div>
            </div>
        </div>

        <!-- Align -->
        <div class="flex items-center space-x-2 mt-1">
            <label class="text-xs text-text-secondary w-16">Align</label>
            <div class="flex bg-bg-input rounded border border-border overflow-hidden">
                <button 
                    class="px-2 py-1 hover:bg-bg-hover transition-colors" 
                    :class="align === 'left' ? 'bg-accent-color text-white' : 'text-text-secondary'"
                    @click="align = 'left'"
                    title="Left"
                >
                    ⬅
                </button>
                <button 
                     class="px-2 py-1 hover:bg-bg-hover transition-colors border-l border-r border-border"
                    :class="align === 'center' ? 'bg-accent-color text-white' : 'text-text-secondary'"
                    @click="align = 'center'"
                    title="Center"
                >
                    ⬇
                </button>
                <button 
                     class="px-2 py-1 hover:bg-bg-hover transition-colors"
                    :class="align === 'right' ? 'bg-accent-color text-white' : 'text-text-secondary'"
                    @click="align = 'right'"
                    title="Right"
                >
                    ➡
                </button>
            </div>
        </div>
        
    </div>
</template>
