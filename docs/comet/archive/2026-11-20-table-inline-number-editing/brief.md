# Outcome

Edit a numeric custom field directly in its table cell. A single activation focuses its input.

# Current behavior

The built-in estimate time cell renders an inline input on activation. Numeric custom fields open a popover with the issue detail field control inside. The control starts as a pill, so a second activation is needed to enter the number.

# Scope

Use inline editing for editable numeric custom fields in the table, including completion progress and weight. Apply the same entry behavior to the top-level row and nested subtask rows. Preserve the numeric field's explicit save and cancel behavior and respect the existing calculated progress rules and edit permissions.

## Directory structure

### Modified

- `apps/web/src/features/work-items/components/table/` connects numeric cells to the shared control and covers the behavior in regression tests.
- `apps/web/src/components/common/fields/` hosts the field control with support for a table cell trigger.
- `apps/web/src/features/issue/components/fields/` uses the shared control for issue details.

# Non-goals

Field definitions and bindings, data migration, delivery calculation, and editing controls outside numeric table cells.

# Acceptance examples

- On an editable numeric custom field in a table, including Completion progress and Weight, one click or keyboard activation starts editing and focuses the input in that cell. This works for empty and populated cells on all three task levels.
- Enter or the save button commits a valid number. Explicitly saving an empty input clears the field. Escape or clicking outside discards the draft. The editor uses the existing field mutation and validation without opening the task or starting a drag.
- Derived delivery progress and other read-only or unavailable cells remain display values. The scope is numeric custom field entry in the table.
