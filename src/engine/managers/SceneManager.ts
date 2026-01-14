import { world, createEntity, type Entity } from '../ecs/ECS';
import { eventBus } from '../core/EventBus';

export interface SceneLayer {
    id: string; // Unique ID (e.g. "layer-1")
    name: string; // Display Name (e.g. "Background")
    visible: boolean;
    locked: boolean;
    color?: string; // Optional background color
    
    // Integrated Tilemap Data
    type?: 'default' | 'tilemap'; // Future proofing
    tileData?: Record<string, number>; // Sparse map "x,y" -> tileId
    tileset?: string; // Path/URL to texture
    gridSize?: { x: number, y: number };
    isCollision?: boolean; // Defines if this layer generates physics bodies

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
            type: 'default',
            tileData: {},
            gridSize: { x: 32, y: 32 },
            _entityIds: new Set()
        }];
    }

    // ... (getters/setters same) ...

    static get layers() { return this._layers; }
    static get activeSceneName() { return this._activeSceneName; }
    static get isDirty() { return this._isDirty; }

    static setDirty(dirty: boolean) {
        this._isDirty = dirty;
    }

    static getLayerById(id: string): SceneLayer | null {
        return this._layers.find(l => l.id === id) || null;
    }

    static registerEntity(entityId: string, layerId: string) {
        const layer = this.getLayerById(layerId);
        if (layer) {
            layer._entityIds?.add(entityId);
        }
    }

    static unregisterEntity(entityId: string, layerId: string) {
        const layer = this.getLayerById(layerId);
        if (layer) {
            layer._entityIds?.delete(entityId);
        }
    }

    static setLayerGridSize(layerId: string, width: number, height: number) {
        const layer = this.getLayerById(layerId);
        if (layer) {
            layer.gridSize = { x: width, y: height };
            this._isDirty = true;
        }
    }

    static moveEntityToLayer(entityId: string, newLayerId: string) {
        const entity = world.where(e => e.id === entityId).first;
        if (!entity) return;

        const oldLayerId = entity.layer || 'Base Layer';
        if (oldLayerId === newLayerId) return;

        this.unregisterEntity(entityId, oldLayerId);
        entity.layer = newLayerId;
        this.registerEntity(entityId, newLayerId);
        this._isDirty = true;
    }

    static addLayer(name: string) {
        const id = `layer-${crypto.randomUUID()}`;
        this._layers.push({ 
            id, 
            name, 
            visible: true, 
            locked: false,
            type: 'default',
            tileData: {},
            gridSize: { x: 32, y: 32 },
            _entityIds: new Set()
        });
        this._isDirty = true;
        eventBus.emit('layer-update');
        return id;
    }

    static removeLayer(id: string) {
        if (id === 'Base Layer') return;
        const index = this._layers.findIndex(l => l.id === id);
        if (index !== -1) {
            // Move entities to Base Layer
            for (const entity of world) {
                if (entity.layer === id) {
                    entity.layer = 'Base Layer';
                    this.registerEntity(entity.id!, 'Base Layer');
                }
            }
            this._layers.splice(index, 1);
            this._isDirty = true;
            eventBus.emit('layer-update');
        }
    }

    static reorderLayers(newLayers: SceneLayer[]) {
        this._layers = newLayers;
        this._isDirty = true;
        eventBus.emit('layer-update');
    }

    static saveScene(): string {
        const entities: Partial<Entity>[] = [];
        // Iterate all entities
        for (const entity of world) {
            // ... (entity serialization same) ...
             const serializable: Partial<Entity> = {
                 id: entity.id,
                 name: entity.name,
                 layer: entity.layer || 'Base Layer', // Ensure layer is saved
                 visible: entity.visible,
                 transform: entity.transform ? { ...entity.transform } : undefined,
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
        // KEEP tileData, tileset, gridSize
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
                // Restore logic, ensuring defaults for new props
                this._layers = data.layers.map((l: any) => ({ 
                    ...l, 
                    tileData: l.tileData || {}, // Restore or default
                    gridSize: l.gridSize || { x: 32, y: 32 }, 
                    _entityIds: new Set() 
                }));
            }
            // Fallback or Ensure Base Layer exists
            if (!this._layers.find(l => l.id === 'Base Layer')) {
                 this._layers.unshift({ 
                     id: 'Base Layer', 
                     name: 'Base Layer', 
                     visible: true, 
                     locked: false, 
                     color: '#333333', 
                     tileData: {},
                     gridSize: { x: 32, y: 32 },
                     _entityIds: new Set() 
                });
            }
            
            // ... (entity loading same) ...

            
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
                 this._layers = data.layers.map((l: any) => ({ 
                    ...l, 
                    tileData: l.tileData || {}, 
                    gridSize: l.gridSize || { x: 32, y: 32 },
                    _entityIds: new Set() 
                }));
            } else {
                 this._layers = [];
            }
            if (!this._layers.find(l => l.id === 'Base Layer')) {
                 this._layers.unshift({ 
                     id: 'Base Layer', 
                     name: 'Base Layer', 
                     visible: true, 
                     locked: false, 
                     color: '#333333', 
                     tileData: {},
                     gridSize: { x: 32, y: 32 },
                     _entityIds: new Set() 
                });
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
            eventBus.emit('scene-loaded', this._activeSceneName);
            return true;
        } else {
            console.error('SceneManager: Failed to load scene or invalid format', path);
            return false;
        }
    }

    static createDefaultScene() {
        world.clear();
        this._activeSceneName = 'Untitled Scene';
        this._layers = [{ 
            id: 'Base Layer', 
            name: 'Base Layer', 
            visible: true, 
            locked: false, 
            color: '#333333', 
            type: 'default',
            tileData: {},
            gridSize: { x: 32, y: 32 },
            _entityIds: new Set() 
        }];
        
        // createEntity adds it to the world automatically
        const camera = createEntity('Main Camera');
        camera.transform = { x: 0, y: 0, rotation: 0, scale: { x: 1, y: 1 }, zIndex: 0 };
        camera.camera = { zoom: 1, isPrimary: true, backgroundColor: '#333333' };
        
        this.registerEntity(camera.id!, 'Base Layer');
        
        this._isDirty = false;
    }
}
