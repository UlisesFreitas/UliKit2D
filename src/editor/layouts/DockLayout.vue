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
        // --- Default Layout Construction (3 Columns) ---
        
        // 1. Create the 3 base columns first
        const hierarchy = api.addPanel({
            id: 'hierarchy',
            component: 'hierarchy',
            title: 'Hierarchy',
            position: { referencePanel: '', direction: 'left' }
        });
        
        const scene = api.addPanel({
            id: 'scene',
            component: 'scene',
            title: 'Scene View',
            position: { referencePanel: hierarchy, direction: 'right', size: 75 } as any // Hierarchy 25%, Scene 75%
        });
        
        // Inspector (Right)
        api.addPanel({
            id: 'inspector',
            component: 'inspector',
            title: 'Inspector',
            position: { referencePanel: scene, direction: 'right', size: 33.33 } as any // Scene 50%, Inspector 25% (33% of 75)
        });

        // 2. Split the columns vertically
        // Add Assets below Hierarchy (Col 1)
        api.addPanel({
            id: 'assets',
            component: 'assets',
            title: 'Assets',
            position: { referencePanel: hierarchy, direction: 'below' }
        });
        
        // Add Console below Scene (Col 2)
        api.addPanel({
            id: 'console',
            component: 'console',
            title: 'Console',
            position: { referencePanel: scene, direction: 'below', size: 25 } as any
        });
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
