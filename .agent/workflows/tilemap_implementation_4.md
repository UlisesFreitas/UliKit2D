---
description: Review and Fix Tilemap System for Immortal Canvas Architecture
---

# Tilemap Implementation 4: Immortal Canvas Fixes & Improvements

The switch to "Immortal Canvas" (Shared PixiJS Context) has disrupted the Tilemap system, likely due to Coordinate System mismatches (Panel Local vs Global Stage) and Event Handling.

## 1. Analysis & Diagnosis
- **Major Architecture Conflict**:
    - `RenderSystem.ts` (lines 167-243) contains legacy logic to render Tiles via `Sprite`.
    - `EditorTilemapSystem.ts` contains improved logic using `TilemapChunk`.
    - Both run simultaneously? `EditorTilemapSystem` creates a separate `rootContainer` (zIndex=1).
- **Result**:
    - Tiles might render twice.
    - Z-Sorting is broken (All tiles are in one monolithic container, separate from Entities).
    - "Layer 1 Entities" might be hidden by "Layer 2 Tiles" or vice-versa incorrectly.

## 2. Rendering Fixes (Consolidation)
- [ ] **Disable Legacy Tile Rendering**: Remove `updateLayerTiles` from `RenderSystem.ts` to stop standard Sprite-based rendering.
- [ ] **Integrate Tilemaps into Layers**:
    - Modify `EditorTilemapSystem.ts` to **NOT** use a `rootContainer`.
    - Instead, access `RenderSystem.layerContainers` (it's public).
    - For each layer, inject the `TilemapChunk` keys/container into the corresponding `RenderSystem` Layer Container.
    - Set `zIndex = -1` (or appropriate) to ensure Tiles sit behind Entities *within that layer*.
- [ ] **Z-Index**: Ensure `RenderSystem` sortableChildren includes these injected Tilemap containers.

## 3. Interaction Fixes
- [ ] **Mouse Coordinates**:
    - `ScenePanel` mouse events are relative to the DOM element.
    - PixiJS Stage is global (0,0 at Window Top-Left).
    - Need to ensure `paintTile` converts `(DOM Mouse) -> (Stage Mouse) -> (World Space)`.
- [ ] **Highlight**: Fix the red/green highlight box (it might be drawing in Screen Space but assuming Panel Space).

## 4. Improvements
- [ ] **Optimized Re-draw**: Ensure we don't rebuild the entire mesh on every single tile click. (already implemented in v3? Check).
- [ ] **Layer Visibility**: Integrate with `SceneManager` visibility toggles.
- [ ] **Eraser Visuals**: Improve the visual feedback for the Eraser tool.
