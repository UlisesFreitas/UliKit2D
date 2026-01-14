import { world } from '../ecs/ECS';
import { SceneManager } from '../managers/SceneManager';
import defaultSprite from '../../resources/internal_default_assets/default_sprite.png';

export type EntityType = 
    | 'Empty' 
    | 'Sprite' 
    | 'Camera' 
    | 'Text' 
    | 'BitmapText' 
    | 'Animator' 
    | 'NineSliceSprite' 
    | 'CircleObject' 
    | 'BoxObject' 
    | 'Audio' 
    | 'Script';

export class EntityFactory {
    
    static createEntity(type: EntityType, position: { x: number, y: number }, parentLayerId?: string) {
        const id = crypto.randomUUID();
        const layerId = parentLayerId || 'Base Layer';
        
        let data: any = {
            id,
            name: type === 'Empty' ? 'New Entity' : `New ${type}`,
            layer: layerId,
            transform: { 
                x: position.x, 
                y: position.y, 
                rotation: 0, 
                scale: { x: 1, y: 1 }, 
                zIndex: 0 
            }
        };

        switch (type) {
            case 'Empty':
                // Just transform
                break;
            case 'Sprite':
                data.sprite = { texture: defaultSprite, anchor: { x: 0.5, y: 0.5 } };
                break;
            case 'Camera':
                data.camera = { zoom: 1, isPrimary: false, backgroundColor: '#000000' };
                // Cameras usually shouldn't rotate/scale visibly, but transform allows it.
                break;
            case 'Text':
                data.label = { 
                    text: 'New Text', 
                    fontSize: 24, 
                    fontFamily: 'Arial', 
                    color: '#ffffff', 
                    align: 'center' 
                };
                break;
            case 'BitmapText':
                data.bitmapText = {
                    text: 'Bitmap Text',
                    fontName: '', // Default fallback
                    fontSize: 32,
                    tint: 0xffffff,
                    align: 'left'
                };
                break;
            case 'Animator':
                data.sprite = { texture: defaultSprite, anchor: { x: 0.5, y: 0.5 } };
                data.animator = {
                    currentAnim: '',
                    isPlaying: true,
                    speed: 1,
                    elapsedTime: 0,
                    animations: {}
                };
                break;
            case 'NineSliceSprite':
                data.nineSliceSprite = {
                    texture: '', // User needs to assign
                    width: 100,
                    height: 100,
                    left: 10, right: 10, top: 10, bottom: 10,
                    anchor: { x: 0.5, y: 0.5 }
                };
                break;
            case 'CircleObject':
                data.name = 'Circle Physics';
                data.rigidBody = { mass: 1, isStatic: false, friction: 0.5, restitution: 0.5 };
                data.circleCollider = { radius: 25 };
                break;
            case 'BoxObject':
                data.name = 'Box Physics';
                data.rigidBody = { mass: 1, isStatic: false, friction: 0.5, restitution: 0.5 };
                data.boxCollider = { width: 50, height: 50 };
                break;
            case 'Audio':
                data.name = 'Audio Source';
                // Assuming Audio Component schema (not fully defined in ECS view but implied)
                data.audioSource = { clip: '', volume: 1, loop: false, playOnAwake: true };
                break;
            case 'Script':
                data.name = 'Script Holder';
                data.script = []; // Empty array
                break;
        }

        world.add(data);
        SceneManager.registerEntity(id, layerId);
        
        return id;
    }
}
