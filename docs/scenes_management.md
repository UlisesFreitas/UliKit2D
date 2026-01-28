# Scene Management Architecture

> **Architecture Style:** Hybrid Strict
> **Source of Truth:** `project.json` (The Manifest)

## Core Philosophy

1.  **The Manifest is King:** If a scene is not listed in `project.json` -> `scenes` array, it does not exist in the engine, even if the `.json` file exists on disk.
2.  **Separate Files:** Scene data (entities, components) is stored in individual JSON files (e.g., `assets/scenes/Level1.json`) to allow scalability and avoid monolithic blobs.
3.  **UI reflects Manifest:** The `ScenesPanel` MUST NOT list files from disk. It MUST iterate `useProjectStore().scenes`.

## Key Components

### 1. ProjectManifestManager (`src/editor/managers/ProjectManifestManager.ts`)
- **Responsibility:** Manages the in-memory representation of `project.json`.
- **Methods:** `addScene`, `removeScene`, `renameScene`.
- **Persistence:** `saveProject()` writes the entire manifest to disk.

### 2. useProjectStore (`src/stores/useProjectStore.ts`)
- **Responsibility:** Provides a reactive interface for Vue components.
- **Computed:** `scenes` (The list the UI should render).
- **Actions:** Wraps ManifestManager calls and triggers reactivity updates.

### 3. ScenesPanel (`src/editor/panels/ScenesPanel.vue`)
- **Responsibility:** User Interface.
- **Rules:**
    - **Display:** `v-for="scene in projectStore.scenes"`
    - **Create:** Calls `projectStore.addScene(...)` + `fs.writeFile(...)`.
    - **Rename:** Calls `projectStore.renameScene(...)` + `fs.rename(...)`.

## Workflows

### Creating a Scene
1.  User clicks "+ New".
2.  `ScenesPanel` generates defaults (`NewScene.json`).
3.  Writes `NewScene.json` to disk.
4.  Calls `projectStore.addScene('NewScene', 'assets/scenes/NewScene.json')`.
5.  Calls `ProjectManifestManager.saveProject()` to persist the registry entry.

### Renaming a Scene
1.  User renames `Level1` -> `Level2`.
2.  Move file: `fs.rename('.../Level1.json', '.../Level2.json')`.
3.  Update Manifest: `projectStore.renameScene('.../Level1.json', 'Level2', '.../Level2.json')`.
4.  Save Manifest: `ProjectManifestManager.saveProject()`.

## Common Pitfalls
- **Ghost Scenes:** Occur if `fs.readdir` is used. **NEVER** use `readdir` for scenes.
- **Desync:** Occurs if you write the file but forget to call `addScene` (or save the manifest).
