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
    - Default to `{ x: 0.5, y: 0.5 }` (Center).
    - **Runtime Anchor**: This is the "active" anchor used by the Renderer.
    - **Animation Handling**: If an Entity has an `Animator`, the `AnimationSystem` may override this `anchor` value frame-by-frame (see Phase 3).

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
// ...
    isTrigger: boolean;
    // Material properties...
}
```
// ...
    isTrigger: boolean;
    // Material properties...
}
```
- **Runtime Collider**: This component holds the *active* points used by Physics.
- **Animation Handling**: Similarly to Anchors, `AnimationSystem` can update `points` per frame (Phase 3).
- Mutually exclusive with `BoxCollider` / `CircleCollider`? Or allow multiple?
    - For simplicity: One collider per entity initially, or a list of colliders.
    - Current System: `boxCollider`, `circleCollider` are optional props. Add `polygonCollider`.

### 2. Editor UI (Collision Editor)
- **Edit Mode (Modal)**:
    -   User clicks "Edit Collision Mask" in Inspector (Box/Polygon Collider section).
    -   Opens a **Modal Overlay** (similar to GDevelop/Godot style).
    -   **Modal Content**:
        -   Canvas showing the Sprite + Current Collider Polygon.
        -   **Tools**:
            -   **Move Point**: Drag existing vertices.
            -   **Add Point**: Click on edge to subdivide.
            -   **Remove Point**: Double-click or Right-click vertex to remove (allows creating Triangles from Quads).
        -   **Presets**: Button to "Reset to Box" or "Reset to Mesh (Auto)".
    -   **Live Preview**: Changes apply to the `PolygonColliderComponent` logic immediately or on "Apply".

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

---

## Phase 3: Per-Frame Animation Data (Advanced)

**Objective**: Allow each frame of an animation to have a distinct **Anchor** and **Collision Mask**.

### 1. Data Structure Update
We need to upgrade the simple `frames: string[]` array in `AnimatorComponent` to a richer structure.

```typescript
interface AnimationFrame {
    textureId: string;
    duration?: number; // ms override
    anchor?: { x: number, y: number }; // Optional override
    collisionPoints?: { x: number, y: number }[]; // Optional override
}

interface AnimationData {
    name: string;
    speed: number;
    loop: boolean;
    frames: AnimationFrame[]; // Array of rich frames
}
```

### 2. Engine Integration (AnimationSystem)
- **Update Loop**:
    1. Determine current Frame.
    2. Set `sprite.texture`.
    3. **Check for Anchor**:
       - If frame has `anchor`, set `sprite.anchor = frame.anchor`.
       - Else, revert to `defaultAnchor` (or keep last?). *Design Decision*: Usually revert to Component default.
    4. **Check for Collision**:
       - If frame has `collisionPoints`, update `polygonCollider.points`.
       - **Physics Re-body**: Updating vertices in Matter.js is expensive (requires creating new body parts or scaling).
       - *Optimization*: Pre-pool bodies or use `Body.setVertices`.

### 3. Editor UI (Animator Panel)
- **Timeline**: Select a specific frame.
- **Inspector**:
    - Show "Frame Properties".
    - "Set Anchor for this Frame" button.
    - "Edit Collision for this Frame" button.
- **Gizmos**: Show "Ghost" of the collider updating as you scrub the timeline.

---

## Action Plan

1.  **Phase 1 (Origin Core)**:
    - Implement `anchor` in `SpriteComponent`.
    - Update `RenderSystem`.
    - Update `Inspector` for static anchor.

2.  **Phase 2 (Collision Core)**:
    - Implement `PolygonColliderComponent`.
    - Update `PhysicsSystem` to build bodies from points.
    - Implement `CollisionEditor` (Edit Mode).

3.  **Phase 3 (Animation Integration)**:
    - Refactor `AnimatorComponent` to handle `RichFrames`.
    - Update `AnimationSystem` to apply per-frame Anchor/Collider.
    - Add UI support for per-frame editing.

