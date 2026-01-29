# UliKit2D Engine Bible & Conventions
> **Version**: 0.0.1
> **Last Updated**: 2026-01-14

This document serves as the **SINGLE SOURCE OF TRUTH** for all architectural decisions, constants, and conventions within the UliKit2D Engine. If you are unsure about a value or pattern, check here first.

---

## 1. Core Constants & Measuring Units

### **Grid & Dimensions**
*   **Base Unit**: `32 pixels`
    *   All default sizes, grid snaps, and fallback hitboxes MUST be `32x32` or multiples thereof.
*   **Gizmo Size**: `32x32` for non-visual entities (Cameras, Logic Points) to align with the grid.
    *   *Correction History*: Previously 64x64, reverted to 32x32 to maintain consistency.
*   **Default Scale**: `1.0` (Represents 100% size).

### **Coordinate System**
*   **Axis**: +X = Right, +Y = Down (Standard PixiJS/Canvas).
*   **Origin (0,0)**: Top-Left of the World/Layer.
*   **Anchor Point**:
    *   **Sprites**: Defaults to `0.5, 0.5` (Center) for easier rotation/scaling.
    *   **UI/Text**: Defaults to `0.5, 0.5` (Center) unless specified otherwise.
    *   **NineSlice**: Defaults to `0.5, 0.5`.

---

## 2. Entity Component System (ECS)

### **Entity Structure**
All logical objects are **Entities** defined in `src/engine/ecs/ECS.ts`.
*   **ID**: `crypto.randomUUID()` (String).
*   **Components**: Pure data containers (POJO).
    *   `transform`: Essential. `{ x, y, rotation, scale, zIndex }`.
    *   `layer`: String ID linking to a Render Layer.

### **Selection Logic (`CoordinateUtils.ts`)**
1.  **Visual Hit**: Perfect pixel/OBB check if `RenderSystem` has a DisplayObject (`Sprite`, `NineSlice`, `Text`).
    *   Uses `displayObject.containsPoint()`.
2.  **Collider Hit**: If `circleCollider` exists, checks radius.
3.  **Fallback (Non-Visuals)**:
    *   **Logic**: `32x32` Box centered on Transform.
    *   **Applies To**: `Camera`, `AudioSource` (if no sprite), `LogicController`.
    *   **Visual Aid**: `GizmoManager` draws a `32x32` icon/rect.

---

## 3. Rendering & Layers

### **Render Loop**
1.  **Engine**: `requestAnimationFrame` loop.
2.  **Systems**: Updated explicitly in `Engine.ts` or via `EventBus`.
    *   `RenderSystem`: Syncs ECS data to Pixi DisplayObjects.
    *   `GizmoManager`: Overlays editor tools on `app.stage.zIndex = 9999`.

### **Layer Architecture**
*   **Storage**: `ProjectSettings.layers` (Array of Strings).
*   **Defaults**: `['Background', 'Base Layer', 'Player', 'UI']`.
*   **Structure**:
    *   `Stage` -> `LayerContainer (zIndex: index)` -> `Entity (zIndex: transform.zIndex)`.
*   **Tilemaps**: Each Layer has a child `TileContainer` (zIndex: -1) for its tile data.

---

## 4. File Structure & Project Format

### **Project Root**
*   `ulikit.project`: JSON. Global settings (Resolution, Layers, Physics, Tags).
*   `assets/`: Root for all user content.
    *   `scenes/`: `*.json` Scene files.
    *   `sprites/`, `audio/`, `scripts/`: Organized by type.

### **Asset Resolution**
*   **Web/Dev**: Assets served from `/` (Vite public).
*   **Electron**: `file://` protocol or specific IPC handlers.
*   **Conventions**: Store paths as relative strings in ECS (`assets/sprites/player.png`), resolve at runtime via `ResourceManager`.

---

## 5. Development Rules (The Commandments)

1.  **DO NOT BREAK THE GRID**: If adding a new tool or visualizer, defaulting to `32px` is mandatory unless it represents a physics unit of different scale.
2.  **EXPLICIT VISIBILITY**: `entity.visible === false` is the only check for invisibility. `undefined` means visible.
3.  **ONE TRUTH**: ECS is the source of truth. RenderSystem is a reflection. Do not store state in Pixi sprites.
4.  **REACTIVITY**: Use `pinia` for Editor UI state, but `ECS` for Game logic. Bridge them carefully via `useEditorStore` subscriptions.
5.  **NO NULLS**: Where possible, Fallback/Default values should safely handle missing components to prevent crashes (e.g., `Camera` gizmo crash).

---
6.  **ZERO GHOSTS**: When fixing deletion bugs, always pre-calculate fallbacks. Moving from a deleted scene to `null` is a crash. Moving to "Untitled" is a user data panic. Moving to `Next Available` is UX gold.

---

## 6. NOTE TO FUTURE SELF (Architectural Learnings)
*Added Jan 2026*

### ⚠️ Project Loading Order is Non-Negotiable
If you ever refactor `ProjectManager`, remember this sequence or die:
1.  **Read Manifest**: Get the schema.
2.  **Hydrate Settings**: Push Layers/Tags to Managers (`SceneManager.setProjectLayers`).
3.  **Load Scene**: Now `SceneManager` knows what "Layer 1" is.
*Fail this, and you get "Loading scene WITHOUT Templates" warnings and duplicate layers.*

### ⚠️ Regex is Cheaper than Logic
For duplication naming (`Scene` -> `Scene_Copy`), don't parse strings manually. Use Regex:
`/^(.*)_Copy(_(\d+))?$/` handles `Base`, `Base_Copy`, and `Base_Copy_2` in one pass.

### ⚠️ Sorting requires Strict Normalization
Don't trust `sort((a,b) => a.index - b.index)`.
*   **Problem**: Gaps (`0, 10, 20`) allow "insert at end" logic to fail if `length` is used as next index.
*   **Fix**: "Clean Sweep" before creation. `0, 1, 2`. Next is `3`. Guaranteed.
