---
generated_from_state_version: 6
---

# Verification

## Current result

- Result: **Verification passed; your confirmation is required**
- Verification status: **Acceptance reviewed in the implementation session**
- Goal cycle: 1
- Iteration: 1
- Verifier attempt: 1
- Completed: 2026-11-20T03:48:02.055Z
- Summary: All six requirements passed in automated checks and the isolated Chrome acceptance. The running instance was not deployed to.

## Acceptance

| ID | Result | Source | Criterion | Reason |
| --- | --- | --- | --- | --- |
| A1 | passed | brief.md | A started card with a visible due date shows the 3-day indicator at zero through three days remaining, and the 5-day indicator at four and five days remaining. The date is visible and the two indicators never appear together. | Deadline component tests cover days 0–6. In both isolated Chrome layouts, DQA-1 (today) and DQA-2 (day 3) showed only the 3-day badge; DQA-3 (day 4) and DQA-4 (day 5) showed only the 5-day badge beside the existing date. |
| A2 | passed | brief.md | A past due date on an open card retains its overdue styling. A missing or invalid due date, a date more than five days away, and cards outside the started state show no upcoming indicator. An open board updates as the browser-local calendar day changes. | Chrome showed the original Nov 19 date in red with no upcoming badge and no upcoming badge on day 6 or unstarted DQA-10. Component tests cover invalid dates and state boundaries; a simulated midnight tick advances the browser-local day and the tested rendering transitions. IssueCardBody gates all badges on presence of a visible due date. |
| A3 | passed | brief.md | A completed card with an actual completion date later than its deadline shows the late-completion indicator and the actual date next to its deadline. A deadline on October 8 and completion on October 15 should show October 15 in the indicator. | DQA-7 showed its original Oct 8 date and the badge with actual Oct 15 in both Chrome layouts using the configured date field. The focused test asserts the pair directly. |
| A4 | passed | brief.md | On-time completion, early completion, cancellation and missing or invalid dates do not show a late-completion indicator. The system completion time is never substituted for the chosen actual date field. | Chrome showed no late badge on DQA-9 with a missing date. Component cases suppressed same-day, early, invalid, missing, canceled and unconfigured values. Only the selected custom-field value is used; system state-entry time is excluded. |
| A5 | passed | brief.md | The actual date field can be selected from existing date custom fields, saved, reloaded and cleared. Missing or invalid selections do not break older views. When existing copy flows remap a saved view, the date field selection follows the mapped field or is cleared. | Chrome selected the existing date field, saved and reloaded with the badge, then cleared, saved and reloaded without it. Normalization tests cover legacy and malformed values. The isolated API copy and template tests check valid remapping and drop missing or non-date fields. |
| A6 | passed | brief.md | Verify the indicators in regular and swimlane Kanban cards using test records. Card, status, label and date data remain unchanged, and existing layout behavior continues to work. | The Chrome extension tab verified the indicator, original date and retained subtask on both test layouts. The display mutation was confined to the test view. Read-back of the disposable task rows matched the seed, and the running instance remained on its original image. |

## Checks

| Agent-reported check | Result | Execution and evidence |
| --- | --- | --- |
| Web regression suite | passed | apps/web: bun run test — 753 passed, 0 failed. The final fixture-only adjustment was rechecked in the focused suite. |
| Deadline, rollover, and view settings regression | passed | apps/web: bun test --preload ./test/setup.ts src/features/work-items/components/kanban/IssueCardDeadline.test.tsx src/context/relativeTimeContext.test.tsx src/utils/viewSettings.test.ts — 11 passed, 0 failed. Separate focused subtask regression — 3 passed. |
| Saved-view and template integration | passed | apps/api: bun --no-env-file test src/modules/project-templates/__tests__/integration/project-templates.test.ts src/modules/views/__tests__/integration/views.test.ts, against the disposable deadline_test Postgres database — 93 passed, 0 failed. |
| Types and changed-file quality | passed | Repository root: bun run --cwd apps/web typecheck; bun run --cwd apps/api typecheck; targeted ESLint in apps/web and apps/api, Prettier, git diff --check — exit 0. |
| Isolated Chrome Kanban acceptance | passed | Dedicated Chrome extension tab 267696375, disposable http://deadline-test.localhost:3411, saved views 1 and 2. Checked both layouts on seeded tasks, original due dates, red overdue styling, missing and on-time completion, retained subtask row, and actual-completion field save, reload, clear and reload. The test instance's issue dates and parent record matched the seed after verification. |
| Direct project copy | passed | Disposable API fixture: POST /projects/deadline-qa.DQA/copy then GET the copied project's fields and saved views. Actual date reference changed from source cf:1 to the copied date field cf:3. |

### Builder-reported evidence

These are Builder reports, not Runtime check receipts or independent verification results.

- Web regression suite: passed — apps/web: bun run test — 753 passed, 0 failed. The final fixture-only adjustment was rechecked in the focused suite.
- Deadline, rollover, and view settings regression: passed — apps/web: bun test --preload ./test/setup.ts src/features/work-items/components/kanban/IssueCardDeadline.test.tsx src/context/relativeTimeContext.test.tsx src/utils/viewSettings.test.ts — 11 passed, 0 failed. Separate focused subtask regression — 3 passed.
- Saved-view and template integration: passed — apps/api: bun --no-env-file test src/modules/project-templates/__tests__/integration/project-templates.test.ts src/modules/views/__tests__/integration/views.test.ts, against the disposable deadline_test Postgres database — 93 passed, 0 failed.
- Types and changed-file quality: passed — Repository root: bun run --cwd apps/web typecheck; bun run --cwd apps/api typecheck; targeted ESLint in apps/web and apps/api, Prettier, git diff --check — exit 0.

## Blockers

- **user**: Verification passed; user acceptance is required before Archive. — next: `await-user`

## Risks and skipped work

_None reported._

## Previous iterations

| Goal cycle | Iteration | Attempt | Outcome | Unresolved | Summary | Completed |
| ---: | ---: | ---: | --- | --- | --- | --- |
| 1 | 1 | 1 | pass | — | All six requirements passed in automated checks and the isolated Chrome acceptance. The running instance was not deployed to. | 2026-11-20T03:48:02.055Z |



## Conclusion

All six requirements passed in automated checks and the isolated Chrome acceptance. The running instance was not deployed to.
