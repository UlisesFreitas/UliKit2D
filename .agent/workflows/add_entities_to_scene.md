---
description: Workflow for adding entities to the scene correctly in the Immortal Canvas architecture.
---

# Add Entities to Scene Workflow

This workflow describes the correct procedure for creating and adding entities to the UliKit2D scene, ensuring compatibility with the **Immortal Canvas** architecture (Global Stage) and **ECS** pattern.

## 1. Context & Architecture

*   **Global Stage**: The PixiJS Stage is at Window coordinates `(0,0)`.
*   **Scene Manager**: Manages Layers (which are Pixi Containers on the Stage).
*   **Render System**: Automatically finds entities with visual components (`Sprite`, `Label`, etc.) and adds them to the correct Layer Container.
*   **Spawn Position**: Entities should be spawned at the **Center of the Camera View** to ensure they are visible to the user immediately.

## 2. Spawn Position Calculation

Since `ScenePanel` manages the Camera, but we might create entities from `HierarchyPanel` or `Shortcuts`, we calculate the World Center using the global Engine state:

```typescript
import { instance as engine } from '../../engine/core/Engine';

function getSpawnPosition() {
    // Screen Center
    const screenX = engine.app.screen.width / 2;
    const screenY = engine.app.screen.height / 2;
    
    // Global Stage Transform
    const stage = engine.app.stage;
    const zoom = stage.scale.x;
    
    // World Position = (Screen - StagePos) / Zoom
    const worldX = (screenX - stage.position.x) / zoom;
    const worldY = (screenY - stage.position.y) / zoom;
    
    return { x: worldX, y: worldY };
}
```

## 3. Entity Factory Logic

We will implement a standard Factory pattern to handle the creation of all supported types.

### Required Components
All entities must have:
1.  **ID**: `crypto.randomUUID()`
2.  **Name**: Unique or descriptive name.
3.  **Layer**: Defaults to `SceneManager.activeLayerId` or `'Base Layer'`.
4.  **Transform**: With calculated spawn position.

### Component Templates

| Type | Components to Add | Default Values |
| :--- | :--- | :--- |
| **Empty** | `transform` | Scale: 1, Rotation: 0 |
| **Sprite** | `sprite`, `transform` | Texture: `default_sprite`, Anchor: 0.5 |
| **Camera** | `camera`, `transform` | Zoom: 1, Primary: false, Bg: #000000 |
| **Animator** | `animator`, `sprite`, `transform` | Texture: `default_sprite`, Playing: true |
| **TextLabel** | `label`, `transform` | Text: "New Text", FontSize: 24, Color: #FFFFFF |
| **BitmapText**| `bitmapText`, `transform` | Text: "Bitmap Text", FontSize: 32, Tint: 0xFFFFFF |
| **NineSlice** | `nineSliceSprite`, `transform` | W/H: 100, Slices: 10, Texture: `default_panel`? |
| **Circle** | `circleCollider`, `rigidBody`, `transform`| Radius: 25, Static: false |
| **Box** | `boxCollider`, `rigidBody`, `transform` | W/H: 50, Static: false |
| **Audio** | `audioSource`, `transform` | Clip: "", Volume: 1, Loop: false |
| **Script** | `script`, `transform` | Path: "", Params: {} |

## 4. Implementation Steps

1.  **Refactor HierarchyPanel**: Remove the inline `createEntity` switch-case.
2.  **Create `EntityFactory.ts`**: Create a new file in `u:/UliKit2D/src/engine/factories/EntityFactory.ts`.
3.  **Implement `createEntity(type, position)`**:
    *   Construct the Entity object.
    *   `world.add(entity)`
    *   `SceneManager.registerEntity(entity.id, entity.layer)`
4.  **Update HierarchyPanel**: Call `EntityFactory.createEntity(type, getSpawnPosition())`.

## 5. Verification
*   **Visibility**: Entity must appear at the center of the screen.
*   **Scene Graph**: Entity must appear in `RenderSystem` logic (visuals) or Debug System (Colliders).
*   **Selection**: Entity must be selectable immediately.
