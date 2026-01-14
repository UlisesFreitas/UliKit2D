---
description: Expert knowledge and architectural patterns for UliKit2D Game Engine development.
---

# UliKit Engine Mastery

This skill encapsulates the core architectural decisions and best practices for developing the **UliKit2D Game Engine**. 
Always refer to this when creating new systems, panels, or refactoring engine core.

## 🏛️ Core Architecture: "The Immortal Pixi"

The engine uses a detached/persistent rendering architecture to support a docking layout system.

1.  **Immortal Canvas**: 
    *   The PixiJS Application is initialized **ONCE** as a Singleton in `DockLayout.vue`. 
    *   The `<canvas>` element lives in `#pixi-root` (z-index 0) behind all UI.
    *   **NEVER** initialize `new Application()` inside a panel component.

2.  **Transparent Overlays (The "Hollow" Panels)**:
    *   `ScenePanel.vue` is a transparent overlay (`background: transparent !important`).
    *   It acts as a **Viewport Controller** (updates Camera position/zoom) and **Input Layer**.
    *   It **must not** have its own `<canvas>`.

3.  **Singleton Bridging**:
    *   Use Singleton Managers to bridge Vue UI and Pixi Engine.
    *   **GizmoManager**: Singleton. Receives input from `ScenePanel` via `processPointer...` methods.
    *   **Engine**: Singleton instance export. Access via `import { instance as engine } ...`.

## 🎮 ECS (Entity Component System)

We use a custom ECS implementation (similar to Miniplex).

*   **World**: Global singleton `world`.
*   **Entities**: IDs + Components.
*   **Systems**: Logic classes that iterate queries in `update(dt)`.
    *   *Rule*: Systems should be stateless regarding pure data; store state in Components or the System instance if it's "meta-data" (e.g., debug colors).

## 🧩 UI Architecture

1.  **Framework**: Vue 3 (Script Setup) + TailwindCSS.
2.  **State**: Pinia Stores (`useEditorStore`, `useprojectStore`).
    *   *Rule*: Engine Systems should **not** import Pinia stores directly if possible. Pass data via methods or signals.
    *   *Exception*: Editor-specific Managers (Gizmo, Selection) can read Store state but be careful of initialization order. Use `init()` methods, not constructors.

3.  **Dockview**:
    *   Panels are dynamic.
    *   **CSS Troubleshooting**: If Pixi is invisible, check `style.css` for `.dv-group-view` background transparency overrides using `:has(.scene-panel)`.

## ⚠️ Critical Pitfalls (Don't Do This)

1.  **Direct Event Listeners on Stage**: Avoid `app.stage.on('pointerdown')` for editor tools. The `ScenePanel` DOM element blocks the canvas. **Use Input Proxying** via `GizmoManager` or `InputManager`.
2.  **Undefined Store Access**: Never call `useStore()` in a class property initializer or global scope. Call it inside functions or `init()` methods.
3.  **Z-Index Wars**: Keep `#pixi-root` at `z-0`. Keep Dockview at `z-10`. Keep Overlays transparent.

## 🛠️ Common Workflows

### Adding a New System
1. Create `src/engine/systems/MySystem.ts`.
2. Register it in `Engine.ts` constructor or `init()`.
3. Add `update(dt)` call in `Engine.gameLoop`.

### Creating a New Panel
1. Create `src/editor/panels/MyPanel.vue`.
2. Register in `DockLayout.vue` (`switch` case).
3. Add to default layout JSON in `DockLayout` or allow user to open it.

