<script setup lang="ts">
import { ref, onMounted, onUnmounted, createApp, type Component, type App, computed, h, defineComponent } from 'vue';
import { DockviewComponent, type IContentRenderer, type IDockviewPanelProps } from 'dockview-core';
import { getActivePinia } from 'pinia';
import 'dockview-core/dist/styles/dockview.css';

import ScenePanel from '../panels/ScenePanel.vue';
import ScenesPanel from '../panels/ScenesPanel.vue'; 
import LayersPanel from '../panels/LayersPanel.vue'; 
import InspectorPanel from '../panels/InspectorPanel.vue'; 
import ConsolePanel from '../panels/ConsolePanel.vue';
import AssetsPanel from '../panels/AssetsPanel.vue';
import HierarchyPanel from '../panels/HierarchyPanel.vue';
import TilemapSettingsPanel from '../panels/TilemapSettingsPanel.vue';
import StatusBar from '../components/StatusBar.vue';

import { useLayoutStore } from '../../stores/useLayoutStore';
import { ThemeManager } from '../managers/ThemeManager';

// IMMORTAL PIXI IMPORTS
import { instance as engine } from '../../engine/core/Engine';
import { instance as gizmoManager } from '../gizmos/GizmoManager';
import { EditorTilemapSystem } from '../systems/EditorTilemapSystem';

const container = ref<HTMLElement | null>(null);
const pixiRoot = ref<HTMLElement | null>(null); // New Root
const layoutStore = useLayoutStore();

let api: DockviewComponent | null = null;
const observer = ref<ResizeObserver | null>(null);

// Global Systems


// --- Helper Classes & Components ---

class VuePanelRenderer implements IContentRenderer {
    private _element: HTMLElement;
    private _app: App | null = null;
    
    private component: Component;
    private props: any;
    
    constructor(component: Component, props: any = {}, className: string = '') {
        this.component = component;
        this.props = props;

        this._element = document.createElement('div');
        this._element.style.height = '100%';
        this._element.style.width = '100%';
        this._element.style.overflow = 'hidden';
        if (className) this._element.classList.add(className);
    }

    get element(): HTMLElement {
        return this._element;
    }

    init(params: IDockviewPanelProps): void {
        this._app = createApp(this.component, { ...this.props, params });
        const pinia = getActivePinia();
        if (pinia) {
            this._app.use(pinia); 
        }
        this._app.mount(this._element);
    }

    dispose(): void {
        this._app?.unmount();
    }

    update(_event: any): void {}
    focus(): void {}
}

const GenericPanel = defineComponent({
    props: ['text'],
    render() {
        return h('div', { 
            style: { 
                height: '100%', 
                color: 'var(--text-primary)', 
                backgroundColor: 'var(--bg-base)',
                padding: '10px' 
            } 
        }, this.text);
    }
});

const dockTheme = computed(() => {
    const type = ThemeManager.currentTheme.value.type;
    return type === 'light' ? 'light' : 'abyss';
});

// --- Lifecycle ---

onMounted(async () => {
    // 1. Initialize Immortal Pixi
    if (pixiRoot.value) {
        (window as any).engine = engine;
        await engine.init(pixiRoot.value);
        
        // Initialize Core Editor Systems that depend on Pixi
        // GizmoManager initializes itself on import/singleton access, but relies on Engine being ready.
        // Since we just called engine.init, it should be fine.
        gizmoManager.init();
        
        new EditorTilemapSystem(engine.app);
        
        // Global Resize Observer for Pixi
        const pixiObserver = new ResizeObserver(() => {
            engine.resize();
        });
        pixiObserver.observe(pixiRoot.value);
    }
    
    // 2. Initialize Dockview (UI)
    if (!container.value) return;

    api = new DockviewComponent(container.value, {
        createComponent: (options: any) => {
            switch (options.name) {
                case 'scene': return new VuePanelRenderer(ScenePanel, {}, 'scene-panel-host');
                case 'scenes': return new VuePanelRenderer(ScenesPanel); // Register 'scenes'
                case 'layers': return new VuePanelRenderer(LayersPanel);
                case 'inspector': return new VuePanelRenderer(InspectorPanel);
                case 'console': return new VuePanelRenderer(ConsolePanel);
                case 'assets': return new VuePanelRenderer(AssetsPanel);
                case 'hierarchy': return new VuePanelRenderer(HierarchyPanel);
                case 'tilemap-settings': return new VuePanelRenderer(TilemapSettingsPanel);
                default: 
                    return new VuePanelRenderer(GenericPanel, { text: `Panel: ${options.id}` });
            }
        }
    });
        
    layoutStore.setApi(api);
    
    // Restore Layout or Default
    const savedLayout = layoutStore.loadLayout();
    if (savedLayout) {
        api.fromJSON(savedLayout);
    } else {
        // Default Layout
        api.fromJSON({
            grid: {
                root: {
                    type: 'branch',
                    data: [
                        {
                            type: 'branch',
                            data: [
                                { type: 'leaf', data: { views: ['scenes'], id: 'group-scenes' }, size: 200 },
                                { type: 'leaf', data: { views: ['hierarchy'], id: 'group-hierarchy' }, size: 500 },
                                { type: 'leaf', data: { views: ['assets'], id: 'group-assets' }, size: 200 }
                            ],
                            size: 365
                        },
                        {
                            type: 'branch',
                            data: [
                                { type: 'leaf', data: { views: ['scene'], id: 'group-scene' }, size: 600 },
                                { type: 'leaf', data: { views: ['console'], id: 'group-console' }, size: 200 }
                            ],
                            size: 730
                        },
                        {
                            type: 'branch',
                            data: [
                                { type: 'leaf', data: { views: ['inspector'], id: 'group-inspector' }, size: 500 },
                                { type: 'leaf', data: { views: ['layers'], id: 'group-layers' }, size: 300 }
                            ],
                            size: 365
                        }
                    ],
                    size: 800
                },
                width: 1460,
                height: 800,
                orientation: 'HORIZONTAL'
            },
            panels: {
                'hierarchy': { id: 'hierarchy', title: 'Hierarchy', component: 'hierarchy', contentComponent: 'hierarchy' },
                'assets': { id: 'assets', title: 'Assets', component: 'assets', contentComponent: 'assets' },
                'scenes': { id: 'scenes', title: 'Scenes', component: 'scenes', contentComponent: 'scenes' },
                'scene': { id: 'scene', title: 'Scene View', component: 'scene', contentComponent: 'scene', params: { closable: false, locked: true } },
                'console': { id: 'console', title: 'Console', component: 'console', contentComponent: 'console' },
                'inspector': { id: 'inspector', title: 'Inspector', component: 'inspector', contentComponent: 'inspector' },
                'layers': { id: 'layers', title: 'Layers', component: 'layers', contentComponent: 'layers' }
            },
            activeGroup: 'group-scene'
        } as any);
    }

    // Auto-save layout on change
    api.onDidLayoutChange(() => {
        if (api) {
            layoutStore.saveLayout(api.toJSON());
        }
    });

    observer.value = new ResizeObserver(() => {
        if (container.value && api) {
             api.layout(container.value.clientWidth, container.value.clientHeight);
        }
    });
    observer.value.observe(container.value);
});

onUnmounted(() => {
    // Cleanup if needed
});

</script>

<template>
  <div class="h-full w-full flex flex-col bg-bg-base text-text-primary relative group">
    <!-- Immortal Pixi Canvas -->
    <div ref="pixiRoot" id="pixi-root" class="absolute inset-0 z-0" style="background-color: var(--bg-base);"></div>

    <!-- Dockview Container (Transparent Background) -->
    <div ref="container" class="w-full relative flex-1 min-h-0 z-10" :class="`dockview-theme-${dockTheme}`"></div>
    <!-- Global Status Bar -->
    <StatusBar class="z-20 relative" style="background-color: var(--bg-header); border-top: 1px solid var(--border-color);" />
  </div>
</template>

<style scoped>
.dock-container {
  width: 100%;
  height: 100%;
  overflow: hidden;
}
</style>
