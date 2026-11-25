# Status-based custom field updates

## Project configuration

Users with permission to manage project statuses can configure and remove automatic custom field updates for a destination status. The supported actions are saving a fixed numeric value to a number field and saving the transition date in a configured time zone to a date field. The target fields must belong to the project and match the action type. Apply a type-specific field only to its applicable work item type. Rules can be set independently by project and status. Projects begin with no rules.

## Status transitions

When an existing work item enters a configured status, apply its rules to the item's stored custom field values in the same successful operation as the status change. Use the same behavior from detail, table, Kanban, the API, and delivery workflow transitions. Saving the same status, rejecting a transition, or enabling a rule for items already in that status preserves their field values.

ROLL can configure 已完成 to save `100` in 完成进度 (%) and the transition's local date in 实际完成时间 using Asia/Taipei. Reloaded detail and the custom field API read these saved values. The weight continues to come from 占比 (%). Node progress based on execution tasks continues to use the weighted calculation.

## Reopening

When a work item returns from completed to an open status, restore each number written by a completion rule to the value it held before the rule first wrote it within that completion cycle. Restore an originally empty field to empty. Clear any date written by a completion rule for that cycle. A move between completed statuses does not discard the previous number needed on reopening. A later completion uses a new transition date. Weighted plan progress reflects the reopened item's effective progress.
