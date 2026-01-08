# Editor Workflow & Architecture

## System Overview
The UliKit2D editor uses a centralized component and script system. 
- **Core Components** (Sprite, RigidBody, etc.) and **Scripts** are added via the same `AddComponentModal`.
- **Scripts** are treated as assets.

## Asset Structure
- **`assets/`**: The runtime asset folder for the current project.
- **`src/resources/default_assets/`**: Template assets. Any file placed here is automatically copied to `assets/` when creating a new project (and seemingly available for default usage).

## Workflow: Adding a Script
1.  **Create Script**: Place script files (e.g., `rotate.js`) in the project's `assets/` folder (or `src/resources/default_assets/` for templates).
2.  **Select Entity**: Select the target entity in the Hierarchy.
3.  **Add Component**: Click "Add Component" in the Inspector.
4.  **Select Script**: Switch to the **Scripts** tab in the modal and select your script.
5.  **Configure**: Parameters defined in the script (e.g., `export const properties = {...}`) will appear in the Inspector.

## Script Format (JS/TS)
Scripts should export an `update(entity, deltaTime)` function.
```javascript
export const properties = {
    speed: 100
};

export function update(entity, dt, params) {
    entity.transform.rotation += params.speed * (dt / 1000);
}
```
