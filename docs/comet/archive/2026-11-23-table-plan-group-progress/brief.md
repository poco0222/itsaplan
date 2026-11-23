# Outcome

Show a plan's weighted completion progress in the Work Items table so users can check it where they update the plan's work items.

# Scope

Show the existing plan delivery percentage in the visible column for the project's bound delivery-node progress field when the primary table grouping is Plan. Align the read-only value with that column even when columns move or resize. Show it in both collapsed and expanded plan rows.

Use the calculation and display precision from Plans. The result covers the whole plan and follows work item changes while the table is open. Filtering the table can change which rows are visible. It does not change the displayed percentage of a visible plan.

Show the existing calculation reason when progress is unavailable. Zero is a valid percentage. A group with no assigned plan, or a project without weighted plan progress, has no summary value. Hiding the progress column hides the summary.

## Directory structure

### Modified

- `apps/api/src/modules/` provides project-scoped plan progress through the existing plan delivery calculation.
- `apps/web/src/lib/api/endpoints/` and `apps/web/src/services/` supply the plan totals to the work items table and refresh them on relevant changes.
- `apps/web/src/features/work-items/components/table/` renders and verifies the read-only summary in the matching column.
- `docs/comet/specs/plan-node-execution/spec.md` records the table display behavior on archive.

## Source coverage

Image #1 is a UI reference. The requirement covers the highlighted intersection of the plan group headers and the completion progress column in Work Items → Module Overview. The visible node rows provide the inputs for an illustrative calculation. Other columns, controls, and screen contents give context.

| Source item and location | Read state | Requirement or context | Spec location | Acceptance ID | Coverage | Reason |
| --- | --- | --- | --- | --- | --- | --- |
| Image #1, red outline over the completion progress column at the plan headers | complete | Put each plan's progress in the highlighted column on the group header, including collapsed groups. | `specs/plan-node-execution/spec.md`, Table plan progress | A1 | covered | The outline gives the location. |
| Image #1, expanded group with node values of 100% at 30% weight and 84% at 70% weight | complete | Example yielding 88.8% using the existing plan calculation. | `specs/plan-node-execution/spec.md`, Table plan progress | A2 | covered | The shown values illustrate the existing calculation. |
| User's request alongside Image #1 | complete | Show whole-plan completion progress where users handle work items without navigating to Plans. | `specs/plan-node-execution/spec.md`, Table plan progress | A1, A2, A3 | covered | The work items table is the regular entry point. |

# Non-goals

Plan editing, progress formulas, board and timeline display, secondary grouping summaries, row editors, and public share views are outside this change.

# Acceptance examples

- In the signed-in Work Items table primarily grouped by Plan, every visible plan group header shows a read-only value aligned with the visible bound node progress column when collapsed or expanded. Moving or resizing the column maintains alignment. Hiding the column hides the summary.
- The group value matches the whole-plan weighted percentage shown in Plans, including 0% and decimals. Nodes at 100% with 30% weight and 84% with 70% weight show 88.8%. Filtering out a contributing row leaves the visible plan's percentage unchanged. Editing an underlying progress value or status refreshes the total in the open table.
- A plan with unavailable progress shows the same calculation reason as Plans and no numeric percentage. The No plan group, projects without weighted plan progress, and tables with other primary groupings show no plan progress summary.
