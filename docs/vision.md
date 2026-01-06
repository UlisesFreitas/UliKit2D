# UliKit2D Engine Vision

## 1. Objective
UliKit2D is a modern, lightweight, and extensible 2D Game Engine designed for ease of use, performance, and cross-platform capability (Desktop via Electron, Web via Modern Browser APIs). It aims to provide a "premium" development experience with a polished UI, intuitive workflow, and robust tooling.

## 2. Core Architecture
The engine is built upon a component-based architecture (ECS - Entity Component System) to ensure flexibility and scalability.

### Technologies & Libraries
- **Runtime**:
  - **Typescript**: Core language for type safety and maintainability.
  - **PixiJS (v8)**: A high-performance 2D rendering engine (WebGL/WebGPU). Used for all scene rendering.
  - **Miniplex**: A lightweight ECS library for managing entities and systems.
  - **Matter.js** (Planned/Partial): For 2D physics simulation.

- **Editor UI**:
  - **Vue 3**: Reactive UI framework for the editor interface.
  - **Vite**: Next-generation build tool for fast HMR and bundling.
  - **TailwindCSS**: Utilitarian CSS framework for modern, consistent styling.
  - **Dockview**: For a flexible, VSCode-like docking panel layout.
  - **Pinia**: State management for the editor (Project, Selection, UI state).

- **Platform Layer**:
  - **Electron**: For the standalone Desktop build, creating a native app experience with access to the local file system.
  - **IndexedDB**: For the Web build (`WebFileSystem`), enabling persistent project storage in the browser without a backend.

## 3. Key Systems
- **RenderSystem**: Synchronizes ECS components (`Transform`, `Sprite`, `Camera`) with the PixiJS scene graph. Handles dynamic asset loading (Blob URLs in Web, File Paths in Desktop).
- **GizmoSystem**: Provides editor-time visual tools for manipulating entities (Translation, Rotation, Scale) directly in the viewport.
- **ScriptSystem**: Allows users to attach custom logic (JavaScript/TypeScript) to entities.
- **AssetManager**: Centralized handling of assets, supporting drag-and-drop import and dynamic loading.

## 4. Current Status (Jan 2026)
- **Web Editor Support**: Fully functional Web version using IndexedDB.
- **Asset Workflow**: "Broken Image" issues resolved with dynamic loading and robust Blob URL handling.
- **Inspector**: Reactive inspector with specialized editors (Sprite, Script, Transform).
- **Theming**: Dark/Light mode support with premium aesthetics.

## 5. Roadmap
- **Physics Integration**: Full Matter.js integration with editor tooling (Colliders bindings).
- **Game Packaging**: One-click build exports for Web and Desktop.
- **Visual Scripting**: (Potential future feature).
