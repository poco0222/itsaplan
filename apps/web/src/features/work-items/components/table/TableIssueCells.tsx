import type { ProjectDetail } from '@/lib/api/endpoints/projects';
import type { Issue } from '@/lib/api/endpoints/issues';
import type { DeliveryItem } from '@/lib/api/endpoints/deliveryWorkflow';
import { useSetFieldValue, useUpdateIssue } from '@/services/issues.service';
import type { Maps } from '@/utils/project';
import { columnKey, type OrderedColumn } from '../../utils/table';
import DeliveryProgressBadge from '../shared/DeliveryProgressBadge';
import { EditableBuiltinCell } from '../shared/EditableBuiltinCell';
import { EditableCustomCell } from '../shared/EditableCustomCell';
import { TableBuiltinCell } from './TableBuiltinCell';

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
    if (
      delivery?.progressReadOnly &&
      column.field.id === delivery.progressFieldId &&
      (column.field.issueTypeId == null || column.field.issueTypeId === issue.typeId)
    ) {
      return <DeliveryProgressBadge key={key} item={delivery} valueOnly />;
    }
    return (
      <EditableCustomCell
        key={key}
        field={column.field}
        issue={issue}
        project={project}
        maps={maps}
        readOnly={readOnly}
        onChange={(value) =>
          setFieldValue.mutate({ issueId: issue.id, fieldId: column.field.id, value })
        }
      />
    );
  });
}
