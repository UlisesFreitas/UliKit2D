---
description: Refactor Scene Management to ensure robust persistence, manifest synchronization, and correct UI state.
---

# Scene Management Refactor Plan

## Goal
Ensure that Scenes are correctly created, saved, renamed, and loaded, maintaining perfect synchronization between:
1.  **The Manifest** (`project.json`): The Source of Truth for the list of scenes.
2.  **The SceneManager**: The active runtime state.
3.  **The UI** (`ScenesPanel`): The user's view.

## Current Issues
- `NewScene` created by Factory is not appearing in `ScenesPanel`.
- Renaming a scene (`NewScene` -> `Main`) and saving results in duplicate/ghost scenes on reload (`NewScene` + `Untitled`).
- `ScenesPanel` likely accessing stale data or not reacting to Manifest changes.

## Step-by-Step Implementation

### 1. Unified Source of Truth (Manifest)
- [ ] **Audit `ProjectManifestManager`**: Ensure it exposes a reactive `scenes` list or that the Store does.
- [ ] **Refactor `ScenesPanel`**: It must consume the *Manifest's* scene list, not a local or disconnected list.

### 2. Scene Lifecycle Fixes
- [ ] **Creation (`ProjectFactory`)**: verify `project.json` correctly lists the initial scene.
- [ ] **Loading (`ProjectManager`)**:
    - Ensure `ProjectManifestManager` is fully reloaded *after* Factory creation.
    - Ensure `ScenesPanel` refreshes its list immediately after load.
- [ ] **Saving (`SceneManager`)**:
    - When saving a scene, check if it exists in Manifest.
    - If new (or renamed), UPDATE the Manifest entry (Path/Name/ID).
    - If renamed, remove the old entry (or update it) to prevent duplicates.
    - Write `project.json` immediately after saving the scene file to keep them in sync.

### 3. Renaming Logic
- [ ] **Implement robust renaming**:
    - Update `SceneLayer` (Active Scene Name).
    - Rename File on Disk.
    - Update Manifest Entry.
    - Update Tab/UI.
    - Delete old file if name changed significantly (or just move).

### 4. Verification
- [ ] **Test**: Create Project -> Check Scenes Panel (Must show NewScene).
- [ ] **Test**: Rename `NewScene` -> `Level1` -> Save -> Reload. (Must show only `Level1`).
