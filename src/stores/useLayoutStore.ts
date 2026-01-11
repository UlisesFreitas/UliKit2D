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

    const activePanels = ref(new Set<string>());

    const setApi = (api: any) => {
        dockApi.value = api;

        // Track Panel State
        api.onDidAddPanel((e: any) => {
            console.log('Panel Added:', e.id);
            activePanels.value.add(e.id);
        });
        api.onDidRemovePanel((e: any) => {
             console.log('Panel Removed:', e.id);
             activePanels.value.delete(e.id);
        });
        
        // Initialize with currently open panels if any
        if (api.panels) {
            console.log('Initial Panels:', api.panels.map((p:any) => p.id));
            api.panels.forEach((p: any) => activePanels.value.add(p.id));
        }
    };
    
    const isPanelOpen = (id: string) => activePanels.value.has(id);

    const hasSavedLayout = () => {
        return !!localStorage.getItem(LAYOUT_KEY);
    };

    const resetLayout = () => {
        localStorage.removeItem(LAYOUT_KEY);
        window.location.reload();
    };

    const togglePanel = (id: string, title?: string) => {
        if (!dockApi.value) return;
        
        const panel = dockApi.value.panels.find((p: any) => p.id === id);
        
        if (panel && panel.api) {
            panel.api.close();
        } else {
            openPanel(id, title || id);
        }
    };

    const openPanel = (id: string, title: string = 'Panel') => {
        if (!dockApi.value) return;
        
        const panel = dockApi.value.panels.find((p: any) => p.id === id);
        if (panel) {
            panel.focus();
            return;
        }

        let position: any = { direction: 'right' };
            
        switch (id) {
            case 'scenes':
                 position = { direction: 'left' }; 
                 break;
            case 'hierarchy':
                position = { referencePanel: 'scenes', direction: 'below' };
                if (!dockApi.value.getPanel('scenes')) position = { direction: 'left' };
                break;
            case 'assets':
                position = { referencePanel: 'hierarchy', direction: 'below' };
                 if (!dockApi.value.getPanel('hierarchy')) position = { direction: 'left' };
                break;
            case 'console':
                position = { referencePanel: 'scene', direction: 'below' };
                 if (!dockApi.value.getPanel('scene')) position = { direction: 'below' };
                break;
            case 'inspector':
                position = { direction: 'right' };
                break;
            case 'layers':
                position = { referencePanel: 'inspector', direction: 'below' };
                 if (!dockApi.value.getPanel('inspector')) position = { direction: 'right' };
                break;
        }

         try {
             dockApi.value.addPanel({
                 id: id,
                 component: id,
                 title: title,
                 position: position
             });
         } catch(e: any) {
             if (e.message && e.message.includes('already exists')) {
                 console.log(`Panel ${id} already exists.`);
                 const p = dockApi.value.getPanel(id);
                 if (p) p.focus();
             } else {
                 console.warn(`Failed to open panel ${id}`, e);
             }
         }
    };

    return {
        layoutState,
        activePanels,
        saveLayout,
        loadLayout,
        setApi,
        hasSavedLayout,
        resetLayout,
        openPanel,
        togglePanel,
        isPanelOpen
    };
});
