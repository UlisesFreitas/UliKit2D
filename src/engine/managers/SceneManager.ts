import { world, createEntity, type Entity } from '../ecs/ECS';

export interface SceneLayer {
    id: string; // Unique ID (e.g. "layer-1")
    name: string; // Display Name (e.g. "Background")
    visible: boolean;
    locked: boolean;
    color?: string; // Optional background color (only for Base Layer usually)
    // Runtime Registry (Not serialized directly, rebuilt on load)
    _entityIds?: Set<string>; 
}

export class SceneManager {
    private static _activeSceneName: string = 'Untitled Scene';
    private static _isDirty: boolean = false;
    private static _layers: SceneLayer[] = [];

    // Initialize with Base Layer
    static {
        this._layers = [{ 
            id: 'Base Layer', 
            name: 'Base Layer', 
            visible: true, 
            locked: false, 
            color: '#333333',
            _entityIds: new Set()
        }];
    }

    static get activeSceneName() { return this._activeSceneName; }
    static set activeSceneName(v: string) { this._activeSceneName = v; }
    static get isDirty() { return this._isDirty; }
    static get layers() { return this._layers; }
    static set layers(v: SceneLayer[]) { 
        this._layers = v; 
        // Ensure sets exist
        this._layers.forEach(l => {
             if (!l._entityIds) l._entityIds = new Set();
        });
    }

    static setDirty(dirty: boolean) { this._isDirty = dirty; }

    /**
     * Registry Management
     */
    static getLayerById(layerId: string): SceneLayer | undefined {
        return this._layers.find(l => l.id === layerId);
    }

    static registerEntity(entityId: string, layerId: string) {
        let layer = this.getLayerById(layerId);
        if (!layer) {
            // Fallback to Base Layer if layer doesn't exist
            layer = this.getLayerById('Base Layer');
        }
        if (layer) {
            if (!layer._entityIds) layer._entityIds = new Set();
            layer._entityIds.add(entityId);
        }
    }

    static unregisterEntity(entityId: string, layerId: string) {
        const layer = this.getLayerById(layerId);
        if (layer && layer._entityIds) {
            layer._entityIds.delete(entityId);
        }
    }

    static moveEntityToLayer(entityId: string, targetLayerId: string) {
        // 1. Find Entity (We need the entity component to know previous layer)
        // Since we are moving, we might know the previous layer from ECS.
        // But ECS query is expensive? 
        // We can search all layers or trust the ECS 'layer' property.
        
        // Find existing record in ECS (assuming we can get it by ID or we just search)
        // Miniplex doesn't have fast ID lookup unless we index.
        // We'll iterate world for now (optimize later with EntityMap).
        let entity: Entity | undefined;
        for (const e of world) {
            if (e.id === entityId) {
                entity = e;
                break;
            }
        }

        if (!entity) return;

        const oldLayerId = entity.layer || 'Base Layer';
        
        // Unregister from old
        this.unregisterEntity(entityId, oldLayerId);

        // Update ECS
        entity.layer = targetLayerId;

        // Register to new
        this.registerEntity(entityId, targetLayerId);

        this._isDirty = true;
    }


    static addLayer(name: string) {
        const id = `layer-${crypto.randomUUID()}`;
        this._layers.push({ 
            id, 
            name, 
            visible: true, 
            locked: false,
            _entityIds: new Set()
        });
        this._isDirty = true;
        return id;
    }

    static removeLayer(id: string) {
        if (id === 'Base Layer') return; // Cannot delete Base Layer
        const index = this._layers.findIndex(l => l.id === id);
        if (index > -1) {
             const layerToRemove = this._layers[index];
             if (layerToRemove) {
                 this._layers.splice(index, 1);
                 
                 // Move entities in this layer to Base Layer
                 if (layerToRemove._entityIds) {
                     for (const entityId of layerToRemove._entityIds) {
                         this.moveEntityToLayer(entityId, 'Base Layer');
                     }
                 }
             }

             // Also clean sweep ECS just in case registry was desynced
             for (const entity of world) {
                 if (entity.layer === id) {
                     entity.layer = 'Base Layer';
                     this.registerEntity(entity.id!, 'Base Layer');
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
                     scale: { ...entity.transform.scale },
                     zIndex: entity.transform.zIndex || 0
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
        
        // Save both entities and layers (EXCLUDE _entityIds)
        const layersToSave = this._layers.map(l => {
            const { _entityIds, ...rest } = l;
            return rest;
        });

        return JSON.stringify({
            layers: layersToSave,
            entities: entities
        }, null, 2);
    }

    static loadScene(json: string, name: string = 'Untitled Scene') {
        world.clear();
        this._activeSceneName = name;
        this._layers = []; // Clear current
        
        try {
            const data = JSON.parse(json);
            
            // 1. Load Layers
            if (data.layers) {
                this._layers = data.layers.map((l: any) => ({ ...l, _entityIds: new Set() }));
            }
            // Fallback or Ensure Base Layer exists
            if (!this._layers.find(l => l.id === 'Base Layer')) {
                 this._layers.unshift({ id: 'Base Layer', name: 'Base Layer', visible: true, locked: false, color: '#333333', _entityIds: new Set() });
            }
            
            // 2. Load Entities & Build Registry
            const loadedEntities = Array.isArray(data) ? data : (data.entities || []);
            
            for (const entity of loadedEntities) {
                // Fix missing layer
                if (!entity.layer) entity.layer = 'Base Layer';
                
                // Add to World
                world.add(entity);
                
                // Register
                this.registerEntity(entity.id!, entity.layer);
            }

        } catch (e) {
            console.error('Failed to parse scene JSON', e);
            // Emergency Recovery
             this._layers = [{ id: 'Base Layer', name: 'Base Layer', visible: true, locked: false, color: '#333333', _entityIds: new Set() }];
        }

        this._isDirty = false;
    }

    static async loadSceneFromFile(path: string) {
        // Dynamic import to avoid circular dependency
        const { resourceManager } = await import('../resources/ResourceManager');
        
        const data = await resourceManager.loadJSON(path);
        
        if (data) {
            // Reset logic similar to loadScene but using the object directly
            world.clear();
            const filename = path.split(/[/\\]/).pop() || 'Loaded Scene';
            this._activeSceneName = filename.replace('.json', '');

            // 1. Layers
            if (!Array.isArray(data) && data.layers) {
                 this._layers = data.layers.map((l: any) => ({ ...l, _entityIds: new Set() }));
            } else {
                 this._layers = [];
            }
            if (!this._layers.find(l => l.id === 'Base Layer')) {
                 this._layers.unshift({ id: 'Base Layer', name: 'Base Layer', visible: true, locked: false, color: '#333333', _entityIds: new Set() });
            }

            // 2. Entities
            const entities = Array.isArray(data) ? data : (data.entities || []);
            for (const entity of entities) {
                 if (!entity.layer) entity.layer = 'Base Layer';
                 world.add(entity);
                 this.registerEntity(entity.id!, entity.layer);
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
        this._layers = [{ id: 'Base Layer', name: 'Base Layer', visible: true, locked: false, color: '#333333', _entityIds: new Set() }];
        
        // createEntity adds it to the world automatically
        const camera = createEntity('Main Camera');
        camera.transform = { x: 0, y: 0, rotation: 0, scale: { x: 1, y: 1 }, zIndex: 0 };
        camera.camera = { zoom: 1, isPrimary: true, backgroundColor: '#333333' };
        
        this.registerEntity(camera.id!, 'Base Layer');
        
        this._isDirty = false;
    }
}
