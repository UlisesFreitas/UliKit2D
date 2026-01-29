# Phase 9: UI Polish & Scene Management Hardening

This document aggregates the changes, fixes, and architectural learnings from Phase 9 (Inspector Overhaul, Hierarchy Sorting, and Scene Logic).

## 1. Hierarchy Sorting & Stability
**Problem**: Entities were jumping around or failing to persist their order because the engine relied on the internal `Set` iteration order of the ECS, effectively treating `sortIndex` as second-class.
**Solution**:
- **Strict Normalization**: The `createEntity` function now performs a "Clean Sweep" of all existing entities (0..N) before adding a new one. This guarantees `sortIndex` is always contiguous and dense.
- **Render-Side Sort**: The `HierarchyPanel` explicitly sorts the list by `sortIndex` before rendering, ignoring the internal ECS order.
- **Self-Healing**: On drag-drop, the list is re-indexed completely.

## 2. Scene Logic & Persistence
**Problem**: 
- Creating a scene ("SceneA") and then renaming it or duplicating it caused issues like "SceneA_Copy" not being active, or "Untitled Scene" appearing if deletion was slightly off.
- Loading a project sometimes warned "Loading scene WITHOUT Templates", leading to potential layer ID collisions.

**Solution**:
- **Project Loading Order**: We now explicitly sync `ProjectSettings.layers` to `SceneManager` **BEFORE** loading the initial scene. This ensures the SceneManager has the correct Layer IDs/Names to map the incoming JSON data against.
- **Header Reactivity**: The Hierarchy Panel header now listens to a specific `active-scene-changed` event from `SceneManager`, ensuring it updates immediately upon rename.
- **Smart Duplication**: Added Regex logic to identifying `_Copy` patterns to generate `_Copy_1`, `_Copy_2` etc.
- **Safe Deletion**: Deletion now pre-calculates a fallback scene to switch to, preventing the engine from dropping into an invalid "Untitled" state.

## 3. Asset Pipeline (Phase 8/9 overlap)
- **Import**: Drag-and-drop now correctly copies files to `assets/` and updates the `ProjectManifest`.
- **Reference Tracking**: Deleting an asset now performs a "Deep Cleanup", scanning the active scene for any components (Sprite, Audio, Script) using that asset and breaking the link to prevent runtime 404s.

## 4. UI Polish
- **Layers Panel**: Added Drag-and-Drop layer sorting.
- **Inspector**: Hidden `LayerIndex` (managed by system).
- **Assets Panel**: Persists Zoom level and Sort Order.

---

# 🧠 Note to Future Self

### 1. Initialization Order is Critical
When loading a project, you **MUST** initialize the environment (Settings, Layers, Templates) **BEFORE** loading data (Scenes, Entities).
*   **Wrong**: Load Project -> Load Scene -> Read Settings.
*   **Right**: Load Project -> Read Settings -> Apply Layers to Manager -> Load Scene.
*   *Why?* If you load the scene first, it doesn't know that "Layer 1" is actually "Background", and might create a duplicate "Layer 1" or fail to link entities correctly.

### 2. Explicit Sort vs Implicit Order
Never rely on `Array.push` or `Set` iteration order for UI lists that matter. Always use an explicit `sortIndex` property and normalize it frequently (e.g., on creation or reorder). Gaps in indices (`0, 10, 20`) are fine for storage but can cause UI insertion bugs. Dense indices (`0, 1, 2`) are safer for "Add to End" logic.

### 3. Reactivity Chains
If A updates B, and C observes B, ensure B emits an event if C isn't using a deep watcher.
*   *Example*: `SceneManager.activeSceneName` (setter) -> Emits `active-scene-changed` -> `HierarchyPanel` (listener) updates Header.
*   Without the event, the UI might be one tick behind or require a manual refresh.

### 4. Manifest vs Disk Truth
The `ProjectManifest` (project.json) is the **Logical Truth**. The File System is the **Physical Truth**.
*   Always keep them in sync.
*   If you delete a file, update the Manifest immediately.
*   If you rename a file, update the Manifest immediately.
*   Run "Self-Healing" checks on startup to remove Manifest entries for missing files (Ghost Scenes).
