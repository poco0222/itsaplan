import { useMemo } from 'react';
import { type WorkItemsViewProps } from '@/utils/project';
import { customFieldKey } from '@/utils/viewSettings';
import { KanbanDeadlineProvider } from '../../context/kanbanDeadlineContext';
import { SelectionProvider } from '../../context/useSelection';
import { WorkItemsEmpty } from '../shared/WorkItemsEmpty';
import FlatBoard from './FlatBoard';
import SwimlaneBoard from './SwimlaneBoard';
import { BulkActionBar } from './BulkActionBar';

// The project has two layouts: a flat set of columns, or — when a sub-group
// (swimlane) field is set — the same columns split into horizontal swimlanes.
// Both share one multi-select: the provider holds the selection and the bulk-action
// bar acts on it. `validIds` are the issues currently on the board, so a selected
// issue that leaves (deleted, archived, filtered out) drops from the selection.
export default function KanbanBoard(props: WorkItemsViewProps) {
  const validIds = useMemo(
    () => new Set(props.project.issues.map((i) => i.id)),
    [props.project.issues],
  );
  const actualDateFieldId = props.customFields.find(
    (field) =>
      field.fieldType === 'date' &&
      customFieldKey(field.id) === props.settings.actualCompletionDateField,
  )?.id;

  if (props.project.issues.length === 0 && !props.settings.showEmptyGroups) {
    return <WorkItemsEmpty filters={props.filters} />;
  }

  return (
    <SelectionProvider validIds={validIds}>
      <KanbanDeadlineProvider actualDateFieldId={actualDateFieldId}>
        {props.settings.subgroup === 'none' ? (
          <FlatBoard {...props} />
        ) : (
          <SwimlaneBoard {...props} />
        )}
      </KanbanDeadlineProvider>
      {!props.readOnly && <BulkActionBar project={props.project} />}
    </SelectionProvider>
  );
}
