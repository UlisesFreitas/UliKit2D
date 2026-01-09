import { world, createEntity, type Entity } from '../ecs/ECS';

export class SceneManager {
    private static _activeSceneName: string = 'Untitled Scene';
    private static _isDirty: boolean = false;

    static get activeSceneName() { return this._activeSceneName; }
    static set activeSceneName(v: string) { this._activeSceneName = v; }
    static get isDirty() { return this._isDirty; }

    static setDirty(dirty: boolean) { this._isDirty = dirty; }

    static saveScene(): string {
        const entities: Partial<Entity>[] = [];
        // Iterate all entities
        for (const entity of world) {
            // Create a serialize-safe deep copy
            const serializable: Partial<Entity> = {
                 id: entity.id,
                 name: entity.name,
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
        return JSON.stringify(entities, null, 2);
    }

    static loadScene(json: string, name: string = 'Untitled Scene') {
        world.clear();
        this._activeSceneName = name;
        const entities = JSON.parse(json) as Entity[];
        
        for (const data of entities) {
            world.add(data);
        }
        this._isDirty = false;
    }

    static async loadSceneFromFile(path: string) {
        // Dynamic import to avoid circular dependency if possible, or just use registered global
        // But better to use the ResourceManager singleton
        const { resourceManager } = await import('../resources/ResourceManager');
        
        const data = await resourceManager.loadJSON(path);
        if (data && Array.isArray(data)) {
            world.clear();
            // Extract Name from filename if possible, for now use path
            const filename = path.split(/[/\\]/).pop() || 'Loaded Scene';
            this._activeSceneName = filename.replace('.json', '');
            
            for (const entity of data) {
                 world.add(entity);
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
        
        // createEntity adds it to the world automatically
        const camera = createEntity('Main Camera');
        camera.transform = { x: 0, y: 0, rotation: 0, scale: { x: 1, y: 1 } };
        camera.camera = { zoom: 1, isPrimary: true, backgroundColor: '#333333' };
        
        // Just a camera for now
        this._isDirty = false;
    }
}
