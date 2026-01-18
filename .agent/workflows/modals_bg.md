---
description: Check and fix modal and toaster background transparency issues.
---

# Fix Modal & Toaster Backgrounds

The goal is to ensure all Modals, Dialogs, Toasts, and Notifications have a solid, theme-compliant background color (e.g., `bg-bg-base` or `bg-bg-panel`) and are not transparent.

## 1. Inspect Base UI Components

First, check the shared base components in `u:/UliKit2D/src/editor/components/ui`.

- [ ] View `u:/UliKit2D/src/editor/components/ui/BaseDialog.vue`.
  - Look for the root `DialogContent` or `div` class.
  - Ensure it has `bg-bg-base` or `bg-zinc-900` (or appropriate theme variable).
  - Verify it does **not** have `bg-transparent` unless intended for a specific overlay.
  - Ensure `z-index` is correct (usually high, e.g., `z-50`).

- [ ] View `u:/UliKit2D/src/editor/components/ui/BaseToast.vue`.
  - Check background classes. Toasts should usually be `bg-bg-header` or `bg-zinc-800`.

## 2. Inspect Specific Modals

Check key modals in `u:/UliKit2D/src/editor/components/modals` to see if they override styles or lack base classes.

- [ ] `AddComponentModal.vue`
- [ ] `AssetPickerModal.vue`
- [ ] `ProjectSettingsModal.vue`

**Common Issues to look for:**
- Missing background utility class (e.g., just `border` and `p-4` but no `bg-`).
- Usage of `bg-opacity-xx` that is too low.
- "Glassmorphism" attempts (`backdrop-blur`) without a fallback fallback background color.

## 3. Global CSS Check

- [ ] Check `u:/UliKit2D/src/style.css` for any global overrides on `DialogOverlay` or `DialogContent` that might be setting `background: transparent`.

## 4. Fix Strategy

1.  **Prefer Base Fix**: If possible, add the background color to `BaseDialog.vue` so it propagates to all modals using it.
2.  **Specific Fix**: If a modal doesn't use `BaseDialog`, add the class explicitly to its root container.
3.  **Theme Variables**: Use `var(--bg-base)` or Tailwind `bg-bg-base` to respect the theme (Light/Dark mode).

## 5. Verification

1.  Open the Editor.
2.  Trigger a modal (e.g., "Add Component" or "Project Settings").
3.  Verify it acts as an opaque layer on top of the content.
4.  Trigger a Toast (e.g., Save Project).
5.  Verify text is readable and background is solid.
