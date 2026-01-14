---
description: Implement "Immortal Pixi Canvas" architecture where the Game Engine renders to a persistent background layer, decoupling it from the transient ScenePanel.
---

# Immortal Pixi Canvas Workflow

This workflow refactors the application to host the PixiJS rendering context in the root layout, preventing context loss when panels are closed or moved, and ensuring a stable, always-active game view.

## 1. Prepare Root Layout (`DockLayout.vue`)
- [ ] **Add Canvas Container**: Insert a `<div id="pixi-root" class="absolute inset-0 z-0"></div>` in `DockLayout.vue` *behind* the Dockview container (`z-index: 1`).
- [ ] **Initialize Engine Root**: Move the `Engine.init()` and `app.init()` calls from `ScenePanel.vue` to `DockLayout.vue`'s `onMounted`.
- [ ] **Handle Resize**: Ensure the Pixi Application resizes to fill the *entire* window (or the `DockLayout` container), not just a panel.

## 2. Refactor `ScenePanel.vue` (The "Window")
- [ ] **Remove Canvas**: Delete the `<canvas>` element and local Engine initialization logic from `ScenePanel.vue`.
- [ ] **Make Transparent**: Set the `ScenePanel` background to `transparent` so the underlying "Immortal Canvas" is visible through it.
- [ ] **Input Proxy**: Keep `onMouseDown`, `onWheel`, etc., in `ScenePanel` but map these events to the Engine, accounting for the panel's screen offset if necessary (or simply pass through if the Engine handles global input).

## 3. Viewport & Camera Logic
- [ ] **Viewport Awareness**: The Engine is now full-screen. To prevent the game from looking "stretched" or hidden behind other panels, we need a mechanism to tell the Camera *where* the "Scene View" is.
- [ ] **Sync Scene Rect**: In `ScenePanel.vue`, use `ResizeObserver` to detect the panel's position and dimensions. Send this `Rect` (x, y, width, height) to the `CameraSystem` or `RenderSystem`.
- [ ] **Update Camera Matrix**: Adjust the Camera's projection or viewport to render the game world centered/clipped within the `ScenePanel`'s area, while the actual WebGL context remains full-screen.

## 4. Input & Coordinate Correction
- [ ] **Global vs Local**: Since the canvas is `0,0` at Window Top-Left:
    - `e.clientX/Y` is now native Canvas Space.
    - We no longer need complex offsets relative to the `ScenePanel` *unless* we are emulating a viewport.
    - If strictly "Full Screen Background" mode: Mouse coordinates work naturally.
    - If "Viewport" mode: Subtract `Panel.x`, `Panel.y` from mouse events to get "Scene Relative" coordinates for logic that expects them.

## 5. Cleanup & Verification
- [ ] **Verify Persistence**: Close the "Scene" panel. The game view should still be visible (as the background) or at least the Context shouldn't crash.
- [ ] **Verify Re-opening**: Re-opening "Scene" panel should basically just open a "Transparent Window" back onto the existing game world.
- [ ] **Check Gizmos**: Ensure Gizmos (which render to the Pixi Stage) align correctly with the new coordinate system.
