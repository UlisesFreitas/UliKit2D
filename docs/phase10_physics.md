# Phase 10: Physics Engine Implementation

## Overview
Phase 10 focused on integrating **Matter.js** into the UliKit2D ECS architecture. The goal was to provide a robust 2D physics simulation that supports rigid bodies, colliders, raycasting, and scriptable collision events.

## Architecture

### The Physics System (`PhysicsSystem.ts`)
The `PhysicsSystem` is the heart of the simulation. It runs in the main engine loop but operates independently on the Matter.js `Engine` instance.

-   **ECS Sync**: It synchronizes ECS `Transform` components with Matter.js `Body` positions/rotations every frame.
    -   *Dynamic Bodies*: Physics controls the Transform (One-way: Physics -> ECS).
    -   *Static/Kinematic Bodies*: Transform controls the Physics (One-way: ECS -> Physics).
-   **Entity Reference**: Every Matter.js body created by the system has a property `_entity` attached to it. This allows O(1) lookup of the owner Entity during collision events or raycasts.

### Components

#### `RigidBody`
Defines the physical properties of an entity.
-   **Mass**: Heaviness.
-   **Friction**: Surface roughness.
-   **Restitution**: Bounciness.
-   **IsStatic**: If true, the object acts as an immovable wall/floor.

#### `Collider`
Defines the shape of the physics body.
-   **BoxCollider**: Rectangle shape (Width/Height).
-   **CircleCollider**: Circular shape (Radius).
-   **PolygonCollider**: Custom vertices (used for complex shapes or Tilemaps).

## Scripting API

### Collision Events
Scripts can define the following functions to react to physics collisions. The `PhysicsSystem` listens to Matter.js events and dispatches them via the `EventBus`, which the `ScriptSystem` then routes to the specific entity's script.

```javascript
export function onCollisionStart(me, other) {
    console.log(`I hit ${other.name}!`);
}

export function onCollisionEnd(me, other) {
    console.log(`I stopped touching ${other.name}.`);
}
```

### Raycasting
A global `Physics` API is exposed to the window and scripts for performing raycasts (checking line-of-sight).

**Signature**:
```typescript
Physics.raycast(origin, direction, length, layerMask)
```

**Example**:
```javascript
// Cast a ray 500 pixels downwards from the current position
const hits = window.Physics.raycast(
    { x: entity.transform.x, y: entity.transform.y }, // Origin
    { x: 0, y: 1 },                                   // Direction (Down)
    500                                               // Length
);

if (hits.length > 0) {
    console.log("Ray hit: " + hits[0].entity.name);
}
```

## Debugging
-   **Visual Debug**: Enable "Debug Draw" in Project Settings to see green/purple wireframes of all colliders.
-   **Console Diagnosis**: Run `window.UliDebug.diagnose()` in the console to inspect the state of the Physics World, Layers, and active bodies.
