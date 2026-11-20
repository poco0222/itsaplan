# Outcome

Show automatic deadline and late-completion indicators on It’s a Plan board cards while the task keeps its regular workflow state.

# Scope

Add the indicators to the shared card used by the standard Kanban and swimlane layouts. Use the existing due date and status category. Let a board view select an existing date custom field for actual completion. The Rolling Plan example uses its existing “实际完成时间” field.

- For a started task, show “3 日内到期” when the due date is today through three calendar days away and “5 日内到期” when it is four or five days away. Display at most one warning. Follow the browser-local calendar used by the existing overdue indicator, and update when the day rolls over while the board is open.
- For a completed task, show “延期完成” with the actual completion date when that date is later than the due date. Use the chosen field and show the indicator alongside the original due date.
- Preserve the red overdue date for open tasks. On-time, early, canceled and undated tasks do not get incorrect deadline or late-completion indicators.
- Keep the selection in the view’s existing display settings. Older views and invalid or missing field selections remain usable.

## Source coverage

The requirement boundary is the two red annotations on the attached board screenshot, the visible card context needed to interpret them, and the follow-up accepting a code change. The screenshot was read in full. Its task titles and values are examples of existing records.

| Source and location | Read status | Requirement or context | Spec location | Acceptance ID | Coverage | Reason |
| --- | --- | --- | --- | --- | --- | --- |
| Image #1, annotation under the left column | complete | “增加三日内到期和五日内到期标签” | [Upcoming due dates](specs/kanban-deadline-badges/spec.md#upcoming-due-dates) | A1, A2 | covered | The labels follow the live calendar and are mutually exclusive. |
| Image #1, annotation under the right column | complete | “增加延期完成并带实际完成日期” | [Late completion](specs/kanban-deadline-badges/spec.md#late-completion) | A3, A4 | covered | Compare the existing actual completion date with the due date and show the actual date on the completed card. |
| Image #1, board columns, existing dates and task cards | complete | The labels appear on cards in “进行中” and “已完成”. ROLL-25 shows the existing red overdue date. Card titles and subtask rows are context. | [Upcoming due dates](specs/kanban-deadline-badges/spec.md#upcoming-due-dates), [View settings and records](specs/kanban-deadline-badges/spec.md#view-settings-and-records) | A2, A5, A6 | covered | Extend card metadata and preserve the existing states, date presentation and subtask display. |
| Follow-up, current user request | complete | “接受改代码方案, 我需要这个动态标签” | [Upcoming due dates](specs/kanban-deadline-badges/spec.md#upcoming-due-dates), [Late completion](specs/kanban-deadline-badges/spec.md#late-completion) | A1–A6 | covered | The indicators are calculated at display time. |

## Directory structure

### Modified

- `apps/web/src/features/work-items/components/kanban/` for card presentation in both board layouts.
- `apps/web/src/components/layout/` and `apps/web/src/utils/viewSettings.ts` for selecting and restoring the actual-completion date field.
- `apps/web/src/utils/dates.ts` or the existing shared clock for calendar-day reuse as needed.
- `apps/web/messages/` for localized text in existing namespaces.
- `apps/api/src/modules/projects/references.ts` for preserving or clearing the date field selection when existing view-copy paths remap custom fields.

### Created

- Focused date and card display tests in the work-items feature where needed to cover the new behavior.

# Non-goals

- Persistent project labels, reminders or scheduled jobs.
- Workflow changes, task data edits, schema migrations, and changes to the table, cycle, document or dashboard presentation.
- Deployment to the running instance, Git commits, pushes, and pull requests.

# Acceptance examples

- A started card with a visible due date shows the 3-day indicator at zero through three days remaining, and the 5-day indicator at four and five days remaining. The date is visible and the two indicators never appear together.
- A past due date on an open card retains its overdue styling. A missing or invalid due date, a date more than five days away, and cards outside the started state show no upcoming indicator. An open board updates as the browser-local calendar day changes.
- A completed card with an actual completion date later than its deadline shows the late-completion indicator and the actual date next to its deadline. A deadline on October 8 and completion on October 15 should show October 15 in the indicator.
- On-time completion, early completion, cancellation and missing or invalid dates do not show a late-completion indicator. The system completion time is never substituted for the chosen actual date field.
- The actual date field can be selected from existing date custom fields, saved, reloaded and cleared. Missing or invalid selections do not break older views. When existing copy flows remap a saved view, the date field selection follows the mapped field or is cleared.
- Verify the indicators in regular and swimlane Kanban cards using test records. Card, status, label and date data remain unchanged, and existing layout behavior continues to work.
