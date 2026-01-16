# EditorDebugSystem & Debug Visualization

This system renders debug overlays for the Editor, such as:
1.  **Selection Outlines**
2.  **Hover Highlights**
3.  **Missing Visual Placeholders** (The "Cyan Box")

## The "Cyan Box" / Defualt Gizmo
The system automatically draws a cyan rectangle with a cross for any entity that:
-   Has **NO** visible Sprite.
-   Has **NO** visible Text/Label.
-   Has **NO** NineSliceSprite.
-   Is **NOT** explicitly excluded (e.g., Cameras).

### Excluding Entities (How-To)
If you have a special entity type (like a Camera, AudioSource, etc.) that renders its own visualization (via `RenderSystem` or overlay) and you want to **prevent** the Cyan Box from appearing:

You must modify the conditional check in `src/engine/systems/EditorDebugSystem.ts` (approx Line 38).

```typescript
// src/engine/systems/EditorDebugSystem.ts

const isCamera = !!entity.camera;
// Add other exclusions here, e.g. const isAudio = !!entity.audioSource;

if (!hasVisibleSprite && !hasVisibleLabel && ... && !isCamera) {
    // Only then do we draw the placeholder
    this.drawPlaceholder(graphics, entity);
}
```

> **Note**: Cameras are excluded because `RenderSystem` handles drawing the Camera Icon (or Sprite representation) directly. If `EditorDebugSystem` also drew a placeholder, you would see both the Icon AND the Cyan Box.
