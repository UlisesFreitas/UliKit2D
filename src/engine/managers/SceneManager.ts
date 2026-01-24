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
    isCollision?: boolean;
    
    // Unity-Style Index (0-31)
    layerIndex?: number;

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
    static set activeSceneName(value: string) { this._activeSceneName = value; }
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
                 circleCollider: entity.circleCollider ? { ...entity.circleCollider } : undefined,
                 audioSource: entity.audioSource ? { ...entity.audioSource } : undefined,
                 label: entity.label ? { ...entity.label } : undefined,
                 bitmapText: entity.bitmapText ? { ...entity.bitmapText } : undefined,
                 nineSliceSprite: entity.nineSliceSprite ? { ...entity.nineSliceSprite } : undefined,
                 characterController: entity.characterController ? { ...entity.characterController } : undefined,
                 polygonCollider: entity.polygonCollider ? { ...entity.polygonCollider } : undefined,
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

    static loadScene(dataOrJson: string | any, name: string = 'Untitled Scene') {
        eventBus.emit('scene-cleared'); // Notify UI to clear immediately
        world.clear();
        this._activeSceneName = name;
        this._layers = []; // Clear current
        
        try {
            const data = typeof dataOrJson === 'string' ? JSON.parse(dataOrJson) : dataOrJson;
            
            // 1. Load Layers
            if (data.layers) {
                // Restore logic, ensuring defaults for new props
                this._layers = data.layers.map((l: any) => {
                    const globalIndex = SceneManager.getLayerIndex(l.name);
                    return { 
                        ...l, 
                        tileData: l.tileData || {}, 
                        gridSize: l.gridSize || { x: 32, y: 32 }, 
                        layerIndex: globalIndex !== -1 ? globalIndex : 0,
                        _entityIds: new Set() 
                    };
                });
            }
            
            // ... (Fallback ensure Base Layer omitted for brevity, implied same logic if needed)

            // 2. Load Entities & Build Registry
            const loadedEntities = Array.isArray(data) ? data : (data.entities || []);
            
            for (const entity of loadedEntities) {
                // Legacy Fix: Missing layer
                if (!entity.layer) entity.layer = 'Base Layer';
                
                // MIGRATION: Resolve Layer UUID/Name to Global Index
                let targetLayerIndex = 0;
                
                // A. Try finding by ID (UUID match) in loaded local layers
                const localLayer = this._layers.find(l => l.id === entity.layer);
                if (localLayer && localLayer.layerIndex !== undefined) {
                    targetLayerIndex = localLayer.layerIndex;
                } else {
                    // B. Try finding by Name (if entity.layer was actually a name)
                   const byName = SceneManager.getLayerIndex(entity.layer);
                    if (byName !== -1) targetLayerIndex = byName;
                     else {
                         // C. Fallback: Base Layer name lookup
                         const baseIndex = SceneManager.getLayerIndex('Base Layer');
                         if (baseIndex !== -1) targetLayerIndex = baseIndex;
                     }
                }

                // Set Runtime Property
                (entity as any).layerIndex = targetLayerIndex;

                // Add to World
                world.add(entity);
                this.registerEntity(entity.id!, entity.layer);
            }

        } catch (e) {
            console.error('Failed to parse scene JSON', e);
            // Emergency Recovery
             this._layers = [{ id: 'Base Layer', name: 'Base Layer', visible: true, locked: false, color: '#333333', _entityIds: new Set() }];
        }

        this._isDirty = false;
        // Emit event for Runtime/UI to know scene changed immediately after synchronous load
        eventBus.emit('scene-loaded', this._activeSceneName);
    }

    /**
     * Runtime API to load a scene by its project-relative path.
     * e.g. "assets/scenes/Level1.json"
     */
    static async loadSceneByPath(path: string) {
        eventBus.emit('scene-change-start', path);
        
        try {
            // Dynamic import to avoid circular dependency
            const { resourceManager } = await import('../resources/ResourceManager');
            
            const data = await resourceManager.loadJSON(path);
            
            if (data) {
                const filename = path.split(/[/\\]/).pop() || 'Loaded Scene';
                const name = filename.replace('.json', '');
                
                this.loadScene(data, name);
                
                console.log(`[SceneManager] Scene loaded from ${path}`);
                return true;
            } else {
                console.error('[SceneManager] Failed to load scene: Invalid Data', path);
                return false;
            }
        } catch (e) {
            console.error('[SceneManager] Failed to load scene by path', path, e);
            return false;
        }
    }

    /**
     * @deprecated Use loadSceneByPath
     */
    static async loadSceneFromFile(path: string) {
        return this.loadSceneByPath(path);
    }

    static setProjectLayers(layerNames: string[]) {
        this._projectLayerTemplates = layerNames;
    }

    static getLayerIndex(name: string): number {
        // Case-insensitive lookup in project templates
        return this._projectLayerTemplates.findIndex(l => l && l.toLowerCase() === name.toLowerCase());
    }

    static getLayerName(index: number): string {
        return this._projectLayerTemplates[index] || 'Default';
    }

    private static _projectLayerTemplates: string[] = [];

    static createDefaultScene() {
        eventBus.emit('scene-cleared');
        world.clear();
        
        this._activeSceneName = 'Untitled Scene';
        this._layers = [];

        // Use Project Layer Templates if available
        if (this._projectLayerTemplates.length > 0) {
            this._layers = this._projectLayerTemplates.map((name, index) => {
                 // Use UUIDs for robustness, but could use name as ID if unique
                 const isBase = index === 0; // First layer is effectively base
                 return {
                    id: isBase ? 'Base Layer' : `layer-${crypto.randomUUID()}`, // Keep 'Base Layer' ID for compatibility if it's the first one? Or just map named layers.
                    // Actually, let's keep 'Base Layer' ID for the *first* layer to maintain internal logic that relies on it (like locking/color)
                    // Or better: First layer from settings is bottom-most.
                    name: name,
                    visible: true,
                    locked: false,
                    color: isBase ? '#333333' : undefined,
                    type: 'default',
                    tileData: {},
                    gridSize: { x: 32, y: 32 },
                    _entityIds: new Set()
                 };
            });
        } else {
            // Fallback default
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

        // Create Main Camera
        const camera = createEntity();
        camera.name = 'Main Camera';
        camera.transform = { x: 0, y: 0, rotation: 0, scale: { x: 1, y: 1 }, zIndex: 0 };
        camera.camera = { zoom: 1, isPrimary: true, backgroundColor: '#333333' };
        
        // Register to first layer
        const firstLayerId = this._layers[0]?.id || 'Base Layer';
        this.registerEntity(camera.id, firstLayerId);
                
        this._isDirty = false;
        eventBus.emit('scene-loaded', this._activeSceneName);
        console.log('[SceneManager] Created default memory scene (Untitled)');
    }
}
