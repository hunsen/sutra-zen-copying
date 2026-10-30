# Palette's UX & Accessibility Journal

## 2025-02-14 - Modal Form Accessibility & Focus Ring Aesthetics in Dark Zen Theme
**Learning:** In dark/amber-themed modal dialogs (like `SealAndExportModal`), form controls often lack explicit `htmlFor` / `id` bindings and keyboard focus visibility. Standard browser focus rings clash with dark stone backgrounds.
**Action:** Always link form labels using explicit `htmlFor` / `id` and apply `focus-visible:ring-2 focus-visible:ring-amber-500 focus-visible:outline-none` so keyboard navigation (Tab/Shift+Tab) is highlighted gracefully without affecting pointer clicks.
