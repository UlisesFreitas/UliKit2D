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

export interface ProjectLayerConfig {
    name: string;
    type: 'default' | 'tilemap';
    gridSize?: { x: number, y: number };
    tileset?: string;
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
    static set activeSceneName(value: string) { 
        if (this._activeSceneName !== value) {
            this._activeSceneName = value; 
            eventBus.emit('active-scene-changed', value);
        }
    }
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
                 sortIndex: entity.sortIndex,
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
        console.log(`[SceneManager] loadScene called. Templates available: ${this._projectLayerTemplates.length}`, this._projectLayerTemplates);
        eventBus.emit('scene-cleared');
        world.clear();
        this._activeSceneName = name;
        
        try {
            const data = typeof dataOrJson === 'string' ? JSON.parse(dataOrJson) : dataOrJson;
            
            // 1. Initialize Layers
            // We must reconcile Saved Data (scene.json) with Project Settings (project.json Templates).
            this._layers = [];

            if (this._projectLayerTemplates.length > 0) {
                this._layers = this._projectLayerTemplates.map((config, index) => {
                    // Try Exact Name Match first
                    let savedLayer = data.layers?.find((l: any) => l.name === config.name);
                    
                    // Fallback: If not found by name, try matching by Index 
                    if (!savedLayer && data.layers && data.layers[index]) {
                         const candidate = data.layers[index];
                         const isCandidateNameInTemplates = this._projectLayerTemplates.some(t => t.name === candidate.name);
                         
                         // If candidate name is NOT in templates, assume it's the old name for this index
                         if (!isCandidateNameInTemplates) {
                             savedLayer = candidate;
                             console.log(`[SceneManager] Layer Rename Detected: "${candidate.name}" -> "${config.name}"`);
                         }
                    }

                    const isBase = (config.name === 'Base Layer' || index === 0);

                    return {
                        id: savedLayer?.id || (isBase ? 'Base Layer' : `layer-sys-${index}-${crypto.randomUUID().split('-')[0]}`),
                        name: config.name, // Always enforce Template Name
                        visible: savedLayer?.visible ?? true,
                        locked: savedLayer?.locked ?? false,
                        color: savedLayer?.color || (isBase ? '#333333' : undefined),
                        type: config.type || savedLayer?.type || 'default', 
                        tileData: savedLayer?.tileData || {},
                        tileset: savedLayer?.tileset, // Restore tileset
                        gridSize: config.gridSize || savedLayer?.gridSize || { x: 32, y: 32 },
                        isCollision: savedLayer?.isCollision ?? false, // Restore collision
                        _entityIds: new Set(),
                        layerIndex: index
                     };
                });
            } else {
                 // Fallback: Trust Saved Data completely if no templates
                 this._layers = (data.layers || []).map((l: any, index: number) => ({
                    ...l,
                    _entityIds: new Set(),
                    layerIndex: l.layerIndex ?? index
                }));

                // Ensure Base Layer structure if missing
                if (this._layers.length === 0) {
                     this._layers.push({ 
                        id: 'Base Layer', name: 'Base Layer', visible: true, locked: false, color: '#333333', 
                        type: 'default', tileData: {}, gridSize: { x: 32, y: 32 }, _entityIds: new Set(), layerIndex: 0 
                    });
                }
            }

            // 2. Load Entities & Build Registry
            const loadedEntities = Array.isArray(data) ? data : (data.entities || []);
            
            for (const entity of loadedEntities) {
                if (!entity.layer) entity.layer = 'Base Layer';
                
                // Resolve Layer
                let targetLayerIndex = 0;
                
                // A. Try finding by ID
                const localLayer = this._layers.find(l => l.id === entity.layer);
                if (localLayer && localLayer.layerIndex !== undefined) {
                    targetLayerIndex = localLayer.layerIndex;
                } else {
                    // B. Try finding by Name
                    const byName = this._layers.find(l => l.name === entity.layer);
                    if (byName && byName.layerIndex !== undefined) {
                        targetLayerIndex = byName.layerIndex;
                        entity.layer = byName.id;
                    }
                    else {
                         // C. Fallback: Base Layer
                         const baseLayer = this._layers[0] || this._layers.find(l => l.id === 'Base Layer');
                         if (baseLayer) {
                             targetLayerIndex = 0;
                             entity.layer = baseLayer.id;
                         }
                     }
                }

                (entity as any).layerIndex = targetLayerIndex;
                world.add(entity);
                this.registerEntity(entity.id!, entity.layer);
            }

        } catch (e) {
            console.error('Failed to parse scene JSON', e);
             this._layers = [{ id: 'Base Layer', name: 'Base Layer', visible: true, locked: false, color: '#333333', _entityIds: new Set(), layerIndex: 0 }];
        }
        
        // Finalize
        this.syncLayersWithTemplates();
        
        this._isDirty = false;
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
            console.error('[SceneManager] Error loading scene:', e);
            return false;
        }
    }

    /**
     * Alias for loadSceneByPath to support Editor UI calls.
     */
    static async loadSceneFromFile(path: string) {
        return this.loadSceneByPath(path);
    }

    static setProjectLayers(layers: ProjectLayerConfig[]) {
        console.log('[SceneManager] setProjectLayers called with:', layers);
        this._projectLayerTemplates = layers;
        this.syncLayersWithTemplates();
    }


    /**
     * Synchronizes the active scene's layers with the Project Settings templates.
     * Ensures that layers defined in Settings exist in the Scene and have correct names.
     */
    private static syncLayersWithTemplates() {
        if (!this._projectLayerTemplates.length) return;

        let changed = false;

        // 0. Cleanup: Remove Runtime Layers that are NO LONGER in Templates
        // Logic: Iterate backwards, check if matches any config name
        // (Actually, relying on Pass 4 matches below)
       
        const claimedRuntimeIds = new Set<string>();
        const claimedTemplateIndices = new Set<number>();

        // Pass 1: Exact Match (Index AND Name)
        this._projectLayerTemplates.forEach((config, index) => {
            if (!config) return;
            const runtimeLayer = this._layers.find(l => l.layerIndex === index && l.name === config.name);
            if (runtimeLayer) {
                // Sync properties
                if (runtimeLayer.type !== config.type) {
                    runtimeLayer.type = config.type;
                    changed = true;
                }
                if (config.gridSize && (!runtimeLayer.gridSize || runtimeLayer.gridSize.x !== config.gridSize.x)) {
                     runtimeLayer.gridSize = config.gridSize;
                     changed = true;
                }
                
                claimedRuntimeIds.add(runtimeLayer.id);
                claimedTemplateIndices.add(index);
            }
        });

        // Pass 2: Name Match (Index mismatch) -> Move Runtime Layer
        this._projectLayerTemplates.forEach((config, index) => {
            if (!config) return;
            if (claimedTemplateIndices.has(index)) return;

            const runtimeLayer = this._layers.find(l => l.name === config.name && !claimedRuntimeIds.has(l.id));
            if (runtimeLayer) {
                runtimeLayer.layerIndex = index;
                runtimeLayer.type = config.type;
                if (config.gridSize) runtimeLayer.gridSize = config.gridSize;
                
                claimedRuntimeIds.add(runtimeLayer.id);
                claimedTemplateIndices.add(index);
                changed = true;
            }
        });

        // Pass 3: Index Match (Name mismatch) -> Rename
        this._projectLayerTemplates.forEach((config, index) => {
            if (!config) return;
            if (claimedTemplateIndices.has(index)) return;

            const runtimeLayer = this._layers.find(l => l.layerIndex === index && !claimedRuntimeIds.has(l.id));
            if (runtimeLayer) {
                runtimeLayer.name = config.name;
                runtimeLayer.type = config.type;
                if (config.gridSize) runtimeLayer.gridSize = config.gridSize;
                
                claimedRuntimeIds.add(runtimeLayer.id);
                claimedTemplateIndices.add(index);
                changed = true;
            }
        });

        // Pass 4: Create Missing Runtime Layers
        this._projectLayerTemplates.forEach((config, index) => {
             if (claimedTemplateIndices.has(index)) return;
             
             // Create new
             const newLayer: SceneLayer = {
                 id: config.name === 'Base Layer' ? 'Base Layer' : `layer-sys-${index}-${crypto.randomUUID().split('-')[0]}`,
                 name: config.name,
                 visible: true,
                 locked: false,
                 type: config.type,
                 gridSize: config.gridSize || { x: 32, y: 32 },
                 _entityIds: new Set(),
                 layerIndex: index,
                 isCollision: false,
             };
             this._layers.push(newLayer);
             
             // CRITICAL FIX: Mark as claimed so Pass 5 doesn't remove it
             claimedRuntimeIds.add(newLayer.id);
             changed = true;
        });

        // Pass 5: Remove Unclaimed Runtime Layers (Cleanup)
        for (let i = this._layers.length - 1; i >= 0; i--) {
             const layer = this._layers[i];
             if (layer && !claimedRuntimeIds.has(layer.id) && layer.id !== 'Base Layer') {
                 this._layers.splice(i, 1);
                 changed = true;
             }
        }

        // CRITICAL FIX: Sort layers by layerIndex to ensure RenderSystem (and UI) z-index is correct
        this._layers.sort((a, b) => (a.layerIndex || 0) - (b.layerIndex || 0));

        if (changed) {
            this._isDirty = true;
            eventBus.emit('layer-update');
        }
    }

    static getLayerIndex(name: string): number {
        return this._projectLayerTemplates.findIndex(l => l && l.name.toLowerCase() === name.toLowerCase());
    }

    static getLayerName(index: number): string {
        return this._projectLayerTemplates[index]?.name || 'Default';
    }

    private static _projectLayerTemplates: ProjectLayerConfig[] = [];

    static createDefaultScene() {
        eventBus.emit('scene-cleared');
        world.clear();
        
        this._activeSceneName = 'Untitled Scene';
        this._layers = [];

        // Use Project Layer Templates if available
        if (this._projectLayerTemplates.length > 0) {
            this._layers = this._projectLayerTemplates.map((config, index) => {
                 // Use UUIDs for robustness, but could use name as ID if unique
                 const isBase = index === 0; // First layer is effectively base
                 return {
                    id: isBase ? 'Base Layer' : `layer-${crypto.randomUUID()}`, // Keep 'Base Layer' ID for compatibility if it's the first one? Or just map named layers.
                    // Actually, let's keep 'Base Layer' ID for the *first* layer to maintain internal logic that relies on it (like locking/color)
                    // Or better: First layer from settings is bottom-most.
                    name: config.name,
                    visible: true,
                    locked: false,
                    color: isBase ? '#333333' : undefined,
                    type: config.type || 'default',
                    tileData: {},
                    gridSize: config.gridSize || { x: 32, y: 32 },
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

    static updateAssetReferences(oldPath: string, newPath: string) {
        let changed = false;
        const normalize = (p: string) => p.replace(/\\/g, '/');
        const targetOld = normalize(oldPath);
        const targetNew = normalize(newPath);
        const isFolder = !targetOld.includes('.'); // Heuristic
        
        // Helper to replace path if it matches or is inside folder
        const replaceIfMatch = (val: string | undefined): string | null => {
            if (!val) return null;
            const valNorm = normalize(val);
            
            if (valNorm === targetOld) return targetNew;
            
            if (isFolder && valNorm.startsWith(targetOld + '/')) {
                return targetNew + valNorm.slice(targetOld.length);
            }
            return null;
        };

        for (const entity of world) {
            let entityChanged = false;

            // 1. Sprite
            if (entity.sprite) {
                const newVal = replaceIfMatch(entity.sprite.texture);
                if (newVal) {
                    entity.sprite.texture = newVal;
                    entityChanged = true;
                }
            }

            // 2. NineSlice
            if (entity.nineSliceSprite) {
                const newVal = replaceIfMatch(entity.nineSliceSprite.texture);
                if (newVal) {
                    entity.nineSliceSprite.texture = newVal;
                    entityChanged = true;
                }
            }

            // 3. Audio
            if (entity.audioSource) {
                 const newVal = replaceIfMatch(entity.audioSource.clip);
                 if (newVal) {
                     entity.audioSource.clip = newVal;
                     entityChanged = true;
                 }
            }

            // 4. BitmapText
            if (entity.bitmapText) {
                // Actually bitmap font often uses `fontName` (alias) not path directly in component usually?
                // But if we store texture path:
                if (entity.bitmapText.fontTexture) {
                    const newApp = replaceIfMatch(entity.bitmapText.fontTexture);
                    if (newApp) {
                        entity.bitmapText.fontTexture = newApp;
                        entityChanged = true;
                    }
                }
            }
            
            // 5. Scripts
            if (entity.script) {
                entity.script.forEach(s => {
                    const newVal = replaceIfMatch(s.path);
                    if (newVal) {
                        s.path = newVal;
                        entityChanged = true;
                    }
                });
            }
            
            // 6. Animator
            if (entity.animator && entity.animator.animations) {
                for (const animName in entity.animator.animations) {
                    const anim = entity.animator.animations[animName];
                    if (anim && anim.frames) {
                         const newFrames = anim.frames.map(f => replaceIfMatch(f) || f);
                         // Check diff?
                         if (JSON.stringify(newFrames) !== JSON.stringify(anim.frames)) {
                             anim.frames = newFrames;
                             entityChanged = true;
                         }
                    }
                }
            }

            if (entityChanged) {
                changed = true;
            }
        }

        if (changed) {
            this._isDirty = true;
            eventBus.emit('scene-updated');
            console.log(`[SceneManager] Updated references: ${oldPath} -> ${newPath}`);
        }
    }

    static removeAssetReferences(path: string) {
        let changed = false;
        const normalize = (p: string) => p.replace(/\\/g, '/');
        const targetPath = normalize(path);
        const isFolder = !targetPath.includes('.'); // Simple extension check, or passed from caller
        
        // Helper to check if value matches target or is inside target folder
        const matches = (value: string | undefined) => {
             if (!value) return false;
             const valNorm = normalize(value);
             if (valNorm === targetPath) return true;
             if (isFolder && valNorm.startsWith(targetPath + '/')) return true;
             return false;
        };

        for (const entity of world) {
            let entityChanged = false;

            // 1. Sprite
            if (entity.sprite && matches(entity.sprite.texture)) {
                entity.sprite.texture = ''; // Or default?
                entityChanged = true;
            }

            // 2. NineSlice
            if (entity.nineSliceSprite && matches(entity.nineSliceSprite.texture)) {
                entity.nineSliceSprite.texture = '';
                entityChanged = true;
            }

            // 3. Audio
            if (entity.audioSource && matches(entity.audioSource.clip)) {
                entity.audioSource.clip = '';
                entityChanged = true;
            }

            // 4. BitmapText (Font Texture)
            if (entity.bitmapText && matches(entity.bitmapText.fontTexture)) {
                entity.bitmapText.fontTexture = undefined;
                entityChanged = true;
            }

            // 5. Scripts
            if (entity.script) {
                const initialLen = entity.script.length;
                entity.script = entity.script.filter(s => !matches(s.path));
                if (entity.script.length !== initialLen) {
                    entityChanged = true;
                }
            }

            // 6. Animator
            if (entity.animator && entity.animator.animations) {
                 for (const animName in entity.animator.animations) {
                     const anim = entity.animator.animations[animName];
                     if (anim && anim.frames) {
                         const originalCount = anim.frames.length;
                         anim.frames = anim.frames.filter(frame => !matches(frame));
                         if (anim.frames.length !== originalCount) {
                             entityChanged = true;
                         }
                     }
                 }
            }
            
            if (entityChanged) {
                changed = true;
            }
        }

        if (changed) {
            this._isDirty = true;
            eventBus.emit('scene-updated'); // Notify UI to refresh Inspector/Scene
            console.log(`[SceneManager] Removed references to ${path}`);
        }
    }
}
