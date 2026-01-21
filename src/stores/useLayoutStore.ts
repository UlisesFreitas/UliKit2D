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
        
        const panel = dockApi.value.panels.find((p: any) => p.id === id);
        
        if (panel) {
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
                if (dockApi.value.panels.find((p: any) => p.id === 'scenes')) {
                     position = { referencePanel: 'scenes', direction: 'below' };
                } else {
                     position = { direction: 'left' };
                }
                break;
            case 'assets':
                if (dockApi.value.panels.find((p: any) => p.id === 'hierarchy')) {
                    position = { referencePanel: 'hierarchy', direction: 'below' };
                } else {
                    position = { direction: 'left' };
                }
                break;
            case 'console':
                if (dockApi.value.panels.find((p: any) => p.id === 'scene')) {
                    position = { referencePanel: 'scene', direction: 'below' };
                } else {
                    position = { direction: 'below' }; // Fallback to root or active
                }
                break;
            case 'scene':
                if (dockApi.value.panels.find((p: any) => p.id === 'console')) {
                    position = { referencePanel: 'console', direction: 'above' };
                } else if (dockApi.value.panels.find((p: any) => p.id === 'inspector')) {
                     position = { referencePanel: 'inspector', direction: 'left' };
                } else {
                     position = { direction: 'right' };
                }
                break;
            case 'inspector':
                position = { direction: 'right' };
                break;
            case 'layers':
                if (dockApi.value.panels.find((p: any) => p.id === 'inspector')) {
                    position = { referencePanel: 'inspector', direction: 'below' };
                } else {
                    position = { direction: 'right' };
                }
                break;
            case 'history':
                // Try layers first, then inspector
                if (dockApi.value.panels.find((p: any) => p.id === 'layers')) {
                    position = { referencePanel: 'layers', direction: 'within' };
                } else if (dockApi.value.panels.find((p: any) => p.id === 'inspector')) {
                     position = { referencePanel: 'inspector', direction: 'below' };
                } else {
                     position = { direction: 'right' };
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
