import { defineStore } from 'pinia';
import { ref } from 'vue';
import { useProjectSettingsStore } from './useProjectSettingsStore';
import { ProjectSettingsManager } from '../editor/managers/ProjectSettingsManager';

const LAYOUT_KEY = 'editor-layout-v16';
const LAYOUT_KEY_CUSTOM = 'editor-layout-custom';

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
    
    // Custom User Layout Actions (Quick Save)
    const saveCustomLayout = () => {
        if (dockApi.value) {
            const json = dockApi.value.toJSON();
            localStorage.setItem(LAYOUT_KEY_CUSTOM, JSON.stringify(json));
            alert('Custom Layout Saved (Quick)');
        }
    };

    const restoreCustomLayout = () => {
        const saved = localStorage.getItem(LAYOUT_KEY_CUSTOM);
        if (saved && dockApi.value) {
            try {
                dockApi.value.fromJSON(JSON.parse(saved));
            } catch (e) {
                alert('Failed to load custom layout');
            }
        } else {
             alert('No Quick Layout saved. Use "Save Layout" first.');
        }
    };

    // Named Layouts (Project Settings)
    const saveNamedLayout = async (name: string) => {
        if (!dockApi.value) return;
        const projectStore = useProjectSettingsStore();
        
        const json = dockApi.value.toJSON();
        // Ensure layouts object exists (migration safety)
        if (!projectStore.settings.layouts) projectStore.settings.layouts = {};
        
        projectStore.settings.layouts[name] = json;
        
        // Persist immediately
        await ProjectSettingsManager.saveSettings();
    };

    const restoreNamedLayout = (name: string) => {
        const projectStore = useProjectSettingsStore();
        if (!projectStore.settings.layouts) return;

        const json = projectStore.settings.layouts[name];
        
        if (json && dockApi.value) {
            try {
                dockApi.value.fromJSON(json);
            } catch (e) {
                console.error(`Failed to restore layout ${name}`, e);
            }
        }
    };

    const deleteNamedLayout = async (name: string) => {
        const projectStore = useProjectSettingsStore();
        if (projectStore.settings.layouts && projectStore.settings.layouts[name]) {
            delete projectStore.settings.layouts[name];
            await ProjectSettingsManager.saveSettings();
        }
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

    const resetToDefault = () => {
        localStorage.removeItem(LAYOUT_KEY);
        // Reload to apply
        window.location.reload();
    };

    const togglePanel = (id: string, title?: string) => {
        if (!dockApi.value) return;
        
        const panel = dockApi.value.getPanel(id);
        
        if (panel) {
            panel.api.close();
        } else {
            openPanel(id, title || id);
        }
    };

    const openPanel = (id: string, title: string = 'Panel') => {
        if (!dockApi.value) return;
        
        const panel = dockApi.value.getPanel(id);
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
            case 'scene':
                position = { referencePanel: 'console', direction: 'above' };
                if (!dockApi.value.getPanel('console')) {
                     const inspector = dockApi.value.getPanel('inspector');
                     if (inspector) position = { referencePanel: 'inspector', direction: 'left' };
                }
                break;
            case 'inspector':
                position = { direction: 'right' };
                break;
            case 'layers':
                position = { referencePanel: 'inspector', direction: 'below' };
                 if (!dockApi.value.getPanel('inspector')) position = { direction: 'right' };
                break;
            case 'history':
                position = { referencePanel: 'layers', direction: 'within' };
                if (!dockApi.value.getPanel('layers')) {
                     const inspector = dockApi.value.getPanel('inspector');
                     if (inspector) position = { referencePanel: 'inspector', direction: 'below' };
                     else position = { direction: 'right' };
                }
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
        saveCustomLayout,
        restoreCustomLayout,
        saveNamedLayout,
        restoreNamedLayout,
        deleteNamedLayout,
        resetToDefault,
        openPanel,
        togglePanel,
        isPanelOpen
    };
});
