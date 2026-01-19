<script setup lang="ts">
import { useEditorStore } from '../../stores/useEditorStore';
import { useTilemapStore } from '../stores/useTilemapStore';

const editorStore = useEditorStore();
const tilemapStore = useTilemapStore();
</script>

<template>
    <div class="flex items-center">
        <button 
            @click="(!tilemapStore.isPaintMode) && (editorStore.isPlaying ? editorStore.stopGame() : editorStore.playGame())"
            :disabled="tilemapStore.isPaintMode"
            class="group relative flex items-center justify-center px-6 py-1.5 rounded-full font-bold text-sm transition-all duration-300 shadow-md disabled:opacity-50 disabled:cursor-not-allowed"
            :class="editorStore.isPlaying 
                ? 'bg-gradient-to-r from-red-600 to-red-500 hover:from-red-500 hover:to-red-400 text-white shadow-red-900/50' 
                : 'bg-gradient-to-r from-green-600 to-emerald-500 hover:from-green-500 hover:to-emerald-400 text-white shadow-green-900/50'"
            :title="tilemapStore.isPaintMode ? 'Cannot play while in Tilemap Mode' : ''"
        >
            <span class="mr-2">{{ editorStore.isPlaying ? '⏹' : '▶' }}</span>
            {{ editorStore.isPlaying ? 'Stop' : 'Play' }}
            
            <!-- Glow Effect -->
            <div 
                v-if="!tilemapStore.isPaintMode"
                class="absolute inset-0 rounded-full opacity-0 group-hover:opacity-50 transition-opacity duration-300 blur-sm -z-10"
                :class="editorStore.isPlaying ? 'bg-red-500' : 'bg-green-500'"
            ></div>
        </button>
    </div>
</template>
