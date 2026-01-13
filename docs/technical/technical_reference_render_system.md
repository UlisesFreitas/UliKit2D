# Technical Reference: Render System & Editor Architecture

## Overview
This document outlines the architecture for the **RenderSystem**, **EditorDebugSystem**, and **GizmoManager**, specifically focusing on the component priority logic implemented to resolve visual conflicts (e.g., overlapping "green placeholder" sprites on text entities).

---

## 1. RenderSystem: Priority & Exclusivity
The `RenderSystem` is responsible for synchronizing ECS component data (Transform, Sprite, Label, BitmapText) with the PixiJS scenegraph.

### Single Loop with Strict Priority
To prevent multiple visual representations for a single entity (e.g., a Sprite showing up behind a Text Label), `RenderSystem` uses a **Mutually Exclusive Priority Pipeline**:

**Priority Order:**
1.  **BitmapText** (Highest)
2.  **Label** (Text)
3.  **NineSliceSprite** (UI/Scalable)
4.  **Sprite** (Lowest)

### ECS Data Enforcement
The system goes beyond just *hiding* lower-priority visuals. It **actively modifies the ECS state** to enforce clean data:

*   **If `BitmapText` is present:**
    *   `delete entity.sprite`
    *   `delete entity.label`
    *   Destroys associated Pixi objects.
*   **If `Label` is present (and no BitmapText):**
    *   `delete entity.sprite`
    *   `delete entity.bitmapText`
    *   Destroys associated Pixi objects.
*   **If `Sprite` is present (and no Text):**
    *   Configures the Sprite.
    *   Ensures Text components are removed if they were somehow present but empty.

This ensures that no other system (like Gizmos or Debuggers) can "see" a phantom Sprite component on a Text entity.

### Code Reference (`RenderSystem.ts`)
```typescript
// Single Render Loop - Priority: BitmapText > Label > NineSliceSprite > Sprite
for (const entity of entities) {
    if (entity.bitmapText) {
        // Enforce Exclusivity: Remove conflicting components from ECS
        if (entity.sprite) delete entity.sprite;
        if (entity.nineSliceSprite) delete entity.nineSliceSprite; // New
        if (entity.label) delete entity.label;
        this.updateBitmapText(entity);
        // ... cleanup
    }
    // ... else if (entity.label) ...
    // ... else if (entity.nineSliceSprite) ...
}
```

---

## 2. EditorDebugSystem: "Empty Entity" Detection
The `EditorDebugSystem` visualizes invisible entities (e.g., a pure Transform or logic-only entity) by drawing a **Cyan/Green Debug Box**.

### The Logic
The system iterates all entities and checks if they have any visible component. If NOT, it draws the debug box.

**Determining Visibility:**
An entity is considered "Visible" (and thus NOT needing a debug box) if it has:
*   Useable `Sprite` (with texture path)
*   **OR**
*   Useable `Label` (with text content)
*   **OR**
*   Useable `BitmapText` (with text content)

*Note: Previous issues arose because `BitmapText` was missing from this check, causing the debug box to appear on top of valid text.*

---

## 3. GizmoManager: Selection Bounds
The `GizmoManager` draws the selection/transformation handles (Yellow Box). It calculates the bounding box based on the highest-priority visual component available.

### Bounds Calculation Order (`getBounds()`)
1.  **BoxCollider** (Highest priority for game logic debugging)
2.  **Sprite** (`width`/`height` from texture)
3.  **BitmapText** (`width`/`height` synced from Pixi Runtime)
4.  **Label** (`width`/`height` synced from Pixi Runtime)
5.  **Fallback** (100x100 default)

If `RenderSystem` successfully deletes the conflicting `Sprite` component from a `BitmapText` entity, `GizmoManager` correctly falls through to use the `BitmapText` dimensions.

---

## 4. Asset Workflow Note (Bitmaps)
When loading a `.fnt` file (Bitmap Font), PixiJS or the Editor might preload the associated `.png` texture. In some drag-and-drop flows, this might accidentally attach a `Sprite` component to the entity.
The **RenderSystem Exclusivity Logic** automatically cleans this up by deleting the `Sprite` component properly, ensuring the entity remains a pure `BitmapText`.
