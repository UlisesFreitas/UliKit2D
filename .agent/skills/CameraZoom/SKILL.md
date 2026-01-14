---
name: CameraZoom
description: Expert knowledge on UliKit2D Camera Zoom, Coordinate Systems, and Immortal Canvas Architecture.
---

# Camera Zoom & Coordinate System Mastery

This skill documents the critical architecture and logic required to handle Camera Zoom, Panning, and Coordinate Transformations in the UliKit2D Engine, specifically under the "Immortal Canvas" paradigm.

## Core Architecture: Immortal Canvas

In UliKit2D, the PixiJS `Application` and `Canvas` are **Global** ("Immortal").
*   The Canvas covers the entire window (`fixed inset-0`).
*   The Canvas `(0,0)` is always the Window's Top-Left corner.
*   Panels (like `ScenePanel`) are transparent overlays that sit *on top* of the canvas.

### The Coordinate Trap (Drift Issue)
A common mistake is calculating mouse position relative to the `ScenePanel` container:
```typescript
// ❌ WRONG: Causes Drift & "Crazy" Coordinates
const rect = container.getBoundingClientRect();
const mouseX = e.clientX - rect.left; // Becomes Local
```
Since the `Camera` (Stage) is Global, mixing **Local Input Coordinates** with **Global Camera Coordinates** results in catastrophic math errors (exponential drift) when ensuring "Zoom Towards Point".

### The Golden Rule: Global Mouse
**ALWAYS** use Global Screen Coordinates for input handling when manipulating the Camera.
```typescript
// ✅ CORRECT: Matches Global Stage (0,0)
const mouseX = e.clientX;
const mouseY = e.clientY;
```

## Zoom Logic Implementation

### 1. Zoom Towards Point Algorithm
To zoom in/out while keeping the point under the mouse stationary:
```typescript
// 1. Calculate World Point BEFORE Zoom
// worldX = (ScreenMouse - CameraX) / OldZoom
const worldX = (mouseX - cameraX.value) / prevZoom;
const worldY = (mouseY - cameraY.value) / prevZoom;

// 2. Apply New Zoom
zoom.value = newZoom;

// 3. Recalculate Camera to keep World Point under Mouse
// NewCameraX = ScreenMouse - (WorldPoint * NewZoom)
cameraX.value = mouseX - (worldX * newZoom);
cameraY.value = mouseY - (worldY * newZoom);
```

### 2. Drift Prevention (Limit Alignment)
**Critical Bug**: If the UI (Panel) logic allows infinite scrolling (e.g., max 15.0), but the Store (State) clamps the value (e.g., max 10.0), the Panel logic will continue "moving" the camera for zoom levels that never happen.
*   **Symptom**: Camera pans away endlessly when hitting zoom limit.
*   **Fix 1 (Alignment)**: Ensure `ScenePanel` constants match `Store` constants exactly.
*   **Fix 2 (Read-Back)**: Always verify the *actual* zoom applied before moving the camera.
```typescript
zoom.value = targetZoom;
const actualZoom = zoom.value; // Store might have clamped it!
if (actualZoom === prevZoom) return; // Stop! Don't move camera.
```

## Critical Files

*   **`u:/UliKit2D/src/editor/panels/ScenePanel.vue`**: 
    *   Housesthe Input Event Handlers (`onWheel`, `onMouseDown`, `onMouseMove`).
    *   **MUST** usage `e.clientX` / `e.clientY` directly.
    *   Manages the "Zoom Towards Point" math.
*   **`u:/UliKit2D/src/stores/useEditorStore.ts`**:
    *   Single Source of Truth for `zoomLevel`.
    *   Handles clamping (Min: 0.1, Max: 64.0).
*   **`u:/UliKit2D/src/editor/systems/GridSystem.ts`**:
    *   Renders the Grid based on `cameraX`, `cameraY`, and `zoom`.
    *   Must handle Drawing Order (Paths -> Stroke) correctly for PixiJS v8.

## Theming & Grid
*   **Axes**: Use Theme Variables (`--grid-axis`).
*   **Lines**: User Preference (`options.color`) with robust `Pixi.Color` parsing.
*   **Rendering**: Always `moveTo/lineTo` -> `stroke`. Do not rely on stateful `stroke` before path commands.
