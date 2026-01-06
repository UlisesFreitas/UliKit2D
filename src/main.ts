import { createApp } from 'vue';
import { createPinia } from 'pinia';
import App from './App.vue';
import 'dockview-core/dist/styles/dockview.css'; // Import Dockview styles
import './style.css';

import { setFileSystem } from './api/FileSystem';
import { ElectronFileSystem } from './api/ElectronFileSystem';
import { WebFileSystem } from './api/WebFileSystem';

if ((window as any).electronAPI) {
    setFileSystem(new ElectronFileSystem());
} else {
    setFileSystem(new WebFileSystem());
}

const app = createApp(App);
const pinia = createPinia();
app.use(pinia);
app.mount('#app');

// --- Debug / Test API ---
import { world } from './engine/ecs/ECS';
import { useEditorStore } from './stores/useEditorStore';

(window as any).__TEST_API__ = {
    addEntity: (name: string, texturePath: string) => {
        const entity = world.add({
            id: crypto.randomUUID(),
            name: name,
            transform: { x: 400, y: 300, rotation: 0, scale: { x: 3, y: 3 } }, // Scale 3 for visibility
            sprite: { texture: texturePath }
        });
        console.log('[TEST_API] Added Entity:', entity);
        return entity;
    },
    selectEntity: (id: string) => {
        const store = useEditorStore();
        store.selectEntity(id);
        console.log('[TEST_API] Selected Entity:', id);
    },
    getEntities: () => {
        const entities: any[] = [];
        for (const e of world) entities.push(e);
        return entities;
    },
    addComponent: (id: string, component: string, data: any) => {
        const entity = world.where(e => e.id === id).first;
        if (entity) {
            world.addComponent(entity, component as any, data);
            console.log(`[TEST_API] Added component ${component} to ${id}`);
        }
    },
    reset: () => {
        world.clear();
        console.log('[TEST_API] World cleared');
    }
};

console.log('[TEST_API] Initialized. Access via window.__TEST_API__');
