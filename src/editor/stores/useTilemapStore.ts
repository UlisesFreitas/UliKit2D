import { defineStore } from 'pinia';
import { ref } from 'vue';

export const useTilemapStore = defineStore('tilemap', () => {
    const selectedTileId = ref<number>(-1);
    const isPaintMode = ref(false);
    const currentTool = ref<'brush' | 'eraser'>('brush');

    function setSelectedTile(id: number) {
        selectedTileId.value = id;
    }

    function setPaintMode(enabled: boolean) {
        isPaintMode.value = enabled;
    }

    function setTool(tool: 'brush' | 'eraser') {
        currentTool.value = tool;
    }

    return {
        selectedTileId,
        isPaintMode,
        currentTool,
        setSelectedTile,
        setPaintMode,
        setTool
    };
});
