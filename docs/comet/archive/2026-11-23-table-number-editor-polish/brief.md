# Outcome

Give editable numeric cells a compact control that keeps the number legible in narrow table columns.

# Scope

Group the number input and save icon into one control. Hide the browser's spinner buttons to give the input more room. Use the table's typography and theme colors, with a visible focus indicator in light and dark themes. Apply this to editable numeric custom fields on task and subtask rows.

## Directory structure

### Modified

- `apps/web/src/features/work-items/components/table/` opts numeric cells into the compact appearance.
- `apps/web/src/components/common/fields/InlineTextField.tsx` renders the compact input and save control.

# Non-goals

Table layout, editors outside numeric table cells, numeric value rules, and delivery progress calculation.

# Acceptance examples

- In light and dark themes, an editable numeric table cell shows a compact input and save icon within the existing column width. The focused editor has a visible focus indicator, the spinner buttons are hidden, and the number has room to display.
- Populated and empty numeric cells on task and subtask rows still focus on one activation. Enter and the save icon save the value, explicitly saving a blank clears the field, and Escape or clicking outside discards the draft.
- Read-only and calculated numeric cells display their values. Issue details and other table editors keep their current appearance and behavior.
