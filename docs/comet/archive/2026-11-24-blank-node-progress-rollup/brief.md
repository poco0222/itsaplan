# Outcome

Calculate weighted plan progress when a delivery node has no contributing execution tasks and its own progress is blank. Its effective progress is 0% in that case.

# Scope

Apply the rule to delivery nodes in the Plan hierarchy. The Plans list, Plan detail, and Work Items table group header use the same weighted result. The node's calculated progress shows 0%. Its editable progress field can stay blank. A completed node contributes 100%.

## Directory structure

### Created

- `packages/db/drizzle/`: Add a migration for the delivery progress calculation.

### Modified

- `packages/db/drizzle/meta/`: Register the migration.
- `apps/api/src/modules/delivery-workflow/__tests__/integration/delivery.test.ts`: Verify effective node progress and weighted plan progress through the API.

# Non-goals

- Keep existing saved progress field values. Apply the default when calculating progress.
- Limit the change to the Plan hierarchy. Legacy delivery modules and weekly reports are outside scope.

# Acceptance examples

- Three nodes without contributing execution tasks, with blank progress and weights of 40%, 40%, and 20%, give the plan 0%. The plan list, plan detail, and table group header show 0%. Each node keeps an empty editable field and shows 0% as its calculated progress.
- Setting the 40%-weighted node's progress to 25% gives the plan 10%. Marking a blank 40%-weighted node completed gives the plan 40% when the remaining nodes are at 0%.
- A plan without contributing nodes, an invalid node weight allocation, or a node whose execution progress cannot be calculated still shows its corresponding unavailability reason.
