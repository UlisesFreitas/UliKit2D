---
description: Comprehensive workflow to fix Entity Selection and Coordinate Systems
---

# Fix Selection & Interaction Workflow

This workflow guides the refactoring of the Selection System to be robust and industry-standard.

## 1. Diagnostics & Coordinate Space
1.  [ ] **Analyze Scene Structure**: Determine if `stage` is the world or if there is a `worldContainer`.
2.  [ ] **Coordinate Check**: Verify `CoordinateUtils.screenToWorld` logic.
    *   *Task*: Create a script to log `Mouse(Global)` vs `Stage.toLocal(Global)`.

## 2. Selection Manager (The Core)
1.  [ ] **Create Manager**: Ensure `src/editor/managers/SelectionManager.ts` exists.
2.  [ ] **Implement `pickEntity`**:
    *   Get all `transform` entities.
    *   Sort by `zIndex` (Descending).
    *   Filter `visible=true`.
    *   **Crucial**: Check `Layer` visibility/locking.
    *   Perform `RenderSystem.getDisplayObject(id).containsPoint(globalPos)`.

## 3. Visual Fixes (RenderSystem)
1.  [ ] **Camera Icons**: Ensure Camera Icon is in `EditorOverlay` container (Z=9999).
2.  [ ] **Physics Debug**: Ensure Physics Debug Graphics are toggleable and `interactive=false` (unless debugging selection).
3.  [ ] **Tilemaps**: Ensure Tilemap Containers have `interactive=true` or are considered in `SelectionManager`.

## 4. Input Integration (ScenePanel)
1.  [ ] **Refactor Handler**: Replace manual loop in `ScenePanel.onPointerDown` with `SelectionManager.pickEntity`.
2.  [ ] **Gizmo Integration**: Ensure Gizmos don't block clicks if they are "transparent" (e.g. Camera Box).

## 5. Verification
1.  [ ] **Browser Test**:
    *   Select Camera (Icon).
    *   Select Sprite (transformed).
    *   Select overlap.
    *   Verify Coordinate logs match expectation.
