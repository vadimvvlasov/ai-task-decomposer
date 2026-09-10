# Mini Kanban frontend refinement

## Scope
Polish the existing two-page Kanban experience without changing routes, data structures, or anything under `src/services/kanban/`.

## Implementation
- Add a shared sticky header with a home logo, board-name breadcrumb support, the existing toast renderer, and Mini Kanban document metadata.
- Refine the board list with loading placeholders, an illustrated empty state, created dates, clear inline name validation, and preserved delete confirmation.
- Rework the board page for one-column mobile and three-column desktop layouts, including loading placeholders, a dedicated not-found state, count pills, empty-column actions, and inline board renaming through the existing rename operation.
- Upgrade card tiles with subtask progress, priority and AI indicators, hover/focus polish, and one accessible Move menu for column and order changes with unavailable actions disabled.
- Improve card details with title validation, visible save progress, a description prompt, and retained keyboard-friendly manual subtask entry.
- Improve AI suggestions with the new label, request progress, retry after failure, editable custom rows, conditional rationale, the specified fallback message, and save-only-on-apply behavior.

## Technical details
- Reuse existing shadcn controls, semantic Tailwind tokens, DM Sans, and Space Grotesk.
- Keep persistence and all writes behind the existing Kanban service and React Query mutation hooks.
- Add only presentation components where useful; do not alter the service interface or route paths.
- Ensure icon controls have accessible names and interactive elements show keyboard focus.

## Verification
- Run the existing tests and targeted checks.
- Exercise board creation, rename, card movement, detail editing, AI retry/apply, deletion, toast feedback, and refresh persistence.
- Inspect the live UI at 375px and desktop widths, and confirm no browser console errors.
