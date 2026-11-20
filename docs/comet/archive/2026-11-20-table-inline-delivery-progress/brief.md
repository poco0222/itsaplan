# Edit subtasks and show delivery progress in the table

## Scope

The Module Overview table supports inline editing on expanded second- and third-level rows. The configured delivery progress column distinguishes editable progress from calculated progress. Existing project permissions and delivery rules apply to table edits.

- `apps/web` renders the editable and calculated cells.
- `apps/api` identifies the bound field and reports whether its progress can be edited.
- `specs/table-inline-delivery-progress/spec.md` records the table behavior.

## Acceptance examples

- Editors can change status, dates, time estimates and applicable custom fields directly on expanded second- and third-level table rows. Edits target the selected issue and read-only viewers see plain values.
- The configured progress column shows read-only rollups on delivery modules and nodes with contributing tasks, and explains when allocations prevent a rollup. Other fields keep their normal editors.
- Completed execution tasks and completed nodes without contributing tasks show 100%. Open execution tasks and independent nodes allow manual progress, and reopening restores the entered value.

## Delivery

Archive the accepted work, open a pull request against the fork's main branch, and merge after the pull request checks pass. Deploy the merged revision to the local instance.
