# Outcome

Make the Kanban deadline badges match the requested labels and the app's existing colors for overdue dates, active initiatives, and blue badges.

# Scope

Apply the styles to the shared work-item card in the board and swimlane views. Shorten the late-completion copy in the languages that include an equivalent of “Actual”. Remove the space between the numeral and the day unit in both Chinese locales.

## Source coverage

The proposal covers the initial request, the attached annotations, and the follow-up. Screenshots identify the interface elements. The app's source defines their colors.

| Source and location | Read status | Requirement or context | Spec section | Acceptance | Coverage |
| --- | --- | --- | --- | --- | --- |
| Written request | complete | Late completion uses the native overdue red. | Late completion | A1 | covered |
| Image #1, callout in the completed column | complete | Show “延期完成 · 10月15日” without “实际”. | Late completion | A2 | covered |
| Initial request, Image #1, callout in the in-progress column | complete | Show “3日内到期” without a space. The follow-up replaces the amber color. | Upcoming due dates | A3 | covered |
| Image #1, callout in the in-progress column | complete | Show a blue “5日内到期” badge. | Upcoming due dates | A4 | covered |
| Image #2, circled date on ROLL-25 | complete | Use the existing overdue pill's red text and tinted background as the reference. | Late completion | A1 | covered |
| Written follow-up, with the highlighted “进行中” status as a locator | complete | Read the three-day badge fill from the active initiative status color in the app source. Use dark text for contrast. | Upcoming due dates | A3 | covered |
| Written follow-up on all colors | complete | Use existing app colors for all three badges. The five-day badge uses the light and dark blue styles from the model price source badge. | Upcoming due dates and Late completion | A1, A3, A4 | covered |
| Both images, surrounding cards and board controls | complete | Issue dates, titles, subtask rows, and columns show the usage context. | | | background |

## Directory structure

### Modified

- `apps/web/src/features/work-items/components/kanban/IssueCardDeadline.tsx` applies badge colors.
- `apps/web/src/features/issue/components/shared/IssueBadges.tsx` shares the overdue pill styles.
- `apps/web/src/features/work-items/components/kanban/IssueCardDeadline.test.tsx` checks badge styles, copy, and date boundaries.
- `apps/web/messages/{en,ko,zh-CN,zh-TW}/workItems.json` updates affected labels.

# Non-goals

Task data, due-date calculations, completion date selection, view settings, and card layout are outside this change.

# Acceptance examples

- A late-completion badge shares the native overdue date pill's foreground and fill styles in light and dark themes. The planned date on a completed card retains its neutral style. An open overdue card retains its native red date pill.
- A completed card with an October 8 deadline and October 15 actual completion displays “延期完成 · 10月15日” in Simplified Chinese. The label retains the actual date and drops its prefix in the affected languages.
- A started card due in zero through three calendar days shows one badge with its fill taken directly from the app's active initiative status color and the app's existing dark foreground for yellow surfaces in both themes. In Simplified Chinese it reads “3日内到期”.
- A started card due in four or five calendar days shows one badge using the model price source badge's blue foreground and tinted fill in each theme. In Simplified Chinese it reads “5日内到期”. Dates more than five days away show no upcoming badge.
