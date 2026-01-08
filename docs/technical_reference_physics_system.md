# Physics System Technical Reference

**System Name:** `PhysicsSystem`  
**File:** `src/engine/systems/PhysicsSystem.ts`  
**Library:** Matter.js

## Overview
The Physics System integrates the Matter.js 2D physics engine into the UliKit2D ECS architecture. It is responsible for synchronizing ECS `Transform` components with Matter.js `Body` objects and simulating physical interactions (collisions, gravity).

## Architecture

### 1. ECS Integration
The system listens for entities with a `rigidBody` component.
- **Component**: `rigidBody`
  - `mass` (number)
  - `isStatic` (boolean)
  - `friction` (number)
  - `restitution` (number: bounciness)

### 2. Supported Colliders
The system triggers body creation based on the presence of specific collider components alongside the `rigidBody`.

#### Box Collider
- **Component**: `boxCollider`
- **Properties**: `width`, `height`
- **Matter Factory**: `Matter.Bodies.rectangle`

#### Circle Collider
- **Component**: `circleCollider`
- **Properties**: `radius`
- **Matter Factory**: `Matter.Bodies.circle`

### 3. Synchronization Loop
The `update(dt)` loop performs two-way synchronization:

1.  **ECS -> Physics**: If an entity's `Transform` changes (e.g. via Gizmo or Script) effectively "teleporting" it, the Physics Body position/rotation is updated to match.
2.  **Simulation**: `Matter.Engine.update` advances the simulation.
3.  **Physics -> ECS**: The new positions/rotations of the Physics Bodies are copied back to the ECS `Transform` components to be rendered.

## Adding New Physics Shapes

To add a new shape (e.g., Polygon/Capsule):

1.  **ECS Type Definition**: Update `Entity` type in `src/engine/ecs/ECS.ts` to include the new component (e.g., `capsuleCollider`).
2.  **Physics Logic**: Update `syncBodies()` in `src/engine/systems/PhysicsSystem.ts`.
    ```typescript
    else if (entity.capsuleCollider) {
        body = Matter.Bodies.fromVertices(...) // or composite
    }
    ```
3.  **Editor Support**:
    - Create `CapsuleColliderEditor.vue`.
    - Register in `InspectorPanel.vue` (imports, `inspectorItems` loop usually handles it, add template section).
    - Update `AppHeader.vue` and `HierarchyPanel.vue` to allow creating the object with default components.

## Debugging
Physics bodies are currently invisible at runtime unless a debug renderer is enabled (future feature). For now, rely on `Transform` updates to verify physics behavior.
