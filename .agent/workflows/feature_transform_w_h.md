---
description: Implement Hybrid Transform Editor with Scale and Size (W/H) inputs
---

# Feature: Transform W/H (Size) Inputs

Implement a hybrid editing mode in `TransformEditor.vue` that allows modifying an entity's size in pixels (W/H) by automatically recalculating its Scale.

## 1. Analysis & Utilities
- [ ] **Create `SizeUtils.ts`**: Implement a helper function `getLocalSize(entity): { width: number, height: number }` that determines the "unscaled natural size" of an entity.
    -   **Sprite**: `texture.width`, `texture.height`.
    -   **BitmapText**: Calculated bounds? Or font size metrics? (Maybe skip text for now or use `getLocalBounds`).
    -   **NineSlice/Tiling**: These often have explicit `width`/`height` separate from scale. *Decision*: If the component has explicit dimensions that are NOT scale-dependent (like NineSlice resizing), strictly bind to those? Or map everything to Scale for consistency in the "Transform" panel?
    -   *Strategy*: For `TransformEditor`, we specifically want to manipulate **Scale**. So `Size = NaturalSize * Scale`.
    -   If an entity has no visual component (Null Object), Size is 0 or undefined.

## 2. UI Implementation (`TransformEditor.vue`)
- [ ] **Add "Size" Section**:
    -   Add `Width` and `Height` number inputs below Scale.
    -   Add a "Link" icon (lock aspect ratio), similar to Scale (if exists).
- [ ] **Implement Reactivity**:
    -   **Read**: On mount/update, calculate `DisplayWidth = NaturalWidth * Transform.Scale.X`.
    -   **Write**: On input `NewWidth`:
        -   Calculate `NewScaleX = NewWidth / NaturalWidth`.
        -   Apply `Transform.scale.x = NewScaleX`.
        -   Emit update.
- [ ] **Handle Edge Cases**:
    -   Prevent division by zero if `NaturalWidth` is 0.
    -   Show disabled inputs or "---" if entity has no visual size.

## 3. Integration
- [ ] **Update `InspectorPanel.vue`**: Ensure it passes necessary context (like the Entity itself, or at least the `Sprite` component if available) to `TransformEditor` so it can look up the Texture. 
    -   Currently `TransformEditor` receives `{ transform }`. It might need the whole `entity` or a way to lookup the sprite texture to know the base size.
    -   *Action*: Update `TransformEditor` props to accept `entity` (optional) or `components`.

## 4. Verification
- [ ] **Test with Sprite**:
    -   Load a 64x64 sprite.
    -   Change Width to 128. Verify Scale becomes 2.
    -   Change Scale to 0.5. Verify Width becomes 32.
- [ ] **Test with Empty Object**:
    -   Select Camera or empty node.
    -   Verify Size inputs are disabled or hidden.
