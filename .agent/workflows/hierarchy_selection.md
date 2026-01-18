---
description: Restore entity selection functionality in the Hierarchy Panel
---

# Hierarchy Selection Workflow

This workflow addresses the regression where entities cannot be selected in the Hierarchy Panel, likely caused during the "Immortal Pixi Canvas" refactor. The fix involves restoring the selection logic and event listeners in `HierarchyPanel.vue`.

## 1. Fix Selection Logic in `HierarchyPanel.vue`

The `select` function in `HierarchyPanel.vue` has the store update commented out. We need to re-enable it.

- [ ] Open `src/editor/panels/HierarchyPanel.vue`
- [ ] Locate the `select` function (around line 60).
- [ ] Uncomment the line: `editorStore.selectEntity(id);`

```typescript
const select = (id: string | undefined) => {
    // console.log(`[Hierarchy] Selecting: ${id}`);
    if (!id) return;
    editorStore.selectEntity(id); // Uncomment this
};
```

## 2. Add Click Handler to Entity List

The entity list items (`<li>`) are missing a click event listener to trigger the selection.

- [ ] Locate the `<li>` element in the `v-for="entity in entities"` loop (around line 207).
- [ ] Add the `@click.stop` handler calling the `select` function.

```html
<li 
    v-for="entity in entities" 
    :key="entity.id"
    :id="`hierarchy-item-${entity.id}`"
    @click.stop="select(entity.id)"   <!-- ADD THIS LINE -->
    @dblclick="focus(entity.id)"
    @contextmenu.stop.prevent="showContextMenu($event, entity.id || '')"
    :class="[
        // ... classes
    ]"
>
```

## 3. Verify Selection Sync

- [ ] Run `npm run dev`
- [ ] Open the Editor.
- [ ] Click on an entity in the Hierarchy.
- [ ] Verify:
    1. The entity row highlights in the Hierarchy (Blue background).
    2. The entity is selected in the Scene (Gizmos appear).
    3. The Inspector panel updates to show the selected entity's properties.

## 4. (Optional) Multi-Select Support

If multi-selection is needed in the future:
- Update `select` to handle `Shift` or `Ctrl` modifiers.
- Use `editorStore.selectEntities(...)`.
