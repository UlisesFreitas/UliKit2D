# Pending Vital Features

This document outlines critical systems missing from the UliKit2D engine as of **January 8, 2026**. These features are essential for general-purpose 2D game development and should be prioritized.

## 1. Input Manager (Highest Priority)
**Current Status:** Missing. Users must manually attach event listeners to `window` in their scripts.
**Requirement:** A centralized `Input` class/system to handle keyboard, mouse, and potentially gamepad input.
**API Goal:**
```typescript
if (Input.isKeyDown('Space')) { ... }
if (Input.getMouseButton(0)) { ... }
const movement = Input.getAxis('Horizontal'); // -1 to 1
```
**Implementation Details:**
- Needs to handle event prevention (e.g., preventing scrolling when pressing arrow keys).
- Should map keys to abstract names (e.g., "Jump" -> Space/X).

## 2. Physics Shapes (Collider types)
**Current Status:** Only `BoxCollider` is implemented.
**Requirement:** Support for `CircleCollider` and potentially `CapsuleCollider` or `PolygonCollider`.
**Implementation Details:**
- Update `ECS.ts` to include `circleCollider` component.
- Update `PhysicsSystem.ts` to create `Matter.Bodies.circle`.
- Update Editor Inspector to visualize and edit radius.

## 3. Z-Index / Layering
**Current Status:** Rendering order is determined by the entity creation order (insertion order) or the scene graph hierarchy.
**Requirement:** Explicit control over rendering order.
**Implementation Details:**
- Add `zIndex` (number) property to `Entity` (likely within `Transform` or a new `Renderable` component).
- Update `RenderSystem.ts` to sort the PixiJS container children based on this value every frame (or when changed).
- Alternatively, use PixiJS `zIndex` and `sortableChildren = true`.

## 4. Scene Switching (Runtime)
**Current Status:** `SceneManager` exists but is editor-focused (save/load JSON). No easy way to switch scenes during gameplay.
**Requirement:** API to load scenes by name/ID during runtime.
**Implementation Details:**
- `SceneManager.loadScene(name)` needs to be safe for runtime (clearing ECS, resetting systems).
- Needs a build step to bundle scene JSONs so they are accessible in the final build (not just `file://` access).

## 5. Advanced Layer Manager (Future)
**Current Status:** Basic Z-Index support exists (manual number implementation).
**Requirement:** Named Layers (e.g., "Background", "Actors", "UI") to organize z-sorting more intuitively.
**Proposed Workflow:**
- A "Layer Manager" panel to create and reorder named layers.
- Entities assign to a "Layer" by name drop-down instead of raw number.
- Internally maps Layer Order + Local Z to final zIndex.

## 6. Prefab System (Optional but Recommended)
**Current Status:** "Copy/Paste" exists, but no true template/prefab system.
**Requirement:** Reuse entity definitions.

## Summary of Priorities
1. **Input System** (Vital for interaction)
2. **Physics Shapes** (Vital for non-box games)
3. **Z-Index** (Vital for visual polish)
4. **Scene Switching** (Vital for multi-level games)
