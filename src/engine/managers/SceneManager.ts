import { world, createEntity, type Entity } from '../ecs/ECS';

export class SceneManager {
    private static _activeSceneName: string = 'Untitled Scene';
    private static _isDirty: boolean = false;

    static get activeSceneName() { return this._activeSceneName; }
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

    static createDefaultScene() {
        world.clear();
        this._activeSceneName = 'Untitled Scene';
        createEntity('Main Camera'); // Should add Camera component logic here later if not auto-added
        // We might want to ensure Main Camera has the camera component
        const cam = world.add({ 
            name: 'Main Camera',
            transform: { x: 0, y: 0, rotation: 0, scale: { x: 1, y: 1 } },
            camera: { zoom: 1, isPrimary: true, backgroundColor: '#333333' }
        });
        
        const player = createEntity('Player');
        player.transform = { x: 100, y: 100, rotation: 0, scale: { x: 1, y: 1 } };
        player.sprite = { texture: '' }; // ready for sprite
        
        this._isDirty = false;
    }
}
