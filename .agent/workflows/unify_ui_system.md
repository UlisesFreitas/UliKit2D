---
description: Unify Screen Modals, Dialogs and Toasts using Radix Vue
---

# Unify UI System (Dialogs & Toasts)

**Goal**: Replace inconsistent dialogs, alerts, and notifications with a unified, accessible, VS Code-styled system using `radix-vue`.

## 1. Analysis & Setup
- **Library**: `radix-vue` is already installed. It provides headless primitives for Dialogs, Toasts, Popovers, Context Menus, etc.
- **Styling**: Use existing Tailwind VS Code theme colors (`bg-bg-panel`, `border-border`, `text-text-primary`).

## 2. Shared Primitives Implementation
Create a set of reusable, styled components in `src/editor/components/ui/`:
- **BaseDialog**: Wrapper around `DialogRoot`, `DialogOverlay`, `DialogContent`.
    - Features: Blur backdrop, centered animation, focus trap, Esc to close.
- **BaseToast**: Wrapper around `ToastRoot`, `ToastViewport`.
    - Features: Slide-in animation, auto-dismiss, action buttons.

## 3. State Management (Services)
Instead of importing components everywhere, create a programmatic API via Pinia:
- **`src/stores/useUIStore.ts`**:
    - `modals`: Array of active modals (stackable).
    - `toasts`: Array of active notifications.
    - **Actions**:
        - `openModal(component, props)`
        - `closeModal(id)`
        - `showToast({ title, message, type, duration })`
        - `confirm({ title, message, onConfirm })` -> Returns Promise.

## 4. Overlay Container
- Create `src/editor/components/overlays/GlobalOverlay.vue`.
- Mount this once in `App.vue` or `DockLayout.vue`.
- It renders the active Modals and Toast Viewport from `useUIStore`.

## 5. Migration Strategy
Iteratively replace existing UI elements:
1.  **Native Alerts**: Replace `window.alert` and `window.confirm` with `uiStore.confirm()`.
2.  **Asset Picker**: Refactor `AssetPickerModal.vue` to use `BaseDialog` or be invoked via `useUIStore.openModal()`.
3.  **Notifications**: Replace `console.log("Saved")` with `uiStore.showToast("Project Saved")`.
4.  **Context Menus**: (Optional) Use `ContextMenu` primitive for file explorer right-clicks.

## 6. Verification
- Verify accessibility (Focus trap, Screen reader support).
- Verify styling consistency (Colors match VS Code theme).
- Verify keyboard navigation (Enter to confirm, Esc to cancel).

// turbo
npm run dev
