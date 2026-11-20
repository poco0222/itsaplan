import { useCallback } from 'react';
import { useDraggable, useDroppable } from '@dnd-kit/core';
import type { ProjectDetail } from '@/lib/api/endpoints/projects';
import type { BoardIssue } from '@/lib/api/endpoints/issues';
import type { DeliveryItem } from '@/lib/api/endpoints/deliveryWorkflow';
import { type Maps } from '@/utils/project';
import { useIsPhone } from '@/hooks/useIsPhone';
import { usePermissions } from '@/hooks/usePermissions';
import { cn } from '@/lib/utils';
import IssueContextMenu from '@/features/issue/components/actions/IssueContextMenu';
import { DropLine } from '../shared/DropLine';
import { IssueIdentifier } from '../shared/IssueIdentifier';
import { SubtaskProgress } from '../shared/SubtaskProgress';
import DeliveryProgressBadge from '../shared/DeliveryProgressBadge';
import { useIsBlocked } from '../../context/useIssueLinks';
import { useSubtaskFold } from '../../context/useSubtasks';
import { DRAGGABLE_FOCUS } from '../../utils/dnd';
import type { OrderedColumn } from '../../utils/table';
import { TableIssueCells } from './TableIssueCells';
import { TableRowLinks } from './TableRowLinks';
import { TableRowSubtasks } from './TableRowSubtasks';

// A draggable, droppable table row. Dragging it starts a move; dropping another
// row on it inserts before this one (onDrop). A click (no drag) opens it, except
// on a cell that edits the issue in place.
export function TableRow({
  project,
  issue,
  orderedColumns,
  maps,
  showId,
  indented,
  alignTop,
  gridTemplate,
  dropDisabled,
  readOnly,
  onDrop,
  onClick,
  onOpenIssue,
  deliveryById,
}: {
  project: ProjectDetail;
  issue: BoardIssue;
  orderedColumns: OrderedColumn[];
  maps: Maps;
  showId: boolean;
  // Rows under a sub-section are indented to sit below their sub-header.
  indented: boolean;
  // Top-align cells (a tall markdown cell is present) instead of centering.
  alignTop: boolean;
  gridTemplate: string;
  // Dropping between rows only holds under manual ordering. With any other sort
  // the row stops being a drop target so the pointer falls through to the section
  // header, which refuses the move and explains why.
  dropDisabled: boolean;
  // In a read-only share, or without work_items edit, the cells only show values.
  readOnly: boolean;
  onDrop: (draggedId: number) => void;
  onClick: () => void;
  // Opens a linked issue from a sub-row.
  onOpenIssue: (id: number) => void;
  deliveryById?: Map<number, DeliveryItem>;
}) {
  // Drag is disabled on phones, and without work_items edit (reordering is an
  // issue edit).
  const { can } = usePermissions();
  const delivery = deliveryById?.get(issue.id);
  const subtasks = useSubtaskFold();
  const blocked = useIsBlocked(issue);
  const {
    setNodeRef: dragRef,
    attributes,
    listeners,
    isDragging,
  } = useDraggable({ id: issue.id, disabled: useIsPhone() || !can('work_items', 'edit') });
  const {
    setNodeRef: dropRef,
    isOver,
    active,
  } = useDroppable({
    id: `row:${issue.id}`,
    disabled: dropDisabled,
    data: { onDrop: (draggedId: number) => draggedId !== issue.id && onDrop(draggedId) },
  });
  // The insertion marker sits at this row's top edge: a drop inserts before it.
  // Dropping a row on itself is a no-op, so it gets no marker.
  const showDropLine = isOver && Number(active?.id) !== issue.id;
  const mergedRef = useCallback(
    (el: HTMLElement | null) => {
      dragRef(el);
      dropRef(el);
    },
    [dragRef, dropRef],
  );
  return (
    <IssueContextMenu project={project} issue={issue}>
      <div
        ref={mergedRef}
        {...attributes}
        {...listeners}
        onClick={(e) => {
          e.preventDefault();
          onClick();
        }}
        className={cn(
          'relative grid cursor-grab gap-3 border-b py-2 pe-4 text-sm transition-colors',
          DRAGGABLE_FOCUS,
          blocked ? 'row-blocked' : 'hover:bg-accent/40',
          alignTop ? 'items-start' : 'items-center',
          indented ? 'ps-9' : 'ps-4',
          isDragging && 'opacity-40',
        )}
        style={{ gridTemplateColumns: gridTemplate }}
      >
        {showDropLine && <DropLine className="top-0" />}
        <div className="flex min-w-0 items-center gap-2">
          {showId && (
            <IssueIdentifier
              issue={issue}
              className="text-xs text-muted-foreground tabular-nums"
              onOpenAncestor={onOpenIssue}
            />
          )}
          <span dir="auto" className="truncate text-foreground">
            {issue.title}
          </span>
          <SubtaskProgress
            issueId={issue.id}
            maps={maps}
            open={subtasks.open}
            onToggle={subtasks.toggle}
          />
          {delivery && <DeliveryProgressBadge item={delivery} />}
        </div>

        <TableIssueCells
          project={project}
          issue={issue}
          orderedColumns={orderedColumns}
          maps={maps}
          readOnly={readOnly}
          delivery={delivery}
        />

        {subtasks.open && (
          <TableRowSubtasks
            deliveryById={deliveryById}
            project={project}
            issueId={issue.id}
            maps={maps}
            orderedColumns={orderedColumns}
            readOnly={readOnly}
            showId={showId}
            alignTop={alignTop}
            onOpenIssue={onOpenIssue}
          />
        )}
        <TableRowLinks links={issue.links} maps={maps} onOpenIssue={onOpenIssue} />
      </div>
    </IssueContextMenu>
  );
}
