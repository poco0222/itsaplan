# Outcome

Track delivery and maintenance for a complete work module. Use work items for the module, its delivery nodes and execution tasks. Calculate delivery progress and completion from that hierarchy. Let an authorized user transfer a finished module to maintenance and undo a mistaken transfer.

# Scope

- Configure the workflow per project with four work item roles. Reuse existing parent links, configured types, numeric fields, statuses, assignees and due dates. Plans can group work items.
- Show effective progress and explain unavailable progress. Check weights and update parent completion on the server. Retain canceled items as history.
- Record a module's delivery or maintenance phase separately from its delivery status. Add confirmation and reversal controls with permission checks and persistent history.
- Use status history for completion dates. Preserve the completed status of imports whose original completion date is unknown. Provide a way to identify those records explicitly.
- Verify in a test environment with project fixtures. Cover valid and invalid allocations, cancellation, reopening, handoff, reversal, history and concurrent updates.

## Directory structure

### Created

- `apps/api/src/modules/delivery-workflow/` owns project setup, aggregate and transition rules, and their tests.

### Modified

- `apps/api/src/modules/issues/` connects work item mutations to the delivery rules and exposes progress and dates.
- `apps/web/src/features/settings/`, `apps/web/src/features/issue/` and `apps/web/src/features/work-items/` expose setup, progress and phase controls. Locale files contain the UI copy.
- `packages/db/` persists workflow metadata and audit history where the existing data model needs a migration.

# Decisions

- Manage a module as a level-one work item. Nodes and execution tasks are levels two and three. A maintenance item represents one issue under the module and can have a checklist. Substantial new functionality that needs its own planning and acceptance starts a new delivery module.
- Each sibling group must allocate exactly 100 percent using stored precision before aggregate progress and automatic completion are available.
- Completed tasks contribute 100 percent. Open tasks contribute the entered percentage and default to zero when empty. Nodes without contributing tasks allow direct progress entry and manual completion.
- Handoff is manual and applies to the whole module after its delivery is complete. Require existing workflow configuration and work item edit permissions for handoff and reversal. Reversal requires a reason and preserves the earlier handoff and maintenance history.
- The Rolling Plan audit found 38 old completions with system timestamps clustered during the import window. Treat the selected records' completion dates as unknown and keep their status history.
- Keep the hierarchy, aggregate and phase rules in a single change because they share the same work item mutations and integrity checks.

# Non-goals

- Local development and test verification are in scope. Live setup, moving real records, release and Git delivery are separate actions.
- Existing weekly snapshots and report generation follow the weekly report contract. Reuse its arithmetic where the rules match.
- The workflow applies to projects that explicitly enable it.

# Acceptance examples

- A configured project supports the four work item roles and their specified parent links. Projects without setup retain standard work item behavior.
- Delivery progress follows both levels of weighted arithmetic and handles manual input, completion, empty progress, cancellation and unavailable allocations.
- Completion and reopening update applicable parents under the same status and weight rules.
- An authorized handoff validates delivery, records the actor and time once, preserves the delivery result, and keeps maintenance work apart from delivery.
- Authorized reversal records actor, time and reason and retains handoff history and maintenance items.
- The planned deadline remains distinct from the effective completion time. Historical imports with unknown dates count as completed and are excluded from date comparisons.
- Existing records can be enrolled explicitly, changes are checked on the server, and concurrent or retried requests preserve a consistent delivery result.

# Open questions

None.
