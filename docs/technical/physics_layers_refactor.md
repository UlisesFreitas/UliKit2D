# Physics & Layers System Architecture (Refactor v2.0)

**Date**: 2025-01-24
**Status**: Implemented

## Overview

The UliKit2D Physics System has been refactored from a string-based tag system to a **Unity-style Integer Layer System**. This creates a simpler, faster, and more robust foundation for collision detection.

### Key Concepts

1.  **Integer Layers (0-31)**:
    *   Layers are no longer just strings like "Player".
    *   They are mapped to a strict integer index from `0` to `31`.
    *   Index `0` is always `Default` (or "Base Layer").
    *   Indices `0-31` fit perfectly into a 32-bit integer for bitwise operations.

2.  **Bitwise Collision Matrix**:
    *   Instead of checking `if (A.layerName === "Player" && B.layerName === "Enemy")`, we use standard bit masking.
    *   Each Entity has:
        *   `category`: `1 << layerIndex` (Who am I?)
        *   `mask`: A 32-bit integer representing all layers I collide with.
    *   Collision Check: `(A.mask & B.category) !== 0 && (B.mask & A.category) !== 0`

3.  **Single Source of Truth**:
    *   **Configuration**: `useProjectSettingsStore` (Vue Store) holds the persistent data.
    *   **Runtime Map**: `SceneManager` maintains the `Name <-> Index` mapping.
    *   **Execution**: `PhysicsSystem` (Matter.js) executes the logic using the indices.

---

## Data Flow & Synchronization

The most critical part of this architecture is ensuring the **Editor Settings** correctly propagate to the **Runtime Engine**.

### 1. Configuration (Editor)
*   **File**: `useProjectSettingsStore.ts`
*   **Data**: `settings.layers` (Array of strings) and `layerCollisionMatrix` (Object: Index -> 32-bit Mask).
*   **Action**: When "Play" is clicked, or settings are applied:
    ```typescript
    // Sync Name->Index Map
    SceneManager.setProjectLayers(settings.layers);

    // Send Matrix to Physics Engine
    engine.getPhysics().updateCollisionConfig(settings.layers, settings.physics.layerCollisionMatrix);
    ```

### 2. Runtime Execution (Engine)
*   **File**: `PhysicsSystem.ts`
*   **Input**: Receives the Matrix via `updateCollisionConfig`.
*   **Logic**:
    1.  On each frame (`syncBodies`), it checks an Entity's `layer` (string).
    2.  Resolves it to an `index` via `SceneManager.getLayerIndex(name)`.
        *   *Fallback*: If Name not found -> Default to Index 0.
    3.  Sets the Matter.js body properties:
        *   `collisionFilter.category = 1 << index`
        *   `collisionFilter.mask = matrix[index]`

### 3. The "Play Mode" Sync (Critical Fix)
We discovered that `PhysicsSystem` needs to be hot-reloaded when entering Play Mode.
*   **File**: `useEditorStore.ts` -> `playGame()`
*   We explicitly call `await projectSettings.applySettings()` **immediately before** `engine.startSimulation()`.
*   This guarantees that the Physics Engine has the latest Matrix even if it was just modified in the UI.

---

## Debugging

If collisions act strangely (e.g. passing through objects or colliding when they shouldn't):

1.  **Check the Logs**:
    *   In `PhysicsSystem.ts`, enable the optional collision logger.
    *   Look for `Bitwise Check: FALSE` (Should Ignore) vs `TRUE` (Valid Collision).

2.  **Verify the Matrix**:
    *   In `ProjectSettingsManager`, ensure the JSON is saving the matrix as `numbers` (e.g. `{-513, -1}`).
    *   Mask `-1` (`0xFFFFFFFF`) means "Collide with Everything".
    *   If a custom layer has mask `-1`, the configuration update failed.

3.  **Verify Layer Indices**:
    *   Open `SceneManager.ts` or log `SceneManager.layers`.
    *   Ensure "Player" maps to a unique index (e.g. 8) and is not `-1` or `0`.

---

## Future Improvements

*   **Layer Sorting**: Currently, Layer ID determines Z-Index/Sorting order implicitly. We may want to separate "Sorting Layer" from "Physics Layer" in the future (like Unity).
*   **32+ Layers**: If we need >32 layers, we need BigInt masks or a custom matrix class (Matter.js supports 32-bit by default).
