# Outcome

In the Module Overview table, show each nested subtask's own values in the same visible columns as its parent. The table keeps the module groups and the expandable parent rows.

# Scope

The shared work-item table uses its selected columns and column widths for nested rows. This includes type, estimated time, status, due date, cycle, and any visible custom fields. A nested row shows values for inspection and its title opens the subtask. Empty fields use the normal table placeholder.

## Directory structure

### Modified

- `apps/web/src/features/work-items/components/table/TableRow.tsx` supplies the table columns to nested rows.
- `apps/web/src/features/work-items/components/table/TableRowSubtasks.tsx` renders indented subtask titles and the selected cells on the same grid.

### Created

- `apps/web/src/features/work-items/components/table/TableRowSubtasks.test.tsx` covers subtask values and column order.

# Non-goals

- Timeline, board, and calendar layout changes.
- Inline editing in nested rows or changes to saved views, task data, or progress rules.
- Commit, push, and deployment require separate authorization.

# Acceptance examples

- With subtasks shown inside their parents in a table, expand a parent. Each direct subtask appears beneath that parent with its title indented and its cells aligned to the visible headers in their configured order and widths.
- A subtask with a type, estimated time, due date, cycle, status, and a populated visible custom field displays its own values. Empty values use the table placeholder.
- Collapsing the parent hides its nested rows, and selecting a nested title opens that subtask. The existing separate-row option continues to control whether a subtask also appears as a standalone row.
