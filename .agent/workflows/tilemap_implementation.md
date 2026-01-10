---
description: Implement a fluid and fast Tilemap system in UliKit2D
---
# Tilemap Implementation Workflow

This workflow guides the implementation of a robust Tilemap system, favoring operability and speed over complex tooling initially.

## Phase 1: Data Structure & ECS
1.  **Define `Tilemap` Component in `ECS.ts`**:
    *   `tileSize: { x: number, y: number }`
    *   `width: number` (cols)
    *   `height: number` (rows)
    *   `layers: TileLayer[]` (Each layer is a simple array/map of tile IDs).
    *   `tilesets: Tileset[]` (Reference to texture sources).

2.  **Define Data Models**:
    *   `TileLayer`: Store map data. Array of integers (or objects if complex).
    *   `Tileset`: Texture path, tile size, margin, spacing.

## Phase 2: Rendering (MVP)
Since `@pixi/tilemap` is not installed, we start with a **Container-based approach**.
1.  **Refactor `RenderSystem`**:
    *   Detect entities with `Tilemap` component.
    *   Create a specific `Container` for the tilemap to keep it separated.
    *   **Optimization**: Use `PIXI.ParticleContainer` if tiles don't rotate/scale, OR standard `Container` with culling (if map is huge). For the MVP, standard Container is fine.
    *   **Chunking (Optional for MVP)**: If huge, split into 16x16 chunks.

## Phase 3: Editor Integration (The "Fluid" Part)
1.  **Tilemap Inspector**:
    *   Instead of a generic JSON editor, create a custom `TilemapEditor.vue`.
    *   Button: "Edit Tilemap" -> Enters **Tilemap Mode**.
2.  **Tilemap Mode (Scene View)**:
    *   Overlay a Grid.
    *   **Palette Panel**: Dockable or floating panel showing the Tileset.
    *   **Tools**: Paint (Brush), Eraser, Bucket (later).
    *   **Interaction**: Click/Drag on grid -> Update ECS Component Data -> Re-render.

## Phase 4: Collision
1.  **Physics Integration**:
    *   If `RigidBody` is attached to Tilemap, generate `BoxCollider`s for non-empty tiles.
    *   *Optimization*: Merge adjacent colliders (Greedy Meshing) to avoid physics stutter.

## Plan Implementation Steps

### Step 1: Core Data
- [ ] Update `ECS.ts` with `Tilemap` type.
- [ ] Create `TilesetManager` (or simple utility) to handle slicing textures.

### Step 2: Rendering System
- [ ] Create `TilemapSystem` (or add to `RenderSystem`) to render the data.
- [ ] Verify rendering of a hardcoded map.

### Step 3: Editor Logic
- [ ] Create `TilemapEditor.vue` component.
- [ ] Implement "Palette" selection logic.
- [ ] Implement Scene View mouse events for painting (Grid snapping).

### Step 4: Collision (Later)
- [ ] Implement collider generation.
