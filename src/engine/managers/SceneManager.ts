import { world, createEntity, type Entity } from '../ecs/ECS';

export interface SceneLayer {
    id: string; // Unique ID (e.g. "layer-1")
    name: string; // Display Name (e.g. "Background")
    visible: boolean;
    locked: boolean;
    color?: string; // Optional background color (only for Base Layer usually)
}

export class SceneManager {
    private static _activeSceneName: string = 'Untitled Scene';
    private static _isDirty: boolean = false;
    private static _layers: SceneLayer[] = [];

    // Initialize with Base Layer
    static {
        this._layers = [{ id: 'Base Layer', name: 'Base Layer', visible: true, locked: false, color: '#333333' }];
    }

    static get activeSceneName() { return this._activeSceneName; }
    static set activeSceneName(v: string) { this._activeSceneName = v; }
    static get isDirty() { return this._isDirty; }
    static get layers() { return this._layers; }
    static set layers(v: SceneLayer[]) { this._layers = v; }

    static setDirty(dirty: boolean) { this._isDirty = dirty; }

    static addLayer(name: string) {
        const id = `layer-${crypto.randomUUID()}`;
        this._layers.push({ id, name, visible: true, locked: false });
        this._isDirty = true;
        return id;
    }

    static removeLayer(id: string) {
        if (id === 'Base Layer') return; // Cannot delete Base Layer
        const index = this._layers.findIndex(l => l.id === id);
        if (index > -1) {
             this._layers.splice(index, 1);
             // Move entities in this layer to Base Layer? Or Delete?
             // GDevelop moves them to base or deletes. Let's move to Base Layer for safety.
             for (const entity of world) {
                 if (entity.layer === id) {
                     entity.layer = 'Base Layer';
                 }
             }
             this._isDirty = true;
        }
    }

    static reorderLayers(newOrder: SceneLayer[]) {
        this._layers = newOrder;
        this._isDirty = true;
    }

    static saveScene(): string {
        const entities: Partial<Entity>[] = [];
        // Iterate all entities
        for (const entity of world) {
            // Create a serialize-safe deep copy
            const serializable: Partial<Entity> = {
                 id: entity.id,
                 name: entity.name,
                 layer: entity.layer || 'Base Layer', // Ensure layer is saved
                 visible: entity.visible,
                 // Deep clone transform to prevent reference mutation issues
                 transform: entity.transform ? {
                     x: entity.transform.x,
                     y: entity.transform.y,
                     rotation: entity.transform.rotation,
                     scale: { ...entity.transform.scale }
                 } : undefined,
                 sprite: entity.sprite ? { ...entity.sprite } : undefined,
                 camera: entity.camera ? { ...entity.camera } : undefined,
                 rigidBody: entity.rigidBody ? { ...entity.rigidBody } : undefined,
                 boxCollider: entity.boxCollider ? { ...entity.boxCollider } : undefined,
                 audioSource: entity.audioSource ? { ...entity.audioSource } : undefined,
                 label: entity.label ? { ...entity.label } : undefined,
                 bitmapText: entity.bitmapText ? { ...entity.bitmapText } : undefined,
                 nineSliceSprite: entity.nineSliceSprite ? { ...entity.nineSliceSprite } : undefined,
                 animator: entity.animator ? JSON.parse(JSON.stringify(entity.animator)) : undefined,
                 script: entity.script ? (Array.isArray(entity.script) ? entity.script.map(s => ({...s})) : []) : undefined
            };
             entities.push(serializable);
        }
        this._isDirty = false;
        
        // Save both entities and layers
        return JSON.stringify({
            layers: this._layers,
            entities: entities
        }, null, 2);
    }

    static loadScene(json: string, name: string = 'Untitled Scene') {
        world.clear();
        this._activeSceneName = name;
        
        try {
            const data = JSON.parse(json);
            
            // Handle Old Format (Array of Entities) vs New Format { layers, entities }
            if (Array.isArray(data)) {
                 // Migrate old format
                 this._layers = [{ id: 'Base Layer', name: 'Base Layer', visible: true, locked: false, color: '#333333' }];
                 for (const entity of data) {
                     // Assign default layer if missing
                     if (!entity.layer) entity.layer = 'Base Layer';
                     world.add(entity);
                 }
            } else {
                // New Format
                if (data.layers) {
                    this._layers = data.layers;
                } else {
                     this._layers = [{ id: 'Base Layer', name: 'Base Layer', visible: true, locked: false, color: '#333333' }];
                }
                
                if (data.entities && Array.isArray(data.entities)) {
                    for (const entity of data.entities) {
                        if (!entity.layer) entity.layer = 'Base Layer';
                        world.add(entity);
                    }
                }
            }
        } catch (e) {
            console.error('Failed to parse scene JSON', e);
        }

        this._isDirty = false;
    }

    static async loadSceneFromFile(path: string) {
        // Dynamic import to avoid circular dependency if possible, or just use registered global
        // But better to use the ResourceManager singleton
        const { resourceManager } = await import('../resources/ResourceManager');
        
        const data = await resourceManager.loadJSON(path);
        
        if (data) {
            world.clear();
            const filename = path.split(/[/\\]/).pop() || 'Loaded Scene';
            this._activeSceneName = filename.replace('.json', '');

            // Check format (Array vs Object)
            if (Array.isArray(data)) {
                 // MIGRATION: Old format
                 this._layers = [{ id: 'Base Layer', name: 'Base Layer', visible: true, locked: false, color: '#333333' }];
                 for (const entity of data) {
                      if (!entity.layer) entity.layer = 'Base Layer';
                      world.add(entity);
                 }
            } else {
                // New Format
                if (data.layers) this._layers = data.layers;
                else this._layers = [{ id: 'Base Layer', name: 'Base Layer', visible: true, locked: false, color: '#333333' }];
                
                if (data.entities) {
                    for (const entity of data.entities) {
                        if (!entity.layer) entity.layer = 'Base Layer';
                        world.add(entity);
                    }
                }
            }
            this._isDirty = false;
            console.log(`Scene loaded from ${path}`);
            return true;
        } else {
            console.error('SceneManager: Failed to load scene or invalid format', path);
            return false;
        }
    }

    static createDefaultScene() {
        world.clear();
        this._activeSceneName = 'Untitled Scene';
        this._layers = [{ id: 'Base Layer', name: 'Base Layer', visible: true, locked: false, color: '#333333' }];
        
        // createEntity adds it to the world automatically
        const camera = createEntity('Main Camera');
        camera.transform = { x: 0, y: 0, rotation: 0, scale: { x: 1, y: 1 } };
        camera.camera = { zoom: 1, isPrimary: true, backgroundColor: '#333333' };
        
        // Just a camera for now
        this._isDirty = false;
    }
}
