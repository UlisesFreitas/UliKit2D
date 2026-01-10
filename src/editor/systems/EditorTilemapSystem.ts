
import { Application, Container, Sprite, Rectangle, Texture } from 'pixi.js';
import { SceneManager } from '../../engine/managers/SceneManager';
import { resourceManager } from '../../engine/resources/ResourceManager';

export class EditorTilemapSystem {
    private app: Application;
    private rootContainer: Container;
    private layerContainers: Map<string, Container> = new Map();
    private textureCache: Map<string, Texture> = new Map();
    
    // Dirty flag mapping layerId -> boolean
    private dirtyLayers: Set<string> = new Set();
    private lastLayerOrderSignature: string = '';

    constructor(app: Application) {
        this.app = app;
        this.rootContainer = new Container();
        this.rootContainer.label = 'TilemapSystemRoot';
        this.rootContainer.zIndex = -1; 
        
        this.app.stage.addChild(this.rootContainer);
    }

    public markDirty(layerId?: string) {
        if (layerId) {
            this.dirtyLayers.add(layerId);
        } else {
            // Mark all
            SceneManager.layers.forEach(l => this.dirtyLayers.add(l.id));
        }
    }
    
    public update() {
        // Check if Layer Order changed
        const currentOrder = SceneManager.layers.map(l => l.id).join(',');
        if (currentOrder !== this.lastLayerOrderSignature) {
            this.rebuildLayerOrder();
            this.lastLayerOrderSignature = currentOrder;
        }

        // Process Dirty Layers
        this.dirtyLayers.forEach(layerId => {
            this.renderLayer(layerId);
        });
        this.dirtyLayers.clear();
    }

    private rebuildLayerOrder() {
        this.rootContainer.removeChildren();
        
        for (const layer of SceneManager.layers) {
            let container = this.layerContainers.get(layer.id);
            if (!container) {
                container = new Container();
                container.label = `TilemapLayer-${layer.name}`;
                this.layerContainers.set(layer.id, container);
            }
            this.rootContainer.addChild(container);
        }
    }

    private async renderLayer(layerId: string) {
        const layer = SceneManager.getLayerById(layerId);
        const container = this.layerContainers.get(layerId);
        
        if (!layer || !container) return;

        // Clear current Loop
        container.removeChildren();

        // Check if it has data
        if (!layer.tileData || Object.keys(layer.tileData).length === 0 || !layer.tileset) {
            return;
        }
        
        // Get Texture
        let texture = this.textureCache.get(layer.tileset);
        if (!texture) {
            try {
                // Normalize path
                const normPath = layer.tileset.replace(/\\/g, '/');
                const loaded = await resourceManager.loadTexture(normPath);
                if (loaded) {
                    texture = loaded;
                    this.textureCache.set(layer.tileset, texture);
                }
            } catch (e) {
                console.warn(`TilemapSystem: Failed to load texture ${layer.tileset}`, e);
                return;
            }
        }
        
        if (!texture) return;

        // Grid Size
        const gw = layer.gridSize?.x || 32;
        const gh = layer.gridSize?.y || 32;

        // Draw Tiles
        for (const [key, tileId] of Object.entries(layer.tileData)) {
            const parts = key.split(',');
            if (parts.length !== 2) continue;
            
            const gx = Number(parts[0]);
            const gy = Number(parts[1]);
            
            // Calculate Source Rect
            // Width in tiles?
            const cols = Math.floor(texture.width / gw);
            
            const tx = (tileId % cols) * gw;
            const ty = Math.floor(tileId / cols) * gh;

            try {
                // Create Frame
                const frame = new Rectangle(tx, ty, gw, gh);
                const tileTexture = new Texture({
                    source: texture.source,
                    frame: frame
                });

                const sprite = new Sprite(tileTexture);
                sprite.x = gx * gw;
                sprite.y = gy * gh;
                // Avoid blurring
                sprite.roundPixels = true; 
                
                container.addChild(sprite);
            } catch (e) {
                // Ignore invalid frames
            }
        }
        
        // Layer Visibility
        container.visible = layer.visible !== false;
    }
    
    public dispose() {
        this.rootContainer.destroy({ children: true });
        this.layerContainers.clear();
        this.textureCache.clear();
    }
}
