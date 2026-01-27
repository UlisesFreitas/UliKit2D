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
        console.log(`[SceneManager] loadScene called. Templates available: ${this._projectLayerTemplates.length}`, this._projectLayerTemplates);
        eventBus.emit('scene-cleared'); // Notify UI to clear immediately
        world.clear();
        this._activeSceneName = name;
        
        try {
            const data = typeof dataOrJson === 'string' ? JSON.parse(dataOrJson) : dataOrJson;
            
            // 1. Initialize Layers: Prioritize Project Templates to avoid "Sync Duplicates"
            this._layers = [];
            
            // A. Create Structure from Templates (Source of Truth for IDs/Indices)
            if (this._projectLayerTemplates.length > 0) {
                 this._layers = this._projectLayerTemplates.map((name, index) => {
                     // Check if 'data.layers' has matching layer to restore specific props (visible, locked, color)
                     // Match by Name first, as Templates define the Names.
                     const savedLayer = data.layers?.find((l: any) => l.name === name); // Fallback name check
                     
                     const isBase = index === 0;
                     return {
                        id: savedLayer?.id || (isBase ? 'Base Layer' : `layer-sys-${index}-${crypto.randomUUID().split('-')[0]}`),
                        name: name,
                        visible: savedLayer?.visible ?? true,
                        locked: savedLayer?.locked ?? false,
                        color: savedLayer?.color || (isBase ? '#333333' : undefined),
                        type: savedLayer?.type || 'default',
                        tileData: savedLayer?.tileData || {},
                        gridSize: savedLayer?.gridSize || { x: 32, y: 32 },
                        _entityIds: new Set(),
                        layerIndex: index
                     };
                });
            } 
            // B. Fallback: trusting Data if no Templates (e.g. fresh load before settings)
            else if (data.layers) {
                console.warn('[SceneManager] WARN: Loading scene WITHOUT Templates. Using saved layer data (risk of duplicates).');
                this._layers = data.layers.map((l: any) => ({
                    ...l,
                    tileData: l.tileData || {},
                    gridSize: l.gridSize || { x: 32, y: 32 },
                    _entityIds: new Set(),
                    layerIndex: l.layerIndex ?? 0
                }));
            }
            // C. Ultimate Fallback
            else {
                 this._layers = [{ id: 'Base Layer', name: 'Base Layer', visible: true, locked: false, color: '#333333', _entityIds: new Set(), layerIndex: 0 }];
            }

            // 2. Load Entities & Build Registry
            const loadedEntities = Array.isArray(data) ? data : (data.entities || []);
            
            for (const entity of loadedEntities) {
                // Legacy Fix: Missing layer
                if (!entity.layer) entity.layer = 'Base Layer';
                
                // MIGRATION: Resolve Layer UUID/Name to Global Index
                let targetLayerIndex = 0;
                
                // A. Try finding by ID (UUID match) in our newly built local layers
                const localLayer = this._layers.find(l => l.id === entity.layer);
                if (localLayer && localLayer.layerIndex !== undefined) {
                    targetLayerIndex = localLayer.layerIndex;
                } else {
                    // B. Try finding by Name (if entity.layer was actually a name)
                    // (Handle cases where saved entity has old layer name, we map to current template index)
                    const byName = this._layers.find(l => l.name === entity.layer);
                    if (byName && byName.layerIndex !== undefined) {
                        targetLayerIndex = byName.layerIndex;
                        // IMPORTANT: Update entity to use ID for future
                        entity.layer = byName.id;
                    }
                    else {
                         // C. Fallback: Base Layer name lookup
                         const baseLayer = this._layers.find(l => l.layerIndex === 0);
                         if (baseLayer) {
                             targetLayerIndex = 0;
                             entity.layer = baseLayer.id;
                         }
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
        
        // Finalize: Sync with Project Settings and Notify
        // (This should now be a no-op or just visual sync, no structure changes)
        this.syncLayersWithTemplates();
        
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
        console.log('[SceneManager] setProjectLayers called with:', layerNames);
        this._projectLayerTemplates = layerNames;
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
        // We iterate backwards to safely splice
        for (let i = this._layers.length - 1; i >= 0; i--) {
            const layer = this._layers[i];
            if (!layer) continue;
            if (layer.id === 'Base Layer') continue; // Always keep Base Layer
            
            // Replaced logic with Pass 1-4 below
        }

        const claimedRuntimeIds = new Set<string>();
        const claimedTemplateIndices = new Set<number>();

        // Pass 1: Exact Match (Index AND Name)
        this._projectLayerTemplates.forEach((name, index) => {
            if (!name) return;
            const runtimeLayer = this._layers.find(l => l.layerIndex === index && l.name === name);
            if (runtimeLayer) {
                claimedRuntimeIds.add(runtimeLayer.id);
                claimedTemplateIndices.add(index);
                // No changes needed
            }
        });

        // Pass 2: Name Match (Index mismatch) -> Move Runtime Layer to correct Index
        this._projectLayerTemplates.forEach((name, index) => {
            if (!name) return;
            if (claimedTemplateIndices.has(index)) return; // Already satisfied

            // Find unclaimed runtime layer with matching name
            const runtimeLayer = this._layers.find(l => l.name === name && !claimedRuntimeIds.has(l.id));
            if (runtimeLayer) {
                // console.log(`[SceneManager] Sync: Re-indexing "${name}"`);
                runtimeLayer.layerIndex = index;
                claimedRuntimeIds.add(runtimeLayer.id);
                claimedTemplateIndices.add(index);
                changed = true;
            }
        });

        // Pass 3: Index Match (Name mismatch) -> Rename Runtime Layer
        this._projectLayerTemplates.forEach((name, index) => {
            if (!name) return;
            if (claimedTemplateIndices.has(index)) return;

            // Find unclaimed runtime layer at this index
            const runtimeLayer = this._layers.find(l => l.layerIndex === index && !claimedRuntimeIds.has(l.id));
            if (runtimeLayer) {
                // console.log(`[SceneManager] Sync: Renaming Layer ${index}`);
                runtimeLayer.name = name;
                claimedRuntimeIds.add(runtimeLayer.id);
                claimedTemplateIndices.add(index);
                changed = true;
            }
        });

        // Pass 4: Create Missing Layers
        this._projectLayerTemplates.forEach((name, index) => {
             if (!name) return;
             if (claimedTemplateIndices.has(index)) return;

             // Create new
             // console.log(`[SceneManager] Sync: Creating Missing Layer ${index}`);
             
             const newLayer: SceneLayer = {
                id: `layer-sys-${index}-${crypto.randomUUID().split('-')[0]}`,
                name: name,
                visible: true,
                locked: false,
                type: 'default',
                tileData: {},
                gridSize: { x: 32, y: 32 },
                _entityIds: new Set(),
                layerIndex: index
             };
             this._layers.push(newLayer);
             
             // CRITICAL FIX: Claim the new layer so it's not immediately deleted by the orphanage check below
             claimedRuntimeIds.add(newLayer.id);
             changed = true;
        });

        // 4. DELETE UNCLAIMED
        for (let i = this._layers.length - 1; i >= 0; i--) {
            const layer = this._layers[i];
            // Ensure layer exists (TS check)
            if (!layer) continue;

            if (!claimedRuntimeIds.has(layer.id)) {
                // console.log(`[SceneManager] Deleting Orphaned Layer: "${layer.name}"`);
                
                const baseLayer = this._layers.find(l => l.layerIndex === 0);
                const baseId = baseLayer?.id || 'Base Layer';
                
                for (const entity of world) {
                    if (entity.layer === layer.id) {
                        entity.layer = baseId;
                        this.registerEntity(entity.id!, baseId);
                    }
                }
                
                this._layers.splice(i, 1);
                changed = true;
            }
        }

        // 5. CRITICAL: Enforce Array Order matches Layer Index
        // The LayersPanel relies on the array order, so we must sort it.
        this._layers.sort((a, b) => (a.layerIndex || 0) - (b.layerIndex || 0));

        if (changed) {
            this._isDirty = true;
            eventBus.emit('layer-update');
        }
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
