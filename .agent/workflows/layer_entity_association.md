---
description: Implement robust Layer-Entity association and z-sorting
---
# Layer-Entity Association Workflow

This workflow guides the refactoring of the engine to establish a strict relationship between Layers and Entities, ensuring correct rendering order and visibility control, mimicking GDevelop's architecture.

## 1. Refactor SceneManager (Registry)
The `SceneManager` or a new `LayerManager` should maintain a registry of which entities belong to which layer.

1.  Modify `SceneLayer` interface (or a parallel structure) to hold a Set/List of Entity IDs: `activeEntities: Set<string>`.
2.  Update `SceneManager.addEntityToLayer(entityId, layerId)`:
    *   Remove from previous layer registry.
    *   Add to new layer registry.
    *   Update `Entity.layer` property (Single Source of Truth is the ECS, but Registry is for fast access).

## 2. Refactor Entity & Transform
Reference: User mentioned `Transform` might have obsolete layer logic.
1.  Check `Entity` type in `ECS.ts`. Ensure `layer` is the definitive property.
2.  **Transform Component**:
    *   Ensure `Transform` does NOT strictly dictate "Layer" logic anymore if it was duplicated.
    *   Add or verify `zIndex` (or `zOrder`) in `Transform`. This allows sorting *within* a layer.
    *   *Decision*: `Layer` determines the container (big sort). `zIndex` determines order *inside* that container.

## 3. Update RenderSystem
Current logic relies on `world.with('transform')` and then checking `entity.layer` every frame or on change. Optimizing this:

1.  **Container Management**: Ensure `layerContainers` are synced with `SceneManager.layers`.
2.  **Entity Addition**: When an entity is created/loaded, add it to the correct `Container` immediately.
3.  **Visibility**:
    *   Layer Visibility: `container.visible = layer.visible`. (Already mostly done).
    *   Entity Visibility: `entity.visible` should simply toggle the object inside the container.
    *   *Optimization*: If Layer is hidden, we technically don't need to process updates for its entities, but keeping `container.visible = false` is efficiently handled by Pixi.

## 4. Implementation Steps

### Step 4.1: Update ECS and Transform
- [ ] Open `src/engine/ecs/ECS.ts`.
- [ ] Verify `Entity` has `layer: string` and `transform: { ... zIndex: number }`.
- [ ] If `zIndex` is missing, add it.

### Step 4.2: Update SceneManager
- [ ] Open `src/engine/managers/SceneManager.ts`.
- [ ] Add `moveEntityToLayer(entityId: string, targetLayerId: string)` method.
- [ ] Ensure `SceneLayer` structure can support tracking count (optional, good for UI "Layer (5 items)").

### Step 4.3: Refactor RenderSystem
- [ ] Open `src/engine/systems/RenderSystem.ts`.
- [ ] Ensure `zIndex` from Transform is applied to the Pixi Child: `sprite.zIndex = transform.zIndex`.
- [ ] Ensure `sortableChildren = true` is set on Layer Containers.

### Step 4.4: Verify in Editor
- [ ] Create distinct layers.
- [ ] Move entities between them.
- [ ] Toggle visibility of Layer -> All entities in it should hide.
