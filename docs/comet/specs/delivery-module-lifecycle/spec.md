# Delivery module lifecycle

## Project setup and hierarchy

An authorized editor configures four distinct work item types for a project. The roles are module, delivery node, execution task and maintenance item. Bind numeric progress and weight fields that are available to the respective types. A shared project field can serve the same purpose at multiple levels. Persist bindings by ID. Setup and enrollment of existing records are explicit. Preserve existing associations, field values and deadlines. Projects without an enabled setup retain standard work item behavior.

A module is a root issue in the delivery tree. Delivery nodes and maintenance items are direct children of a module. Execution tasks are direct children of a delivery node. Use the native assignment, status and deadline controls. A maintenance item tracks one issue and can have a checklist. Plans can group work items. Surface enrolled items whose parent and role do not match so the project can correct them.

## Delivery progress

An open execution task uses its entered percentage, or zero when empty. A completed execution task has an effective progress of 100 percent. Reopening a task restores the use of its entered value.

A delivery node with contributing execution tasks derives progress from them. A node without contributing tasks allows direct progress entry and manual completion. It reports 100 percent when completed. A module derives progress from its delivery nodes. An empty module has unavailable progress.

For each group, multiply each contributing child's effective progress by its weight and sum the products divided by 100. Weights and entered percentages range from 0 through 100. All contributing weights must be present and sum to exactly 100 at stored precision. A missing or invalid allocation or an unavailable contributing rate makes the parent's derived progress unavailable. Show the affected allocation or input in the work item workflow. Round for display. Retain canceled records and exclude them from calculation and completion. Redistribute their weights among the remaining contributing items.

For example, a completed execution task with weight 30 and a second task with weight 70 at 40 percent yield 58 percent for the node. If the second task has no entered rate, the node reports 30 percent. If the second weight is 50, the node and any module relying on its result have unavailable progress.

## Delivery status

An eligible group completes its parent automatically when all contributing children are completed and the weight group is valid. Apply the same requirements to manual attempts to complete such a parent. Completion requires completed children even when progress is 100 percent. A delivery node without contributing execution tasks retains direct status control. A module must have contributing delivery nodes to complete.

Before handoff, reopening a completed execution task moves its completed node and module back to In progress. Recompute their effective progress from current inputs. Changes to contributing children, fields and statuses apply the same rules through the supported mutation paths. Show the effective state and progress in the work item workflow.

## Handoff and maintenance

Record the module's delivery or maintenance phase separately from normal delivery status. Handoff requires both workflow configuration and work item edit permission. Check the current module and contributing delivery nodes against the completion requirements before changing the phase. Record the actor and time once and place the entire module in maintenance. A repeated confirmation returns the existing handoff. Concurrent edits and handoff must preserve the same eligibility rules and a consistent result.

In maintenance, preserve the completed delivery result. Reject changes to delivery structure, weights or status that would change that result while handoff is active. Add maintenance work directly to the original module, with its own status. Keep it out of delivery progress, completion, dates and scope. A feature that needs its own schedule and acceptance uses a new delivery module.

A caller with the same permissions can reverse an active handoff by supplying a reason. Record the reversal actor, time and reason. Restore the delivery phase and keep the original handoff, completed delivery history and existing maintenance items accessible. Subsequent delivery edits follow the delivery-phase rules.

## Dates and historical records

The built-in due date is the planned deadline. Use the status history transition to the current completed period as the effective completion timestamp. Work completed again after reopening uses the new completion period.

Identify imported completions with unknown dates by an explicit list or verified source metadata. Preserve their completed status, planned deadline and status history. Show their effective completion date as empty for the imported completion period. They count as completed and contribute to progress under the normal status rules. Date-based performance calculations in the workflow use known completion dates. Existing weekly snapshots and unrelated work use their existing date rules.
