---
description: Implement a robust Engine Preferences system, starting with Grid Settings and Panel Toggles.
---

# Engine Preferences System (Part 1)

This workflow focuses on establishing a centralized Preferences system and implementing the Grid Settings and Header UI enhancements.

## Phase 1: The Preferences Store
Create `usePreferencesStore` to manage editor-wide settings that persist (unlike `useEditorStore` which might be session-transient or project-specific).
-   **Persistence**: Sync with `localStorage` or `editor_config.json`.
-   **State**:
    -   `grid`: { width, height, color, offsetX, offsetY, isIsometric }
    -   `panels`: { hierarchy: bool, inspector: bool, console: bool, assets: bool, ... }
    -   `theme`: (Move from useThemeStore? Or keep separate linked)

## Phase 2: Grid Settings Implementation
1.  **Defaults**: Set Grid defaults to 32x32px.
2.  **Menu**: Add `File -> Preferences -> Grid Settings`.
3.  **UI Panel**: Create `GridSettingsModal.vue` (or a section in a generic Preferences Modal).
    -   **Inputs**:
        -   Line Color (ColorPicker)
        -   Cell Width (Input Number)
        -   Cell Height (Input Number)
        -   X Offset (Input Number)
        -   Y Offset (Input Number)
        -   Isometric (Checkbox)
4.  **Integration**:
    -   Connect `ScenePanel.vue`'s GridSystem to `usePreferencesStore.grid`.
    -   Ensure real-time updates (reactivity).

## Phase 3: Header & Panel Toggles
1.  **Right Menu Area**: Enhance the App Header to have a dedicated "Right Section".
2.  **Grid Icon**: Add a toggle icon in the header that opens the Grid Settings (or toggles visibility).
    -   *Correction*: User asked for "Icon in header... menu to the right".
3.  **Panel Icons**:
    -   Create toggle icons for each active Dock Panel (Hierarchy, Scene, Inspector, Assets, Console).
    -   **Style**: Simple, monochromatic icons (Lucide/Heroicons).
    -   **Theme Aware**: White for Dark Mode, Black for Light Mode.

## Implementation Steps

### Step 1: Create Store
-   `src/stores/usePreferencesStore.ts`
-   Define state and persistence logic.

### Step 2: Grid Logic
-   Update `GridSystem.ts` to accept configuration object.
-   Update `ScenePanel.vue` to watch store and update grid.

### Step 3: UI Components
-   Create `PreferencesDialog.vue` (using standard Dialog component).
-   Add form fields for Grid.

### Step 4: Header Update
-   Modify `AppHeader.vue` (or equivalent).
-   Add Icons mapped to `useLayoutStore` (or `usePreferencesStore`). 
    -   *Note*: `dockview` controls panel visibility. We need to check if we can toggle them programmatically via ID.

### Step 5: Verification
-   Change grid color -> Scene updates immediately.
-   Toggle "Inspector" icon -> Inspector Panel hides/shows.
