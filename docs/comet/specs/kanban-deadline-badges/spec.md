# Kanban deadline badges

## Upcoming due dates

A card with a visible due date in a started state shows at most one upcoming deadline badge. It shows “Due within 3 days” for zero through three calendar days remaining and “Due within 5 days” for four or five calendar days remaining. Zero means today. The three-day badge takes its fill from the app's active initiative status color and uses the app's existing dark foreground for yellow surfaces. The five-day badge uses the model price source badge's blue foreground and tinted fill. Both treatments apply in light and dark themes. Both Chinese locales omit the space between the numeral and the day unit, as in “3日内到期” and “5日内到期” in Simplified Chinese.

Calculate days using the same browser-local calendar day as the existing overdue indicator. Keep the board current across a day boundary while the page is open. A valid date before today keeps the current red overdue style on any open task, with no upcoming badge. Upcoming badges are absent for missing or invalid deadlines, dates further away than five days, and states other than started.

## Late completion

A completed card with its due date enabled shows a late-completion badge with its actual completion date when both dates are valid and the actual date is later than the due date. The original due date uses the neutral date style. The late-completion badge shares the overdue pill's foreground and background styles in each theme. The label shows the late-completion text and its date. An October 8 deadline and an October 15 actual completion show “延期完成 · 10月15日” in Simplified Chinese.

Use the selected existing date custom field as the actual completion source. A date equal to or before the deadline, a missing or invalid date, an unset date field, and a canceled or open task yield no late-completion badge. Use the actual date field value for imported records as well as new ones, with no fallback to the timestamp when the application recorded the state change.

## View settings and records

The board display settings offer existing date custom fields as the actual completion date source. The selection can be saved with the view, restored when the view is reopened, and cleared. A missing field, an invalid field type, or a legacy view with no selection leaves the late badge hidden. When a saved view is copied by an existing project or template copy path, the selection follows the matching copied date field and is cleared if no mapping is available.

Use the shared card in the ordinary Kanban and swimlane views, including their existing due-date visibility setting. Preserve the workflow states and existing subtask display. The badges are computed display metadata. They never add project labels, update tasks or change dates.
