# Outcome

Organize Rolling Plan around plans, nodes, and execution tasks. A plan represents a goal, a node represents a result to deliver, and an execution task represents a concrete action under a node.

# Scope

Enable the new hierarchy for the local Rolling Plan project (`pocoy.ROLL`). At the planning snapshot it has no built-in plans, four active delivery modules, 13 nodes, 15 execution tasks, and no recorded maintenance handoffs. Two modules and two nodes have invalid weight allocations. Rolling Plan has no configured weekly report.

Create one built-in plan for each active module. Carry over its title, description, and any planned due date. Map its current state to the corresponding plan status. Link the existing nodes to the resulting plan. Execution tasks remain under their existing nodes and appear with them in the plan's work item view. Display the working types as 节点 and 执行 in Rolling Plan. Archive superseded module records, with a link from each plan to the original record for its history and attachments.

Show the weighted delivery percentage in the plan list and detail. Preserve the existing node and execution progress and state rules, field values, and weights. Show missing or invalid allocations as unavailable with the reason. A user marks delivery complete using the standard plan status action.

Implement an explicit project-scoped migration with a preview. Verify the migration and its failure and retry behavior in the test database before local cutover. The delivery step backs up and migrates only the local Rolling Plan project after the result is accepted. The snapshot counts describe the planning baseline; preview reports the current records and any conflicts before it applies.

## Directory structure

### Modified

- `packages/db/drizzle/` updates delivery hierarchy validation and aggregation for projects using built-in plans.
- `apps/api/src/modules/delivery-workflow/`, `apps/api/src/modules/initiatives/`, and `apps/api/src/modules/issues/` connect the configured delivery roles, plan progress, and work item mutations.
- The plan screens and API bindings in `apps/web/src/features/initiatives/` and `apps/web/src/lib/api/` show the weighted result and the node and execution hierarchy. Relevant locale messages live under `apps/web/messages/`.
- Rolling Plan data includes the created plans, node links, type names, and archived module records.

### Created

- An explicit project-scoped migration command under `scripts/`, with tests for the hierarchy, weighted progress, and migration at the relevant API, Web, and database boundaries.

# Decisions

- The top level uses the application's built-in Plans. Each existing module maps to a plan, its nodes belong to that plan, and execution tasks remain under their existing nodes.
- Plan progress uses the existing node weights. Preserve the current node and execution progress rules.
- Users mark a plan complete directly after delivery. The plan has no separate maintenance handoff or reversal step.

# Non-goals

- Existing project workflows outside the selected project, weekly report behavior, and saved reports.
- Automatic repair of historical weights or rewriting of work item history.
- Production rollout, Git commit, and push.

# Acceptance examples

- A user can open a built-in plan, see its nodes, and expand a node to open its execution tasks. Creating a node in a plan and adding an execution task under it use the same hierarchy. An execution task appears with its node when the node changes plans.
- The plan list and detail report 58 percent for a completed node weighted 30 percent and a node at 40 percent weighted 70 percent. Edits and reopens refresh the result. Canceled nodes are excluded. Empty groups and invalid weights or unavailable child progress show an unavailable result and the relevant reason.
- Node and execution progress entry, weighted node rollup, and status changes follow the existing rules. A plan can be marked complete through its standard status action after delivery.
- A migration of the planning snapshot creates four plans, relinks 13 nodes, preserves the 15 execution task parent links, and archives the four source modules. Plan title, description, status and planned date reflect the source. Work item IDs, existing statuses, status history, field values, and attachments remain accessible. Each plan links to its archived source module.
- Preview leaves project data intact. An unsuccessful apply has no partial effect, and rerunning a successful migration creates no duplicates. Other projects retain their current behavior.
