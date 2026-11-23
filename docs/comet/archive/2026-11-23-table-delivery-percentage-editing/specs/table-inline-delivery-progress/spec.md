# Table editing and delivery progress

## Inline editing

Expanded second- and third-level rows use the table's built-in and custom field editors. An edit targets the current row. Status, dates, and applicable custom fields use the same controls as root rows. When time estimates are enabled, the estimate column accepts the existing hours-and-minutes format. Users with read-only access see field values.

## Delivery progress and weight columns

The table identifies delivery progress and weight fields by their project bindings. It shows manual values, including zero and decimals, with a percent unit. The progress column shows the effective progress for modules and nodes with contributing tasks. These calculated values are read-only. Unset values show the empty marker. If the workflow cannot calculate progress, the cell shows the workflow reason when available.

Completed execution tasks and completed nodes without contributing tasks display 100 percent. Open execution tasks and nodes without contributing tasks use the manual editor. Reopening restores the entered value for eligible items. Active maintenance handoffs follow the workflow's editing restrictions.

When a bound percentage cell can be edited, Enter, leaving the input or clicking Save commits a changed valid value to the current row. The entered number represents percentage points. Saving an empty input clears the value. Escape discards the draft. Invalid and unchanged inputs leave the stored value intact. Other fields use the standard table editors.
