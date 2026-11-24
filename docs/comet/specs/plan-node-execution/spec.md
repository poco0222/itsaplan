# Plan, node, and execution hierarchy

## Hierarchy

Rolling Plan uses the built-in Plans feature for its top-level goals. Delivery nodes are work items linked to a plan. Execution tasks are child work items of their delivery node. A plan's work item view shows the linked nodes and lets users expand each node to view and open its execution tasks. Users can create nodes in a plan and execution tasks under a node. When a node changes plans, its execution tasks appear with it. New work in Rolling Plan uses the 节点 and 执行 types.

## Progress and completion

The plan list and detail display the sum of each contributing node's effective percentage multiplied by its weight and divided by 100. A 100-percent node weighted 30 and a 40-percent node weighted 70 yield 58 percent. Canceled nodes are excluded. A plan with no contributing nodes, an invalid weight allocation, or an unavailable contributing node percentage has unavailable progress. Show the reason for an unavailable calculation. All contributing weights are between 0 and 100 and sum to 100 at stored precision. Round only for display.

Nodes retain weighted execution progress and automatic status changes under the delivery workflow. A node without contributing execution tasks retains direct progress entry and status control. Completed nodes and execution tasks contribute 100 percent. Reopening restores the calculation from current inputs. Work item edits and status changes refresh the plan's weighted progress. Users mark a plan complete directly using the standard plan status. Completion has no separate maintenance handoff or reversal step.

## Table plan progress

In the signed-in Work Items table with Plan as its primary grouping, a visible plan group header shows the plan's weighted progress in the visible column bound to delivery-node progress. The value is read-only and stays aligned with that column when it moves or resizes. It is visible when the group is collapsed or expanded. Hiding the bound column hides the value.

Use the same whole-plan result, display precision, and unavailable reason as the Plans list. The value includes eligible nodes even when a table filter hides them, and refreshes after work item changes. For example, a 100-percent node weighted 30 and an 84-percent node weighted 70 yield 88.8 percent.

The No plan group, projects without weighted plan progress, and other primary groupings do not show a plan summary. The summary is only available to users permitted to read the plan progress in the signed-in project.

## Existing work

For the selected project, map each active delivery module to one built-in plan with its title, description, equivalent current status, and planned due date. Link that module's delivery nodes to the plan. Retain each execution task's existing parent node. Archive the superseded modules and link to their original records from the new plans. Retain work item IDs, statuses, history, attachments, and field values. Leave existing weight allocations as entered.

Preview reports the proposed mapping and any conflicts without mutating project data. Apply the mapping atomically within the selected project. Repeating the apply must not duplicate plans or lose links. Projects outside the selected migration retain their existing hierarchy and workflow behavior.

## Requirement: plan-node-execution.blank-node-progress Effective progress for nodes with a blank value

In the Plan hierarchy, a contributing node outside the completed state with no contributing execution tasks and a blank progress field has an effective progress of 0%. The node displays that effective percentage and contributes it to weighted plan progress. The editable field can remain blank. Completed nodes contribute 100%.

A node with contributing execution tasks uses their weighted progress. Empty plans, invalid weight allocations, and unavailable execution rollups retain their calculation reasons.
