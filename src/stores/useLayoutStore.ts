import { defineStore } from 'pinia';
import { ref } from 'vue';

const LAYOUT_KEY = 'editor-layout-v5';

export const useLayoutStore = defineStore('layout', () => {
    const layoutState = ref<any>(null);
    const dockApi = ref<any>(null);

    const saveLayout = (json: any) => {
        layoutState.value = json;
        localStorage.setItem(LAYOUT_KEY, JSON.stringify(json));
    };

    const loadLayout = (): any | null => {
        const saved = localStorage.getItem(LAYOUT_KEY);
        if (saved) {
            try {
                return JSON.parse(saved);
            } catch (e) {
                console.error('Failed to parse saved layout', e);
            }
        }
        return null;
    };

    const setApi = (api: any) => {
        dockApi.value = api;
    };

    const hasSavedLayout = () => {
        return !!localStorage.getItem(LAYOUT_KEY);
    };

    const resetLayout = () => {
        localStorage.removeItem(LAYOUT_KEY);
        // We can reload the page or trigger a re-mount.
        // For now, removing and reloading window is simplest to ensure full reset
        window.location.reload();
    };

    return {
        layoutState,
        saveLayout,
        loadLayout,
        setApi,
        hasSavedLayout,
        resetLayout
    };
});
