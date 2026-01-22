<script setup lang="ts">
import { computed } from 'vue';
import { 
    TooltipProvider, 
    TooltipRoot, 
    TooltipTrigger, 
    TooltipContent,
    TooltipPortal,
    TooltipArrow
} from 'radix-vue';
import { 
    Undo, 
    Redo, 
    ZoomIn, 
    ZoomOut, 
    Grid, 
    Magnet,
    Bug
} from 'lucide-vue-next';

const props = defineProps<{
    zoom: number;
    showGrid: boolean;
    snapToGrid: boolean;
    showDebugPanel: boolean;
}>();

const emit = defineEmits<{
    (e: 'update:zoom', value: number): void;
    (e: 'update:showGrid', value: boolean): void;
    (e: 'update:snapToGrid', value: boolean): void;
    (e: 'update:showDebugPanel', value: boolean): void;
    (e: 'undo'): void;
    (e: 'redo'): void;
}>();

const zoomPercent = computed(() => Math.round(props.zoom * 100) + '%');

const adjustZoom = (delta: number) => {
    let newZoom = props.zoom + delta;
    newZoom = Math.max(0.1, Math.min(newZoom, 5));
    emit('update:zoom', newZoom);
};

// Debug Layers Logic moved to ScenePanel
</script>

<template>
<TooltipProvider>
    <div class="flex items-center space-x-2 border border-border rounded-full px-4 py-2 shadow-lg select-none text-text-primary"
         style="background-color: var(--bg-header);">
        
        <!-- Undo/Redo -->
        <TooltipRoot>
            <TooltipTrigger class="icon-btn" @click="emit('undo')">
                <Undo :size="16" />
            </TooltipTrigger>
            <TooltipPortal>
                <TooltipContent class="tooltip-content" :side-offset="5">
                    Undo
                    <TooltipArrow class="fill-bg-panel"/>
                </TooltipContent>
            </TooltipPortal>
        </TooltipRoot>

        <TooltipRoot>
            <TooltipTrigger class="icon-btn" @click="emit('redo')">
                <Redo :size="16" />
            </TooltipTrigger>
            <TooltipPortal>
                <TooltipContent class="tooltip-content" :side-offset="5">
                    Redo
                    <TooltipArrow class="fill-bg-panel"/>
                </TooltipContent>
            </TooltipPortal>
        </TooltipRoot>

        <div class="w-[1px] h-4 bg-border mx-2"></div>

        <!-- Zoom -->
        <TooltipRoot>
            <TooltipTrigger class="icon-btn" @click="adjustZoom(-0.1)">
                <ZoomOut :size="16" />
            </TooltipTrigger>
            <TooltipPortal>
                <TooltipContent class="tooltip-content">Zoom Out</TooltipContent>
            </TooltipPortal>
        </TooltipRoot>

        <span class="text-xs font-mono w-12 text-center text-text-primary">{{ zoomPercent }}</span>

        <TooltipRoot>
            <TooltipTrigger class="icon-btn" @click="adjustZoom(0.1)">
                <ZoomIn :size="16" />
            </TooltipTrigger>
             <TooltipPortal>
                <TooltipContent class="tooltip-content">Zoom In</TooltipContent>
            </TooltipPortal>
        </TooltipRoot>

        <div class="w-[1px] h-4 bg-border mx-2"></div>

        <!-- Grid/Snap -->
        <TooltipRoot>
            <TooltipTrigger 
                class="icon-btn" 
                :class="{'active': showGrid}"
                @click="emit('update:showGrid', !showGrid)"
            >
                <Grid :size="16" />
            </TooltipTrigger>
            <TooltipPortal>
                <TooltipContent class="tooltip-content">Toggle Grid</TooltipContent>
            </TooltipPortal>
        </TooltipRoot>

        <TooltipRoot>
            <TooltipTrigger 
                class="icon-btn" 
                :class="{'active': snapToGrid}"
                @click="emit('update:snapToGrid', !snapToGrid)"
            >
                <Magnet :size="16" />
            </TooltipTrigger>
            <TooltipPortal>
                <TooltipContent class="tooltip-content">Snap to Grid</TooltipContent>
            </TooltipPortal>
        </TooltipRoot>

        <div class="w-[1px] h-4 bg-border mx-2"></div>

        <TooltipRoot>
            <TooltipTrigger 
                class="icon-btn" 
                :class="{'active': showDebugPanel}"
                @click="emit('update:showDebugPanel', !showDebugPanel)"
            >
                <Bug :size="16" />
            </TooltipTrigger>
            <TooltipPortal>
                <TooltipContent class="tooltip-content">Debug Tools</TooltipContent>
            </TooltipPortal>
        </TooltipRoot>

    </div>
</TooltipProvider>
</template>

<style scoped>
.icon-btn {
    padding: 6px;
    border-radius: 50%;
    color: var(--text-secondary);
    transition: all 0.2s;
    cursor: pointer;
    display: flex;
    align-items: center;
    justify-content: center;
}
.icon-btn:hover {
    color: var(--text-primary);
    background-color: var(--bg-hover);
}
.icon-btn.active {
    color: var(--accent-color);
    background-color: var(--bg-selection);
}

/* Tooltip Styles */
.tooltip-content {
    background-color: var(--bg-panel);
    color: var(--text-primary);
    font-size: 11px;
    padding: 4px 8px;
    border-radius: 4px;
    border: 1px solid var(--border-color);
    z-index: 10000;
}
</style>
