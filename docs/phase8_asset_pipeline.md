# Asset Pipeline 2.0 (Phase 8 Change Log)

**Date:** 2026-01-29
**Author:** UliKit2D Team (Antigravity)
**Context:** This document explains the architectural shift executed during **Phase 8** of the development plan (`plan.json`).

---

## 🏗️ The Problem: Why we rewrote the Asset System

In the early versions (pre-Phase 8), the editor relied on **File System Watchers** (Chokidar) as the primary source of truth.
*   **The Issue:** When the editor opened, it had to scan thousands of files recursively.
*   **The Risk:** Modifying a file externally, or renaming it, caused "desyncs" where the Entity Component System (ECS) would lose references to sprites or audio files because they were linked by raw paths that changed.
*   **Performance:** Constant disk polling is heavy for large projects.

## 🚀 The Solution: Manifest-Based Architecture

We moved to a **Data-Driven Approach** inspired by engines like GDevelop and Godot (resource mapping).

### 1. `project.json` as the Single Source of Truth
Instead of trusting the disk blindly, we now have a `project.json` file that explicitly lists every asset the project *knows about*.

```json
{
  "resources": [
    { "name": "hero.png", "path": "assets/sprites/hero.png", "type": "image", "kind": "file" },
    { "name": "level1.json", "path": "assets/maps/level1.json", "type": "tilemap", "kind": "file" }
  ]
}
```

### 2. The New Managers
*   **`ProjectManifestManager.ts`**: The "Boss". It loads `project.json` into memory. It is the **only** class allowed to save to disk. It handles the `IProjectManifest` interface.
*   **`AssetDatabase.ts`**: A "dumb" cache. It no longer scans the disk on startup. Instead, `ProjectManifestManager` **hydrates** it with the list from the manifest. This makes startup instant.

### 3. Workflow Changes

#### Import (Drag & Drop)
When you drop a file into `AssetsPanel`:
1.  **UI:** `AssetsPanel.vue` (via `AssetsContent.vue`) captures the `drop` event.
2.  **Logic:** Calls `ProjectManager.importAssets()`.
3.  **Action:** The file is copied to the `assets/` folder physically.
4.  **Registration:** The file is **added to the manifest**. If it's not in the manifest, the engine doesn't see it (even if it exists on disk).

#### Renaming
Renaming is no longer just `fs.rename`.
1.  **Check:** We verified the asset exists in the Manifest.
2.  **Rename:** We rename the physical file.
3.  **Update Manifest:** We update the record in `project.json`.
4.  **Update References (Future):** This architecture allows us to implement "Smart Rename" later (updating `.scene` files that use "hero.png" to "hero_v2.png" automatically).

#### Multi-Selection
We refactored `AssetsPanel.vue` to support `Set<string>` for selection instead of a single string.
*   **Shift + Click:** Selects a range.
*   **Ctrl + Click:** Toggles selection.
*   **Batch Delete:** Iterates the selection and calls `ProjectManager.deleteAsset` for each, updating the manifest in batch.

## 🧠 Note to Future Self

If you are reading this because assets are not showing up:
1.  Check `project.json`. Is the file listed in `"resources"`?
2.  If you manually added a file to the folder via Windows Explorer, it won't show up until you "Import" it or we implement a "Re-scan/Sync" button (which we intentionally avoided for performance).
3.  **The Editor is the Source of Truth**, not the File Explorer.

---

## Files Touched
*   `src/editor/managers/ProjectManifestManager.ts` (Created)
*   `src/editor/managers/ProjectManager.ts` (Heavily Refactored to use Manifest)
*   `src/editor/managers/AssetDatabase.ts` (Simplified to Cache)
*   `src/editor/panels/AssetsPanel.vue` (UI overhaul for interactions)
