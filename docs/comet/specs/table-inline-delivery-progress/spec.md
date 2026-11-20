# Table editing and delivery progress

## Inline editing

Expanded second- and third-level rows use the table's built-in and custom field editors. An edit targets the current row. Status, dates, and applicable custom fields use the same controls as root rows. When time estimates are enabled, the estimate column accepts the existing hours-and-minutes format. Users with read-only access see field values.

## Delivery progress column

The table identifies the progress field by its project binding. The bound column shows the effective progress for modules and nodes with contributing tasks. These values are read-only. When the workflow cannot calculate a value, the cell shows the workflow reason if available.

Completed execution tasks and completed nodes without contributing tasks display 100 percent. Open execution tasks and nodes without contributing tasks use the manual editor. Reopening restores the previous entered value for eligible items. Active maintenance handoffs follow the workflow's editing restrictions. Other fields use the standard table editors.
