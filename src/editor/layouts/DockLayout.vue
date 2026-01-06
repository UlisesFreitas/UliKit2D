<template>
  <div class="h-full w-full flex flex-col bg-bg-base text-text-primary">
    <!-- Dockview Container -->
    <div ref="container" class="w-full relative flex-1 min-h-0" :class="`dockview-theme-${dockTheme}`"></div>
    <!-- Global Status Bar -->
    <StatusBar />
  </div>
</template>

<script setup lang="ts">
import { ref, onMounted, onUnmounted, createApp, type Component, type App, computed } from 'vue';
import { DockviewComponent, type IContentRenderer, type IDockviewPanelProps } from 'dockview-core';
import { getActivePinia } from 'pinia';
import 'dockview-core/dist/styles/dockview.css';

import ScenePanel from '../panels/ScenePanel.vue';
import InspectorPanel from '../panels/InspectorPanel.vue'; 
import ConsolePanel from '../panels/ConsolePanel.vue';
import AssetsPanel from '../panels/AssetsPanel.vue';
import HierarchyPanel from '../panels/HierarchyPanel.vue';
import StatusBar from '../components/StatusBar.vue';

import { useLayoutStore } from '../../stores/useLayoutStore';
import { ThemeManager } from '../managers/ThemeManager';


const container = ref<HTMLElement | null>(null);
const layoutStore = useLayoutStore();

let api: DockviewComponent | null = null;
const observer = ref<ResizeObserver | null>(null);

import { h, defineComponent } from 'vue';

class VuePanelRenderer implements IContentRenderer {
    private _element: HTMLElement;
    private _app: App | null = null;
    
    private component: Component;
    private props: any;
    
    constructor(component: Component, props: any = {}) {
        this.component = component;
        this.props = props;

        this._element = document.createElement('div');
        this._element.style.height = '100%';
        this._element.style.width = '100%';
        this._element.style.overflow = 'hidden';
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

onMounted(() => {
    if (!container.value) return;

    api = new DockviewComponent(container.value, {
        createComponent: (options: any) => {
            switch (options.name) {
                case 'scene': return new VuePanelRenderer(ScenePanel);
                case 'inspector': return new VuePanelRenderer(InspectorPanel);
                case 'console': return new VuePanelRenderer(ConsolePanel);
                case 'assets': return new VuePanelRenderer(AssetsPanel);
                case 'hierarchy': return new VuePanelRenderer(HierarchyPanel);
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
        // --- Default Layout Construction (Explicit JSON Strategy v15) ---
        // We use a hardcoded JSON schema derived from a successful layout dump,
        // but with corrected 'size' weights to enforce 25% | 50% | 25%.
        // Total Width base: 1460 (365 + 730 + 365)
        
        api.fromJSON({
            grid: {
                root: {
                    type: 'branch',
                    data: [
                        {
                            type: 'branch',
                            data: [
                                { type: 'leaf', data: { views: ['hierarchy'], id: 'group-hierarchy' }, size: 600 },
                                { type: 'leaf', data: { views: ['assets'], id: 'group-assets' }, size: 300 }
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
                            type: 'leaf',
                            data: { views: ['inspector'], id: 'group-inspector' },
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
                'scene': { id: 'scene', title: 'Scene View', component: 'scene', contentComponent: 'scene' },
                'console': { id: 'console', title: 'Console', component: 'console', contentComponent: 'console' },
                'inspector': { id: 'inspector', title: 'Inspector', component: 'inspector', contentComponent: 'inspector' }
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
});


</script>

<style scoped>
.dock-container {
  width: 100%;
  height: 100%;
  overflow: hidden;
}
</style>
