import type { ProjectDetail } from '@/lib/api/endpoints/projects';
import type { Issue, IssueFieldValueInput } from '@/lib/api/endpoints/issues';
import type { DeliveryItem } from '@/lib/api/endpoints/deliveryWorkflow';
import { useSetFieldValue, useUpdateIssue } from '@/services/issues.service';
import type { Maps } from '@/utils/project';
import InlineTextField from '@/components/common/fields/InlineTextField';
import { columnKey, type OrderedColumn } from '../../utils/table';
import { CellButton } from '../shared/CellButton';
import { CellEditor } from '../shared/CellEditor';
import DeliveryProgressBadge from '../shared/DeliveryProgressBadge';
import { EditableBuiltinCell } from '../shared/EditableBuiltinCell';
import { EditableCustomCell } from '../shared/EditableCustomCell';
import { TableBuiltinCell } from './TableBuiltinCell';
import { TableCustomCell } from './TableCustomCell';

export function TableIssueCells({
  project,
  issue,
  orderedColumns,
  maps,
  readOnly,
  delivery,
}: {
  project: ProjectDetail;
  issue: Issue;
  orderedColumns: OrderedColumn[];
  maps: Maps;
  readOnly: boolean;
  delivery?: DeliveryItem;
}) {
  const updateIssue = useUpdateIssue(project.project.ref);
  const setFieldValue = useSetFieldValue(project.project.ref);

  return orderedColumns.map((column) => {
    const key = columnKey(column);
    if (column.kind === 'builtin') {
      return (
        <EditableBuiltinCell
          key={key}
          column={column.col}
          issue={issue}
          project={project}
          readOnly={readOnly}
          onPatch={(patch) => updateIssue.mutate({ id: issue.id, patch })}
        >
          <TableBuiltinCell column={column.col} issue={issue} maps={maps} />
        </EditableBuiltinCell>
      );
    }
    const { field } = column;
    const applies = field.issueTypeId == null || field.issueTypeId === issue.typeId;
    if (delivery?.progressReadOnly && field.id === delivery.progressFieldId && applies) {
      return <DeliveryProgressBadge key={key} item={delivery} valueOnly />;
    }
    const onChange = (value: IssueFieldValueInput) =>
      setFieldValue.mutate({ issueId: issue.id, fieldId: field.id, value });
    if (applies && field.fieldType === 'number') {
      const weight = field.id === delivery?.weightFieldId;
      const percentage = weight || field.id === delivery?.progressFieldId;
      const cell = (
        <TableCustomCell
          key={key}
          field={field}
          issue={issue}
          maps={maps}
          percentage={percentage}
        />
      );
      if (readOnly || (weight && delivery?.phase === 'maintenance')) return cell;
      const value = issue.fieldValues.find((entry) => entry.fieldId === field.id)?.value;
      return (
        <CellEditor key={key}>
          <InlineTextField
            fieldType="number"
            compact
            percentage={percentage}
            value={typeof value === 'number' ? value : null}
            saveKey={`${field.id}-${issue.updatedAt}`}
            label={field.name}
            renderTrigger={(onClick) => (
              <CellButton onClick={onClick} title={field.name}>
                {cell}
              </CellButton>
            )}
            onSave={(value) => onChange({ value })}
          />
        </CellEditor>
      );
    }
    return (
      <EditableCustomCell
        key={key}
        field={field}
        issue={issue}
        project={project}
        maps={maps}
        readOnly={readOnly}
        onChange={onChange}
      />
    );
  });
}
