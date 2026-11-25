# Outcome

Let a project configure which work item custom fields are saved when its built-in status changes. In ROLL, moving an item to 已完成 can save `100` to 完成进度 (%) and the transition date to 实际完成时间.

ROLL-67 is a completed node with no execution children. Its stored progress and actual completion date are both empty. The delivery calculation contributes 100% for this completed node, and status history records when it entered the state. The screenshot documents the symptom. The read-only work item and project queries confirm the field values and types.

# Scope

Let users who can manage project statuses configure which existing fields to update when a work item enters a selected status. The first version supports saving a fixed number and saving the transition date. A date rule uses a consistent configured time zone. For ROLL, the selected fields are the existing number and date fields, and the date rule uses Asia/Taipei.

Apply matching rules to status changes of existing work items, including changes from work item detail, table, Kanban, API edits, and the delivery workflow. Changes to the status and its field values succeed or fail together. Restrict field targets to the project and the applicable work item type. Use existing custom field validation and keep calculated node progress based on its execution tasks.

When a completed work item returns to an open status, restore the number from before the completion rule first wrote it and clear the date written by that rule. An originally blank number becomes blank again. A later completion records the new transition date. This reverses the temporary completion values used by ROLL while retaining the progress entered before completion.

## Directory structure

### Modified

- `apps/web/src/features/settings/components/states/` adds configuration to existing status settings.
- `apps/api/src/modules/columns/` validates and stores the status rules under existing permissions.
- `apps/api/src/modules/issues/` and `packages/db/` apply rules to persisted status transitions and retain delivery workflow constraints.

### Created

- `specs/status-custom-field-writeback/spec.md` defines configuration, field updates, and reopening behavior.

# Non-goals

- Historical backfill, including work items already completed when the rule is enabled.
- A general automation builder with arbitrary triggers or action types.
- Changes to the weight field or how weighted delivery progress is calculated.

# Acceptance examples

- A user with project status settings access can save and remove number and date rules for a selected status. Reloading retains the saved rules. Invalid field types, fields from other projects, and unauthorized edits are rejected.
- After configuring ROLL, moving an eligible item to 已完成 saves `100` and the date of the transition in Asia/Taipei. The saved values appear in work item details and the custom field API after reload. The weight value is preserved.
- Matching transitions from detail, table, Kanban, API, and the delivery workflow apply the same rules. Rejected transitions and edits that retain the same status preserve the stored field values.
- Reopening a completed item restores its original number, including a blank value, and clears the date written by the completion rule. The next completion writes its own date. The plan recalculates from the reopened item's effective progress.
- Enabling a rule leaves existing data as stored until a matching transition occurs. Projects without rules retain their current behavior.
