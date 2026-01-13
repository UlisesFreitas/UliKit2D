# Session Log: 2026-01-05

## Summary
Focused on stabilizing the Web Editor workflow, specifically asset management and inspector reactivity.

## Changes Implemented

### 1. Dynamic Asset Loading (Web)
- **Refactoring `WebFileSystem.ts`**: Replaced hardcoded default asset handling with `import.meta.glob`. This ensures that any file added to `src/resources/default_assets` is automatically available in the Web Editor's virtual filesystem upon project creation.
- **Fixing Blob URL Handling**: Addressed PixiJS loading failures by identifying Blob URLs and passing explicit format hints (`format: 'png'`, `loadParser: 'loadTextures'`) to `Assets.load()`.
- **Created `RenderSystem.ts` helper**: Centralized texture loading logic in `loadTexture()` to ensure consistency.

### 2. Inspector Reactivity
- **Fixed "Broken Image" in Sprite Inspector**: Refactored `SpriteEditor.vue` to use `v-if="thumbnailUrl"` for reliable image rendering.
- **Fixed "Instant Update" Lag**: Addressed an issue where changing a texture didn't instantly update the Inspector thumbnail.
  - *Cause*: Vue's deep watcher wasn't reliably triggering on non-reactive prop mutations.
  - *Fix*: Implemented manual trigger of `updateThumbnail()` in `onSelectAsset` and `onDrop`.

### 3. Transform Synchronization
- **Fixed Inspector Update**: Resolved regression where moving/rotating entities via Gizmos didn't update the Inspector.
  - *Cause*: `TransformEditor.vue` received the same non-reactive object reference, causing Vue to skip re-renders.
  - *Fix*: Added `revision` prop to `TransformEditor` and passed parent's `revision` counter, forcing component re-render on every `entity-updated` event.
- **Fixed Rotation Sync**: Refactored `TransformEditor` to bypass `computed` property caching for rotation.
  - *Cause*: Computed property dependency tracking failed for non-reactive props even with revision trigger.
  - *Fix*: Switched to direct template binding with `:value`, ensuring rotation always reads from the latest transform state on re-render.
- **Fixed Web Script Execution**: Resolved `rotate.js` failing to run in Web Editor.
  - *Cause*: `ScriptSystem` was appending a cache-buster query parameter (`?t=...`) to Blob URLs. Browsers reject `import('blob:...?t=...')`.
  - *Fix*: Modified `ScriptSystem.ts` to skip cache-busting params for Blob URLs (which are natively unique per update).
- **Implemented Multi-Script Support**:
  - Refactored `ECS` to store scripts as an array.
  - Updated `ScriptSystem` to execute multiple scripts per entity.
  - Enhanced `ScriptEditor` to manage script list and execute `AssetPicker` for selection.
- **Fixed Script Introspection Errors (404)**: resolved `ScriptEditor` trying to fetch script properties via incorrect URLs in Web mode.
  - *Fix*: Switched to `getFileSystem().getAssetURL(path)` to correctly resolve Blob URLs.
- **Fixed Scene Serialization for Arrays**: Resolved `entity.script is not iterable` error after Stop/Play.
  - *Cause*: `SceneManager.saveScene` used `{ ...entity.script }` which converted the array to an object.
  - *Fix*: Updated serialization logic to use `[...entity.script]` (map clone).

### 4. Documentation
- Created `docs/` folder structure.
- Added `docs/vision.md` (Engine Vision).
- Added `docs/session_log_2026-01-05.md` (This file).

## Current Issues (Under Investigation)
- None.
