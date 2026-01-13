# Plan: Core Engine Reactivity & Stability Overhaul
> [!IMPORTANT]
> This plan addresses critical stability issues reported by the user: Layer desync, Scene duplication, Ghost components, and UI lag.
> **Priority**: Critical. Functional stability takes precedence over new features.

## 1. Scene Panel & Pixi Persistence (The "Never Close" Rule)
**Problem**: User can close the Scene Panel (destroying the Canvas/Context). Pixi/Engine lifecycle is hard-tied to this DOM element.
**Fix**:
- [ ] **DockLayout Config**: set `closable: false` for the `ScenePanel` tab configuration in `DockLayout.vue` or `defaultLayout.ts`.
- [ ] **Lifecycle Safety**: Ensure `ScenePanel` `onUnmounted` handles cleanup gracefully, but prevents accidental destruction if possible via UI.

## 2. Editor-Engine Reactivity (Layer & Painting Desync)
**Problem**:
- Switching layers logic is fragile. Painting stops working after layer switch or Play/Stop.
- Eraser lags or batch-deletes (likely Event Loop starvation or State desync).
- **Hypothesis**: `EditorTilemapSystem` holds a reference to `activeLayerId` that becomes stale, or `SceneManager` updates don't propagate to `ref`s used by input handling.
**Fix**:
- [ ] **Single Source of Truth**: Refactor `SceneManager` to emit events (`layer-changed`, `scene-loaded`) via `EventBus`.
- [ ] **Reactive Systems**: Make `EditorTilemapSystem` listen strictly to `EventBus` or directly query `EditorStore.activeLayerId` every frame/action, ensuring no stale local state.
- [ ] **Play/Stop Reset**: On "Stop Game", force a full functionality re-bind. Ensure `InputManager` and `GizmoManager` re-acquire correct contexts.

## 3. Scene Management Madness (Duplication & Loading)
**Problem**: `NewScene` saves but re-opens as `Untitled` + `NewScene`. Duplicate data.
**Fix**:
- [ ] **ProjectManager Audit**: Review `loadProject` and `saveScene`.
- [ ] **ID Consistency**: Ensure Scene IDs are persistent and used for file mapping. If loading "SceneA.json", the Scene object must have ID "SceneA" (or mapped correctly), not generate a new UUID.
- [ ] **Clean Boot**: When opening a project, `SceneManager` must `clear()` completely before loading the JSON.

## 4. Component Ghosts & Stability
**Problem**:
- "Physics" component (internal system tag?) appearing in Inspector.
- Components disappearing randomly.
**Fix**:
- [ ] **Inspector Filtering**: In `InspectorPanel.vue`, filter out internal technical components (like `transform` if handled separately, or debug tags like `PhysicsBodyRef`).
- [ ] **Serialization Check**: Verify `toJSON()` in ECS. Ensure all components are saved.
- [ ] **Deserialization Check**: Verify `loadScene`. Ensure `addComponent` isn't failing silently for specific types during load.

## 5. Tilemap/Painter Optimization
**Problem**: Eraser lag.
**Fix**:
- [ ] **Input Handling**: Check `pointerdown` vs `pointermove` logic in `ScenePanel` and `EditorTilemapSystem`.
- [ ] **Dirty Rect**: Ensure we aren't rebuilding the whole collider/mesh on every single tile erasure. Batch updates or throttle expensive collider regenerations.

## Execution Order
1.  **UI Hardening**: Fix Scene Panel closing (Quick Win).
2.  **Scene Management**: Fix loading duplication (Critical Data integrity).
3.  **Engine Reactivity**: Fix Painting/Layer switching (Critical Workflow).
4.  **Inspector Polish**: Hide ghosts.
