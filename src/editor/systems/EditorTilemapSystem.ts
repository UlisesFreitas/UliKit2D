
import { Application, Container, Texture } from 'pixi.js';
import { SceneManager } from '../../engine/managers/SceneManager';
import { resourceManager } from '../../engine/resources/ResourceManager';
import { TilemapChunk } from './tilemap/TilemapChunk';

export class EditorTilemapSystem {
    private app: Application;
    private rootContainer: Container;
    
    // LayerId -> Root Container
    private layerRoots: Map<string, Container> = new Map();
    
    // LayerId -> ChunkKey -> Chunk
    private layerChunks: Map<string, Map<string, TilemapChunk>> = new Map();
    
    private textureCache: Map<string, Texture> = new Map();
    
    // Dirty flag mapping layerId -> boolean
    private dirtyLayers: Set<string> = new Set();
    private lastLayerOrderSignature: string = '';

    constructor(app: Application) {
        this.app = app;
        // Ensure Z-Sorting is enabled so layers stack correctly
        this.app.stage.sortableChildren = true;
        this.rootContainer = new Container();
        this.rootContainer.label = 'TilemapSystemRoot';
        this.rootContainer.zIndex = 1; 
        
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
            let container = this.layerRoots.get(layer.id);
            if (!container) {
                container = new Container();
                container.label = `TilemapLayer-${layer.name}`;
                this.layerRoots.set(layer.id, container);
            }
            this.rootContainer.addChild(container);
        }
    }

    private async renderLayer(layerId: string) {
        const layer = SceneManager.getLayerById(layerId);
        if (!layer) return;

        // Ensure Root Container Exists
        let layerRoot = this.layerRoots.get(layerId);
        if (!layerRoot) {
            layerRoot = new Container();
            layerRoot.label = `TilemapLayer-${layer.name}`;
            this.layerRoots.set(layerId, layerRoot);
            this.rebuildLayerOrder(); // Force re-add
        }

        // Ensure Chunks Map Exists
        // Ensure Chunks Map Exists
        let chunks = this.layerChunks.get(layerId);
        if (!chunks) {
            chunks = new Map<string, TilemapChunk>();
            this.layerChunks.set(layerId, chunks);
        }

        // Check data availability
        if (!layer.tileset) {
            layerRoot.removeChildren();
            chunks.clear();
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
        const gw = layer.gridSize?.x || 8;
        const gh = layer.gridSize?.y || 8;

        // Step 1: Reset existing chunks (prepare for rebuild)
        // We do strictly sparse update from tileData
        chunks.forEach(c => c.reset());

        // Step 2: Populate Chunks
        if (layer.tileData) {
            for (const [key, tileId] of Object.entries(layer.tileData)) {
                const parts = key.split(',');
                if (parts.length !== 2) continue;
                
                const gx = Number(parts[0]);
                const gy = Number(parts[1]);
                
                // Chunk logic (16x16)
                const chunkSize = 16;
                const cx = Math.floor(gx / chunkSize);
                const cy = Math.floor(gy / chunkSize);
                
                const chunkKey = `${cx},${cy}`;
                let chunk = chunks.get(chunkKey);
                
                if (!chunk) {
                    chunk = new TilemapChunk(cx, cy, { x: gw, y: gh }, texture);
                    chunks.set(chunkKey, chunk);
                    layerRoot.addChild(chunk);
                }
                
                // Local Coords in Chunk
                // gx could be negative. cx*16 handles base.
                // lx = gx - cx*16
                const lx = gx - (cx * chunkSize);
                const ly = gy - (cy * chunkSize);
                
                chunk.setTile(lx, ly, tileId);
            }
        }

        // Step 3: Refresh or Cull
        for (const [key, chunk] of chunks.entries()) {
            if (chunk.isEmpty) {
                chunk.destroy({ children: true }); // Pixi destroy
                chunks.delete(key);
                layerRoot.removeChild(chunk);
            } else {
                chunk.refresh();
            }
        }
        
        // Layer Visibility
        layerRoot.visible = layer.visible !== false;
    }
    
    public dispose() {
        this.rootContainer.destroy({ children: true });
        this.layerRoots.clear();
        this.layerChunks.clear();
        this.textureCache.clear();
    }
}
