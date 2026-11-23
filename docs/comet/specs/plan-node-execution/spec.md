# Plan, node, and execution hierarchy

## Hierarchy

Rolling Plan uses the built-in Plans feature for its top-level goals. Delivery nodes are work items linked to a plan. Execution tasks are child work items of their delivery node. A plan's work item view shows the linked nodes and lets users expand each node to view and open its execution tasks. Users can create nodes in a plan and execution tasks under a node. When a node changes plans, its execution tasks appear with it. New work in Rolling Plan uses the 节点 and 执行 types.

## Progress and completion

The plan list and detail display the sum of each contributing node's effective percentage multiplied by its weight and divided by 100. A 100-percent node weighted 30 and a 40-percent node weighted 70 yield 58 percent. Canceled nodes are excluded. A plan with no contributing nodes, an invalid weight allocation, or an unavailable contributing node percentage has unavailable progress. Show the reason for an unavailable calculation. All contributing weights are between 0 and 100 and sum to 100 at stored precision. Round only for display.

Nodes retain weighted execution progress and automatic status changes under the delivery workflow. A node without contributing execution tasks retains direct progress entry and status control. Completed nodes and execution tasks contribute 100 percent. Reopening restores the calculation from current inputs. Work item edits and status changes refresh the plan's weighted progress. Users mark a plan complete directly using the standard plan status. Completion has no separate maintenance handoff or reversal step.

## Existing work

For the selected project, map each active delivery module to one built-in plan with its title, description, equivalent current status, and planned due date. Link that module's delivery nodes to the plan. Retain each execution task's existing parent node. Archive the superseded modules and link to their original records from the new plans. Retain work item IDs, statuses, history, attachments, and field values. Leave existing weight allocations as entered.

Preview reports the proposed mapping and any conflicts without mutating project data. Apply the mapping atomically within the selected project. Repeating the apply must not duplicate plans or lose links. Projects outside the selected migration retain their existing hierarchy and workflow behavior.
