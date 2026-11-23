# Outcome

Show a percentage unit consistently in the delivery progress and weight columns. Save manual changes when the user presses Enter or leaves the input, matching the time estimate editor.

# Scope

Use the delivery workflow's numeric field bindings to identify completion progress and weight in the work item table. Display stored values and calculated progress as percentages. Keep the empty marker for unset values and the workflow message when progress cannot be calculated. The number entered and stored is in percentage points.

Editable cells on task and subtask rows save a changed, valid value on Enter, blur or the existing Save button. Clearing the input and saving clears the stored value. Escape cancels the draft and invalid input leaves the stored value intact. Leaving an unchanged field does not send a write. Respect field applicability, edit permissions and the workflow's progress locks.

## Directory structure

### Modified

- `apps/api/src/modules/delivery-workflow/` supplies the existing bindings needed by the work item table through its delivery read path.
- `apps/web/src/lib/api/endpoints/deliveryWorkflow.ts` describes the delivery read data used by table cells.
- `apps/web/src/features/work-items/components/table/` formats bound values, enables save on blur and covers table interactions.
- `apps/web/src/components/common/fields/InlineTextField.tsx` supports saving on blur for opted-in cells.

# Non-goals

Storage and calculation changes, editor changes outside the bound table fields, and changes to project permissions.

# Acceptance examples

- Applicable progress and weight cells show a percent sign for manual values, including zero and decimals, and calculated progress uses the percentage display. Empty values and unavailable calculated results keep the existing marker or workflow message.
- An edited progress or weight value saves once on Enter, blur or clicking Save. Saving an empty value clears it, Escape cancels, and invalid input or an unchanged value causes no write. The write targets the edited work item on root and nested rows.
- Read-only and calculated progress cells cannot be edited. Unrelated numeric fields and the time estimate editor retain their existing display and save behavior.
