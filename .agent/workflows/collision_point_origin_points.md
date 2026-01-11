---
description: Implement Custom Collision Masks (Polygon Colliders) and Origin Points (Pivot/Anchor) functionality.
---

# Feature: Collision Masks & Origin Points

This workflow outlines the steps to implement:
1.  **Origin Points**: Allowing entities (Sprites) to have a custom pivot/anchor point (e.g. Center, Bottom-Center, Custom X/Y).
2.  **Collision Masks**: Allowing entities to have custom Polygon Colliders instead of just Box/Circle, defined by a set of points relative to the Origin.

## Phase 1: Origin Points (Pivot/Anchor)

**Objective**: Allow users to adjust the "center" of the Sprite/Entity.

### 1. Data Structure (ECS)
Update the `TransformComponent` or `SpriteComponent`?
- **PixiJS**: Uses `anchor` (0.0 to 1.0) for Sprites. Default is (0,0) or (0.5, 0.5) depending on setup.
- **Components**:
    - Add `anchor: { x: number, y: number }` to `SpriteComponent` interface.
    - Default to `{ x: 0.5, y: 0.5 }` (Center) for better UX, or `{ x: 0, y: 0 }` (Top-Left) if adhering to standard defaults.

### 2. Editor UI (Inspector)
- **Sprite Component Editor**:
    - Add "Anchor" or "Origin" fields (X, Y).
    - Add a "Quick Preset" dropdown (Center, Top-Left, Bottom-Center, etc.).
- **Scene View**:
    - Draw a visual "Target" or "Crosshair" gizmo representing the anchor.
    - Allow dragging this crosshair relative to the sprite bounds? (Advanced, stick to Inspector first).

### 3. Engine Integration
- **RenderSystem**:
    - When updating `Sprite`, set `sprite.anchor.set(entity.sprite.anchor.x, entity.sprite.anchor.y)`.
    - Ensure `transform.position` corresponds to this anchor.

### 4. Physics Implications
- Matter.js bodies usually orbit their Center of Mass.
- If we change Sprite Anchor, the Sprite shifts visually relative to `transform.position`.
- We must decide: Does `transform.position` represent the **Anchor** or the **Top-Left**?
    - Standard Engine practice: `transform.position` IS the Anchor point.
    - If I move Anchor from Center (0.5) to Bottom (1.0), the Sprite visually moves UP so that its bottom aligns with the transform position.
- **Physics Body Offset**:
    - If the Physics Body was centered on the Sprite, and we change Anchor, we might need to offset the Physics Body or just acknowledge that the Collider is defined relative to the Anchor.

---

## Phase 2: Collision Masks (Polygon Colliders)

**Objective**: Allow custom collision shapes (Polygons) defined by points.

### 1. Data Structure (ECS)
- Create `PolygonColliderComponent`:
```typescript
interface PolygonColliderComponent {
    points: { x: number, y: number }[]; // Local coordinates relative to Anchor
    isTrigger: boolean;
    // Material properties...
}
```
- Mutually exclusive with `BoxCollider` / `CircleCollider`? Or allow multiple?
    - For simplicity: One collider per entity initially, or a list of colliders.
    - Current System: `boxCollider`, `circleCollider` are optional props. Add `polygonCollider`.

### 2. Editor UI (Collision Editor)
This is the complex part (similar to GDevelop's screenshot).
- **Edit Mode**:
    - A button "Edit Collision Mask" in Inspector.
    - Opens a Modal or switches Scene View to "Collider Edit Mode".
    - **Points Editor**:
        - Click to add points.
        - Drag points to move.
        - Double click to remove.
        - Visual lines connecting points.
    - **Origin Visualization**: Show the Origin Point relative to the polygon.

### 3. Engine Integration (PhysicsSystem)
- **PhysicsSystem**:
    - Detect `polygonCollider` component.
    - Use `Matter.Bodies.fromVertices(x, y, [points], ...)`
    - **Important**: Matter.js recenters the body around its calculated center of mass.
    - **Offset Correction**:
        - We need the body to be positioned exactly where we defined it relative to the Transform.
        - If Matter shifts the center, we must calculate the offset and apply it to the `render.sprite` or the body position.
    - **Convex Decomposition**: Matter.js requires convex polygons. If user draws concave, we need `poly-decomp` library or automatic triangulation.
        - *Recommendation*: Start with generic `fromVertices` which handles decomposition if the poly-decomp library is installed, otherwise it hulls it.

### 4. Rendering Debug
- Update `PhysicsDebugSystem` to draw the polygon points.

---

## Action Plan

1.  **Modify `SpriteComponent`** (ECS) to include `anchor`.
2.  **Update `RenderSystem`** to apply anchor.
3.  **Update `InspectorPanel`** to show Anchor fields.
4.  **Define `PolygonCollider`** in ECS.
5.  **Implement `PolygonEditor`** (Canvas overlay or Gizmo).
6.  **Update `PhysicsSystem`** to generate Polygon bodies.

