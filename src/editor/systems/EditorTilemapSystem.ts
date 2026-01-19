import { Application, Container, Texture } from 'pixi.js';
import { SceneManager } from '../../engine/managers/SceneManager';
import { resourceManager } from '../../engine/resources/ResourceManager';
import { TilemapChunk } from './tilemap/TilemapChunk';
import { eventBus } from '../../engine/core/EventBus';
import { instance as engine } from '../../engine/core/Engine';

export class EditorTilemapSystem {
    // app removed as it is unused
    
    // LayerId -> Tile Container (Child of RenderSystem Layer Container)
    private layerRoots: Map<string, Container> = new Map();
    
    // LayerId -> ChunkKey -> Chunk
    private layerChunks: Map<string, Map<string, TilemapChunk>> = new Map();
    
    private textureCache: Map<string, Texture> = new Map();
    
    // Dirty flag mapping layerId -> boolean
    private dirtyLayers: Set<string> = new Set();

    constructor(_app: Application) {
        // No rootContainer anymore. We inject into RenderSystem's containers.
        // _app unused but kept in signature if needed for interface compliance or future use.

        // Reactivity Fix: Listen to SceneManager changes
        // Reactivity Fix: Listen to SceneManager changes
        eventBus.on('layer-update', (layerId?: string) => {
            if (typeof layerId === 'string') {
                this.markDirty(layerId);
            } else {
                this.markDirty();
            }
        });
        eventBus.on('scene-loaded', () => {
             this.cleanup();
             this.markDirty();
        });
    }

    private cleanup() {
        // Destroy all tile containers
        for (const [, container] of this.layerRoots) {
            if (container.parent) container.parent.removeChild(container);
            container.destroy({ children: true });
        }
        this.layerRoots.clear();
        this.layerChunks.clear();
        this.textureCache.clear();
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
        // We don't control Layer Order anymore (RenderSystem does).
        // We just ensure we have our TileRoots inside them.

        // Process Dirty Layers
        this.dirtyLayers.forEach(layerId => {
            // console.log(`[EditorTilemapSystem] Rendering Dirty Layer: ${layerId}`);
            // Fire and Forget (sort of)
            // If it returns false (container missing), we re-add it to dirty
            this.renderLayer(layerId).then(success => {
                if (!success) {
                    // console.log(`[EditorTilemapSystem] Render Failed (Container Missing) for ${layerId}, monitoring...`);
                    this.dirtyLayers.add(layerId);
                }
            });
        });
        
        // Clear immediately. If renderLayer fails, it will re-add itself via callback.
        this.dirtyLayers.clear();

        // Prune stale layers (if RenderSystem removed them)
        for (const [layerId, root] of this.layerRoots) {
             if (!engine.renderSystem.layerContainers.has(layerId)) {
                 if (root.parent) root.parent.removeChild(root);
                 root.destroy({ children: true });
                 this.layerRoots.delete(layerId);
                 this.layerChunks.delete(layerId);
             }
        }
    }

    private async renderLayer(layerId: string): Promise<boolean> {
        const layer = SceneManager.getLayerById(layerId);
        if (!layer) return true; // Layer gone, operation "successful" (no retry needed)

        // 1. Get Parent Layer Container from RenderSystem
        const parentContainer = engine.renderSystem.layerContainers.get(layerId);
        
        if (!parentContainer) {
            // RenderSystem hasn't built this layer yet.
            // Retry later.
            return false;
        }

        // 2. Ensure TileRoot Exists
        let tileRoot = this.layerRoots.get(layerId);
        if (!tileRoot || tileRoot.destroyed) {
            tileRoot = new Container();
            tileRoot.label = `TilemapLayer-${layer.name}`;
            tileRoot.zIndex = -1; // FORCE BEHIND ENTITIES
            tileRoot.eventMode = 'passive'; // Allow click-through to background/grid if empty
            
            // Add to Parent
            parentContainer.addChild(tileRoot);
            this.layerRoots.set(layerId, tileRoot);
            
            // Ensure Parent Sorts
            parentContainer.sortableChildren = true;
        }
        
        // Re-attach if parent changed (unlikely unless RenderSystem rebuilt it)
        if (tileRoot.parent !== parentContainer) {
            parentContainer.addChild(tileRoot);
        }

        // 3. Render Chunks
        // Ensure Chunks Map Exists
        let chunks = this.layerChunks.get(layerId);
        if (!chunks) {
            chunks = new Map<string, TilemapChunk>();
            this.layerChunks.set(layerId, chunks);
        }

        // Check data availability
        if (!layer.tileset) {
            tileRoot.removeChildren();
            chunks.clear();
            return true;
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
                console.warn(`[EditorTilemapSystem] Failed to load texture ${layer.tileset}`, e);
                // Don't retry per frame if file missing, just stop
                return true; 
            }
        }
        
        if (!texture) return true;
        
        // Grid Size
        const gw = layer.gridSize?.x || 8;
        const gh = layer.gridSize?.y || 8;

        // Reset chunks (Partial update if needed, but here simple reset)
        chunks.forEach(c => c.reset());

        // Populate Chunks
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
                    tileRoot.addChild(chunk);
                }
                
                // Local Coords in Chunk
                const lx = gx - (cx * chunkSize);
                const ly = gy - (cy * chunkSize);
                
                chunk.setTile(lx, ly, tileId);
            }
        }

        // Refresh or Cull
        for (const [key, chunk] of chunks.entries()) {
            if (chunk.isEmpty) {
                chunk.destroy({ children: true }); 
                chunks.delete(key);
                tileRoot.removeChild(chunk);
            } else {
                chunk.refresh();
            }
        }
        
        // Visibility handled by Parent Layer Container in RenderSystem
        // But we can toggle tileRoot specific visibility if needed (e.g. Hide Tiles Only)
        // For now, it inherits.
        return true;
    }
    
    public dispose() {
        this.cleanup();
    }
}
