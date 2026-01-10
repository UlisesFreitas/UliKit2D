---
description: Optimize Tilemap Rendering using Custom Mesh / Chunks to support large maps.
---

# Optimized Tilemap Rendering (Mesh-based)

This workflow replaces the naive "One Sprite Per Tile" approach (which chokes at ~2000 tiles) with a **Mesh-based approach** (capable of 100,000+ tiles).

> **Why Custom Mesh?** 
> PixiJS v8 changed the plugin architecture significantly. Instead of relying on external plugins like `@pixi/tilemap` (which might be unstable or incompatible), we can implement a highly efficient **Quad Mesh** using core Pixi APIs. It gives us full control and 0 extra dependencies.

## Phase 1: The Render Chunk System

To avoid rebuilding the entire map when changing 1 tile, we divide the map into **Chunks**.

1.  **Define Chunk Size:** `16 x 16` tiles (or 32x32).
2.  **Chunk Manager:**
    -   Calculates which Chunk a tile belongs to: `cx = floor(gx / 16), cy = floor(gy / 16)`.
    -   Stores a `Map<chunkKey, PixiMesh>` for each Layer.
    -   `chunkKey = "cx,cy"`.

## Phase 2: Implementation of `TilemapMesh`

Create a class `TilemapMesh` that extends `Container` (or holds a `Mesh`).

### Data Structures
-   **Vertices Buffer (`Float32Array`):** 4 sets of x,y per tile.
-   **UVs Buffer (`Float32Array`):** 4 sets of u,v per tile (mapped to tileset).
-   **Indices Buffer (`Uint16Array`/`Uint32Array`):** 6 indices per tile (0,1,2, 2,3,0).

### logic
1.  **`build(tileData)`**:
    -   Iterate tileData for this chunk.
    -   Calculate `u, v` based on tile ID and Tileset Texture size.
    -   Calculate `x, y` relative to Chunk Origin.
    -   Fill buffers.
    -   Update `this.mesh.geometry`.

2.  **`markDirty()`**: 
    -   Rebuilds the mesh on next `update()`.

## Phase 3: Integration into `EditorTilemapSystem`

Refactor `EditorTilemapSystem.ts`:

1.  **Remove** the `Sprite` creation loop.
2.  **Maintain** a cache of `TilemapMesh` objects per Layer + Chunk.
3.  **Update Loop**:
    -   Check `layer.dirty`.
    -   Identify which Chunks changed (or rebuild all if naive).
    -   Call `chunk.rebuild()`.
    -   Culling: Hide chunks outside `camera` bounds (optional, Pixi handles generic culling well if bounds are set).

## Phase 4: Collision Optimization (Spatial Hash)

(Optional but recommended for performance)
-   Do not iterate all 10,000 tiles for physics.
-   Only generate bodies for tiles near the player (or use a Spatial Hash grid).

## Execution Steps

### Step 1: Create `TilemapChunk.ts`
-   Class handling geometry generation for a sub-section of the map.
-   Uses `new Mesh(geometry, shader)`.

### Step 2: Refactor `EditorTilemapSystem.ts`
-   Switch from `renderLayer` (Sprites) to `renderLayerChunks` (Meshes).
-   Handle `texture` updates (if tileset changes, rebuild all UVs).

### Step 3: Verification
-   Paint 50x50 area (2500 tiles).
-   Check FPS (Should stay at 60).
-   Check Draw Calls (Should be low).
