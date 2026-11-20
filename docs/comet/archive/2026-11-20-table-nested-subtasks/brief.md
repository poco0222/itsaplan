# Outcome

Show three levels of work items in the table. The existing Default collapsed setting controls whether the subtask branches start folded.

# Scope

Apply the hierarchy to table layouts that render subtask rows. The first level is the top-level issue, the second is its direct subtask, and the third is that subtask's direct child. Use the current progress control where a subtask progress count is available.

## Directory structure

### Modified

- `apps/web/src/features/work-items/components/table/` renders third-level rows, handles the second-level fold control, and covers the behavior in its existing tests.

# Non-goals

Timeline and Kanban changes, hierarchy creation rules, progress calculation, API changes, and stored settings.

# Acceptance examples

- With nested subtasks enabled and Default collapsed off, the table shows all three levels without any clicks. In nested-only display, third-level rows appear once, below and further indented under their own parent, with the same configured cells as second-level rows.
- With Default collapsed on, the table initially shows top-level rows in nested-only display. Expanding a top-level row reveals its second-level rows with their branches folded. For branches with a subtask progress count, that control on a second-level row expands or collapses its own third-level rows by pointer or keyboard. Collapsing the top-level row hides both levels. Changing Default collapsed reapplies the setting to the table's subtask branches. Turning off nested subtasks hides the nested rows.
- Selecting a second- or third-level title opens that issue. Activating the fold control only changes the branch and does not open an issue or initiate dragging.
