import { defineStore } from 'pinia';
import { ref } from 'vue';

const LAYOUT_KEY = 'editor-layout-v16';

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

    const openPanel = (id: string, title: string = 'Panel') => {
        if (!dockApi.value) return;
        
        const panel = dockApi.value.getPanel(id);
        if (panel) {
            panel.focus();
        } else {
            // Create Panel (Docked by default for safety)
             try {
                 dockApi.value.addPanel({
                     id: id,
                     component: id,
                     title: title,
                     position: { referencePanel: 'inspector', direction: 'left' }
                 });
             } catch(e: any) {
                 if (e.message && e.message.includes('already exists')) {
                     // If it exists but getPanel failed (maybe floating?), try to focus it if possible or just ignore.
                     // Often getPanel finds it but we still tried adding.
                     // But if getPanel returned null, and addPanel says exists, that's odd.
                     // Let's rely on dockApi.value.getPanel(id) being correct. 
                     // If we are here, something is desynced. 
                     // Just log and ignore.
                     console.log(`Panel ${id} already exists.`);
                     const p = dockApi.value.getPanel(id);
                     if (p) p.focus();
                 } else {
                     console.warn(`Failed to open panel ${id}`, e);
                 }
             }
        }
    };

    return {
        layoutState,
        saveLayout,
        loadLayout,
        setApi,
        hasSavedLayout,
        resetLayout,
        openPanel
    };
});
