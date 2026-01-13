# UliKit2D Engine Status Report - Jan 8, 2026

## 1. Project Overview
**UliKit2D** is a modern, cross-platform 2D game engine designed for a premium development experience. It supports both standalone Desktop builds (via Electron) and a fully functional Web Editor (via IndexedDB).

**Core Technology Stack:**
*   **Runtime:** TypeScript, PixiJS v8 (Rendering), Miniplex (ECS), Matter.js (Physics).
*   **Editor:** Vue 3, Vite, TailwindCSS.
*   **Layout:** Dockview (VSCode-like docking architecture).
*   **State:** Pinia.
*   **IO:** Abstraction layer supporting `@zenfs` (Web) and Node `fs` (Electron).

## 2. Core Architecture
The project is split into two main domains in `src/`:
*   **`engine/`**: The runtime game engine.
    *   **ECS**: Entity-Component-System architecture using Miniplex.
    *   **Systems**: `RenderSystem`, `ScriptSystem`, `PhysicsSystem`, `GizmoSystem`.
    *   **Resources**: Asset loaders for Textures, Scripts, JSON.
*   **`editor/`**: The Vue 3 based IDE.
    *   **Panels**: `ScenePanel`, `HierarchyPanel`, `InspectorPanel`, `AssetsPanel`, `ConsolePanel`.
    *   **Managers**: `TransformGizmo`, `SelectionManager`, `CommandStack` (Undo/Redo).

## 3. Implemented Features

### Editor Interface
*   **Docking System**: Flexible, draggable panels.
*   **Theming**: Complete Dark/Light mode support.
*   **Scene View**: Interactive viewport with Grid, Snap-to-Grid, and Gizmos (Translate, Rotate, Scale).
*   **Hierarchy**: Tree view of scene entities with drag-and-drop reordering.
*   **Assets Panel**:
    *   Thumbnail generation for images.
    *   Drag-and-drop import from OS.
    *   Real-time previews.

### Game Components
*   **Sprite**: Basic 2D image rendering.
*   **NineSliceSprite** (New): Slicable UI elements with adjustable borders.
*   **Text/Label** (New): Text rendering with font, color, and alignment controls.
*   **Animator** (New): Frame-based animation with a GDevelop-style visual editor modal.
*   **Script**: Attach JavaScript/TypeScript logic to entities.
*   **Transform**: Position, Rotation, Scale.
*   **Camera**: Camera control.

## 4. Recent Changelog (Jan 2026)

### Jan 8: Visual Polish & Physics Shapes
*   **NineSliceSprite**: Implemented component and inspector usage.
*   **Physics**: Added support for **CircleColliders** and **BoxColliders** with full editor integration (Creation, Inspection, Simulation).
*   **Asset Picker**: Added ability to import files directly via the picker.
*   **Asset Panel**: Added thumbnail support for better visual navigation.

### Jan 6-7: Animator & Web Support
*   **Animator Overhaul**: Completely redesigned the Animation Editor to feature a timeline, preview area, and drag-and-drop frame import.
*   **Web Persistence**: Fixed `WebFileSystem` using IndexedDB to ensure persistent projects in the browser version.
*   **Blob URLs**: Correct handling of asset loading in web environments.

## 5. Roadmap Status (from `plan.json`)
**Completed Phases:**
*   Foundation & Setup
*   Editor Layout System
*   Core Engine Architecture (ECS, Physics Baseline)
*   Editor Logic (Gizmos, Selection, Undo/Redo)
*   Asset & Project Management (Filesystem, Drag & Drop)
*   Game Logic (Basic Scripting)
*   UI Overhaul
*   Asset Management 2.0 (Folders, Navigation)
*   Scene Tools (Grid, Snap)

**Pending / In-Progress:**
*   **Vital Components**: AudioSource, Tilemap Editor.
*   **Advanced Scripting**: Strict lifecycle, TypeScript compilation support.
*   **Visual Scripting**: Event Sheets (Node-based or block-based logic).
