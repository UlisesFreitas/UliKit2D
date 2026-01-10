---
description: Refactor Tilemap system to integrate directly into Scene Layers (RPG Maker style)
---

# Integral Tilemap System (Layer = Tilemap)

This workflow implements a fundamental architectural change: **Tiles are intrinsic to Layers**, not separate Entities.
This simplifies the UX: Users selects a Layer and paints. No "Tilemap Entity" creation needed.

## Phase 1: Data Structure Refactor

1.  **Modify `SceneLayer` Interface** (`SceneManager.ts`)
    -   Add `tileData`: `Map<string, number>` (key: `x,y`, value: `tileId`) or a flat array for the grid.
    -   Add `tilesetId`: `string` (The tileset used by this layer).
    -   Add `gridSize`: `{x, y}` (e.g., 32x32).
    -   *Logic:* Each layer essentially becomes a sparse matrix of tiles.

2.  **Update `SceneManager` Serialization**
    -   Ensure `tileData` is saved/loaded with the Layer definition in the JSON.
    -   Remove the old `Tilemap` component serialization if it's no longer used, or keep it for "Prop" tilemaps (optional).

## Phase 2: Render System Update

1.  **Update `RenderSystem`**
    -   Instead of iterating `World` for `Tilemap` components, iterating `SceneManager.layers`.
    -   For each Layer:
        -   Render its `tileData` (create/update PixiJS Container/ParticleContainer).
        -   Render the Entities assigned to that layer *on top* or *integrated* (depending on Z-sorting needs, usually Entities float above the floor tiles of the same layer).

2.  **Optimize**
    -   Use `Pixi.Tilemap` or a custom mesh shader for rendering layers efficiently.
    -   Ensure rebuilding the layer mesh only occurs when `tileData` changes (dirty flag).

## Phase 3: Editor UX (The "Paint" Flow)

1.  **Global Edit Mode**
    -   Remove "Edit Tilemap" button on entities.
    -   The "Paint" tool is always available in the Toolbar.
    -   When "Paint" tool is active, clicking on Scene writes to the **Active Layer**.

2.  **Tileset Palette**
    -   The Palette selects the `activeTileset` for the **Current Layer**.
    -   Changing the tileset in the palette updates the `SceneLayer.tilesetId`.

3.  **Input Handling**
    -   `ScenePanel` listens for clicks.
    -   Converts Screen -> World -> Grid Coords.
    -   Writes to `SceneManager.layers[activeLayerIndex].tileData`.

## Phase 4: Collision & Physics (Future)

1.  **Layer Collision**
    -   Add a `collision` boolean to `SceneLayer`.
    -   If true, generate static bodies for all non-empty tiles in that layer.

## Execution Steps

### Step 1: Data Model
```typescript
// Modify SceneManager.ts
export interface SceneLayer {
    // ... existing
    type: 'default' | 'tilemap'; // optional distinction?
    tileset?: string; // Path/Id
    gridSize?: { x: number, y: number };
    data?: Record<string, number>; // Sparse map "x,y": tileId
}
```

### Step 2: Editor State
Update `useTilemapStore` to track `selectedTileId` globally, but remove "Entity Binding". It binds to `SceneManager.activeLayer`.

### Step 3: Renderer
Rewrite `RenderSystem.updateTilemap` to `RenderSystem.renderLayers()`.
