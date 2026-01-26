---
name: Asset Reactivity & Renaming
description: Guidelines and requirements for handling asset renaming and deletion to ensure system-wide consistency in UliKit2D.
---

# Asset Reactivity & Renaming Protocols

## Core Principle
When an asset is **Renamed** or **Moved**, the change must propagate immediately to all parts of the engine and editor. Silent breakage of references (broken images, missing sounds) is unacceptable.

## 1. Centralized Management
All asset operations must go through `ProjectManager` and `AssetDatabase`.
- **Renaming**: `ProjectManager.renameAsset(oldPath, newPath)`
- **Deletion**: `ProjectManager.deleteAsset(path)`

## 2. Reference Updates (The "Ripple Effect")
When an asset path changes, you must recursively check and update:
1.  **Scene Entities**:
    - Iterate all entities in the active scene.
    - Check components (`Sprite`, `AudioSource`, `Animator`, `NineSlice`, `Script`).
    - Update string paths (e.g., `sprite.texture = newPath`).
2.  **Asset Database**:
    - Update the `guid` mapping in `AssetDatabase` so the GUID remains stable but points to the new path.
3.  **Manifest**:
    - Save changes to `project.json` immediately.

## 3. UI Reactivity
The Editor UI must reflect changes instantly without requiring a reload.
- **Assets Panel**: Must show the new name/path immediately.
- **Inspectors**:
    - If an Entity is selected and its Sprite Texture was renamed, the Inspector must update the text field.
    - Use `key` re-rendering or reactive stores (`useUIStore`, `eventBus`) to force updates.
- **Other Panels**:
    - Hierarchy, Console, History, etc., must remain consistent.

## 4. Specific Component Checks
When implementing renaming, verify impact on:
- `SpriteEditor.vue` (Texture path)
- `AudioSourceEditor.vue` (Clip path)
- `AnimatorEditor.vue` (Frame paths in animations)
- `ScriptInspector.vue` (Script path)
- `Tilemap` (Tileset source paths)

## 5. Verification
Always verify:
1.  Rename a file (e.g., `player.png` -> `hero.png`).
2.  Check the Scene View: Does the player still have the texture?
3.  Check the Inspector: Does the field say `hero.png`?
4.  Check the FileSystem: Did the file actually move?
