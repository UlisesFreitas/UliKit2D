# Phase 7 Logic Changes & Architectural Updates
> **Date**: 2026-01-24
> **Phase**: 7 (Core Gameplay & Architecture)

This document tracks the architectural decisions and logic refactors implemented during Phase 7.

## 1. Runtime Scene Loading Refactor
**Goal**: Enable asynchronous scene switching during runtime/play-mode while maintaining editor compatibility.

### Changes in `SceneManager.ts`
*   **Centralized Parsing**: The `loadScene` method was refactored to accept either a raw JSON string OR a pre-parsed Object. This allows reuse of the parsing logic (Layers, Entities, Defaults) from multiple sources.
*   **New API**: Added `loadSceneByPath(path: string)`.
    *   Uses `ResourceManager` (via dynamic import) to fetch the file content (supporting both Web/OPFS and likely Electron paths).
    *   Once fetched, delegates to `loadScene(data)` to perform the world rebuild.
    *   **Events**: Emits `scene-change-start` before loading and `scene-loaded` after completion.

**Why?**: Previous implementation duplicated parsing logic in `loadScene` and `loadSceneFromFile`. The explicit `loadSceneByPath` provides a clear, safe API for scripts (`SceneManager.loadSceneByPath(...)`).

## 2. Runtime Audio Mixer
**Goal**: Allow global control of volume based on channels (Music vs SFX) in addition to per-entity volume.

### Changes in `ECS.ts`
*   **Component Update**: Added optional `channel?: string` property to `AudioSource` component. Defaults to 'SFX' if undefined in logic.

### Changes in `AudioSystem.ts`
*   **Settings State**: Added internal state for `masterVolume` and `channels` (Music/SFX) configuration.
*   **Multiplier Logic**: When playing a clip, the final volume is calculated as: `EntityVolume * MasterVolume * ChannelVolume`.
*   **Updates**: Added `setSettings(settings)` method to update configuration dynamically (linked to `ProjectSettingsStore`).

### Changes in Editor
*   **Inspector**: Updated `AudioSourceEditor.vue` to allow selecting "Music" or "SFX" channel.
*   **Store**: `useProjectSettingsStore` now propagates audio settings to `engine.audioSystem` whenever they change.

## 3. Global Game State (Persistence)
**Goal**: Provide a mechanism to store data that survives `SceneManager.loadScene()` (which clears the World).

### New `GameManager.ts`
*   **Singleton**: Created `GameManager` class.
*   **Exposed Global**: Exposed as `window.Game` for easy access in scripts.
*   **API**:
    *   `Game.set(key, value)`
    *   `Game.get(key)`
*   **Integration**: Initialized in `Engine.ts` constructor to ensure availability before any scene loads.

## 4. Updates to "Pending Features"
Reference to `docs/pending_features.md`:
*   **Input Manager**: COMPLETED (Phase 7).
*   **Physics Shapes**: COMPLETED (Polygon/Circle added previously).
*   **Z-Index**: COMPLETED (via `transform.zIndex` sorting in RenderSystem).
*   **Scene Switching**: COMPLETED (via `loadSceneByPath`).

Next major pending system from that list is effectively "Advanced Layer Manager" and "Prefab System".
