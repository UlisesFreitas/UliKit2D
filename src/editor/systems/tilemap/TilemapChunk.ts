import { 
    Mesh, 
    Geometry, 
    Texture, 
    Container,
    GlProgram,
    Buffer, 
    BufferUsage,
    Sprite
} from 'pixi.js';

export class TilemapChunk extends Container {
    private mesh: Mesh;
    private geometry: Geometry;
    
    // Chunk Data
    public readonly cx: number;
    public readonly cy: number;
    public readonly chunkSize: number = 16;
    public readonly gridSize: { x: number, y: number };
    
    // Data Storage (Local to chunk)
    // Key: "localX,localY" -> tileId
    private tileData: Map<string, number> = new Map();
    private texture: Texture;

    // Buffers (Underlying Data)
    private positions: Float32Array;
    private uvs: Float32Array;
    private indices: Uint16Array;
    
    // Buffers (Pixi Objects)
    private posBuffer: Buffer;
    private uvBuffer: Buffer;
    private idxBuffer: Buffer;

    private isDirty: boolean = false;

    constructor(cx: number, cy: number, gridSize: { x: number, y: number }, texture: Texture) {
        super();
        this.cx = cx;
        this.cy = cy;
        this.gridSize = gridSize;
        this.texture = texture;
        
        // Position chunk container
        this.x = cx * this.chunkSize * gridSize.x;
        this.y = cy * this.chunkSize * gridSize.y;

        // Initialize Data Arrays (Max size = 16x16 = 256 tiles)
        const maxTiles = this.chunkSize * this.chunkSize;
        const vertsPerTile = 4;
        const indicesPerTile = 6;
        
        this.positions = new Float32Array(maxTiles * vertsPerTile * 2);
        this.uvs = new Float32Array(maxTiles * vertsPerTile * 2);
        this.indices = new Uint16Array(maxTiles * indicesPerTile);

        // Initialize Pixi Buffers
        this.posBuffer = new Buffer({
            data: this.positions,
            usage: BufferUsage.VERTEX | BufferUsage.COPY_DST,
            label: 'TilePos'
        });

        this.uvBuffer = new Buffer({
            data: this.uvs,
            usage: BufferUsage.VERTEX | BufferUsage.COPY_DST,
            label: 'TileUV'
        });

        this.idxBuffer = new Buffer({
            data: this.indices,
            usage: BufferUsage.INDEX | BufferUsage.COPY_DST,
            label: 'TileIdx'
        });

        // Create Geometry
        this.geometry = new Geometry({
            attributes: {
                aPosition: {
                    buffer: this.posBuffer,
                    size: 2
                },
                aUV: {
                    buffer: this.uvBuffer,
                    size: 2
                }
            },
            indexBuffer: this.idxBuffer
        });

        // Initialize Mesh (Cast geometry to any/MeshGeometry to satisfy v8 types)
        this.mesh = new Mesh({
            geometry: this.geometry as any,
            texture: this.texture
        });
        
        this.addChild(this.mesh);
    }

    public setTile(lx: number, ly: number, tileId: number | undefined) {
        // ... existing code ...
        const key = `${lx},${ly}`;
        if (tileId === undefined) {
            this.tileData.delete(key);
        } else {
            this.tileData.set(key, tileId);
        }
        this.isDirty = true;
    }

    public reset() {
        this.tileData.clear();
        this.isDirty = true;
    }

    public get isEmpty(): boolean {
        return this.tileData.size === 0;
    }

    public refresh() {
        if (!this.isDirty) return;
        this.rebuildGeometry();
        this.isDirty = false;
    }

    private rebuildGeometry() {
        let tileCount = 0;
        let pIndex = 0; // Position Index
        let uIndex = 0; // UV Index
        let iIndex = 0; // Indices Index
        
        const gw = this.gridSize.x;
        const gh = this.gridSize.y;
        
        // Ensure texture is valid (v8 check)
        if (!this.texture.source) return;
        
        const texW = this.texture.width;
        const texH = this.texture.height;
        
        // Helper to avoid division per vertex
        const invTexW = 1.0 / texW;
        const invTexH = 1.0 / texH;

        // Iterate all tiles in data
        for (const [key, tileId] of this.tileData.entries()) {
            const parts = key.split(',');
            const lx = Number(parts[0]);
            const ly = Number(parts[1]);
            
            // Calculate Position relative to Chunk
            const x0 = lx * gw;
            const y0 = ly * gh;
            const x1 = x0 + gw;
            const y1 = y0 + gh;

            // Calculate UVs
            const cols = Math.floor(texW / gw);
            const tx = (tileId % cols) * gw;
            const ty = Math.floor(tileId / cols) * gh;

            // UV coordinates (normalized 0..1)
            const u0 = tx * invTexW;
            const v0 = ty * invTexH;
            const u1 = (tx + gw) * invTexW;
            const v1 = (ty + gh) * invTexH;

            // --- Fill Buffers ---
            
            // 0: TL
            this.positions[pIndex++] = x0;
            this.positions[pIndex++] = y0;
            this.uvs[uIndex++] = u0;
            this.uvs[uIndex++] = v0;

            // 1: TR
            this.positions[pIndex++] = x1;
            this.positions[pIndex++] = y0;
            this.uvs[uIndex++] = u1;
            this.uvs[uIndex++] = v0;

            // 2: BR
            this.positions[pIndex++] = x1;
            this.positions[pIndex++] = y1;
            this.uvs[uIndex++] = u1;
            this.uvs[uIndex++] = v1;

            // 3: BL
            this.positions[pIndex++] = x0;
            this.positions[pIndex++] = y1;
            this.uvs[uIndex++] = u0;
            this.uvs[uIndex++] = v1;

            // Indices
            const offset = tileCount * 4;
            this.indices[iIndex++] = offset + 0;
            this.indices[iIndex++] = offset + 1;
            this.indices[iIndex++] = offset + 2;
            
            this.indices[iIndex++] = offset + 2;
            this.indices[iIndex++] = offset + 3;
            this.indices[iIndex++] = offset + 0;

            tileCount++;
        }

        // Update GPU Buffers
        (this.posBuffer as any).data = this.positions;
        (this.posBuffer as any).update(this.positions);

        (this.uvBuffer as any).data = this.uvs;
        (this.uvBuffer as any).update(this.uvs);

        (this.idxBuffer as any).data = this.indices;
        (this.idxBuffer as any).update(this.indices);
    }
}
