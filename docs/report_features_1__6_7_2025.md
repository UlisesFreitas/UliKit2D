# Features Report: Jan 6 - Jan 7, 2025

This report summarizes the new features and major improvements implemented in the UliKit2D Engine and Editor over the last 48 hours.

## 1. Animator Overhaul (GDevelop Style)
We have completely redesigned the Animator component to match the workflow and aesthetics of GDevelop, significantly improving usability.

- **New UI**: A dedicated `AnimatorModal` that provides a focused environment for editing animations.
- **Visual Frame Strip**: A bottom strip displaying all frames in the animation with thumbnails.
- **Large Preview Area**: A central preview area with:
    - **Zoom Controls**: (+/-, Reset) to inspect pixel art details.
    - **Playback Controls**: Play/Stop buttons to preview animation speed and looping in real-time.
- **Drag & Drop Import**: Support for dragging image files directly into the modal to add them as frames.
- **Auto-Import**: Files dropped from outside the project are automatically imported into `assets/imported/` with unique IDs (Nanoid) to prevent naming collisions.
- **File Picker**: A native-style file picker for adding frames (supports multiple selection).

## 2. Text / Label Component
A full system for adding and editing text elements in the game scene.

- **LabelEditor**: A new Inspector component for modifying text properties:
    - Text Content
    - Font Size
    - Color (Color Picker)
    - Font Family
    - Alignment
- **ECS Integration**: `TextComponent` added to the Entity-Component-System architecture.
- **Rendering**: Updated `RenderSystem` to correctly render `PIXI.Text` objects based on component data.
- **Creation Menus**: Added "Text Label" options to the Hierarchy and Header "Create" menus.

## 3. Script Editor Improvements
We refined the Script Editor to resolve syncing issues and improve the developer experience.

- **Parameter Rendering**: Scripts now correctly display exposed parameters (public variables) in the Inspector.
- **Zombie Script Fix**: Resolved an issue where removed scripts would persist in the background or cause errors.
- **UI Sync**: Fixed a bug where the UI would not update immediately after removing a script.

## 4. Web Environment Support
Significant work was done to ensure the editor functions correctly in a pure Web environment (non-Electron).

- **IndexedDB File System**: A robust `WebFileSystem` implementation using IndexedDB for persistent storage in the browser.
- **Blob URL Handling**: Assets are now correctly loaded as `blob:` URLs, enabling image previews and game rendering without a local backend.
- **Asset Persistence**: Fixed critical bugs in `importFile` and `getAssetURL` to ensuring imported assets survive page reloads.

## 5. General UI Polish
- **Create Menu**: Unified "Create" dropdown in the header for quick access to creating Sprites, Labels, and Empty entities.
- **Inspector Styling**: Improved consistency in Inspector panels (Animator, Transform, Label).
- **Prompt Fixes**: Replaced native `prompt()` calls with custom UI or proper Electron/Web handling to prevent errors.
