---
description: Implement Layers Panel and System similar to GDevelop
---

# Layers System Implementation

## 1. Core Logic (Engine)
- [ ] **Update ECS Model**:
    - Add `layers` property to `Scene` data structure.
        - Structure: `{ id: string, name: string, visible: boolean, locked: boolean, color?: string }[]`.
    - Add `layerId` property to `Entity` (likely in `Transform` or root).
    - Default `Base Layer` (Background) created for all scenes.

- [ ] **Update SceneManager**:
    - Manage `layers` list (add, remove, reorder).
    - Handle serialization/deserialization of `layers`.
    - Ensure `Base Layer` always exists.

- [ ] **Update RenderSystem**:
    - Create a `Container` for each Layer in `PixiJS`.
    - Add these Containers to `app.stage` in current layer order.
    - When rendering entities, add them to their respective Layer Container instead of `app.stage`.
    - Handle `Layer` background color (PIXI.Graphics or similar for Base Layer).

## 2. Editor UI (LayersPanel)
- [ ] **Create LayersPanel.vue**:
    - List layers from `SceneManager`.
    - Support "Eye" toggle (visibility).
    - Support "Lock" toggle.
    - Support Drag & Drop reordering (using `vue-draggable-next` or similar if available, else custom).
    - "Add Layer" button.
    - Context Menu / Delete button for layers (except Base Layer).
    - Background Color picker for "Base Layer".

- [ ] **Integrate into DockLayout**:
    - Add `LayersPanel` to the default layout (tabbed with Hierarchy or Inspector).

## 3. Entity Inspector
- [ ] **Update Inspector**:
    - Add "Layer" dropdown selector to `Entity` properties.
    - Allow moving entities between layers.

## 4. Verification
- [ ] Verify rendering order changes when layers are reordered.
- [ ] Verify visibility toggle hides all entities in layer.
- [ ] Verify Background color changes.
- [ ] Verify persistence (Save/Load scene).
