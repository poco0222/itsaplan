import { t, type Static } from 'elysia';

const MAX_ID = 2_147_483_647;
const id = t.Integer({ minimum: 1, maximum: MAX_ID });

export const DeliverySettings = t.Object({
  moduleTypeId: id,
  nodeTypeId: id,
  taskTypeId: id,
  maintenanceTypeId: id,
  nodeWeightId: id,
  taskWeightId: id,
  nodeProgressId: id,
  taskProgressId: id,
});
export type DeliverySettings = Static<typeof DeliverySettings>;

export const DeliveryItem = t.Object({
  id,
  moduleId: t.Nullable(id),
  childTypeId: t.Nullable(id),
  role: t.Union([
    t.Literal('module'),
    t.Literal('node'),
    t.Literal('task'),
    t.Literal('maintenance'),
  ]),
  progress: t.Nullable(t.Number()),
  progressFieldId: t.Nullable(id),
  progressReadOnly: t.Boolean(),
  problem: t.Nullable(
    t.Union([
      t.Literal('hierarchy'),
      t.Literal('children'),
      t.Literal('weights'),
      t.Literal('child'),
      t.Literal('progress'),
    ]),
  ),
  phase: t.Union([t.Literal('delivery'), t.Literal('maintenance')]),
  canConfirm: t.Boolean(),
  completed: t.Boolean(),
  completedAt: t.Nullable(t.String()),
});
export type DeliveryItem = Static<typeof DeliveryItem>;

export const DeliveryHandoff = t.Object({
  id,
  confirmedBy: t.Nullable(t.String()),
  confirmedAt: t.String(),
  reversedBy: t.Nullable(t.String()),
  reversedAt: t.Nullable(t.String()),
  reversalReason: t.Nullable(t.String()),
});
export type DeliveryHandoff = Static<typeof DeliveryHandoff>;

export const DeliveryDetail = t.Object({
  item: t.Nullable(DeliveryItem),
  history: t.Array(DeliveryHandoff),
});
export const deliveryItemParams = t.Object({
  projectKey: t.String(),
  issueId: t.Numeric({ minimum: 1, maximum: MAX_ID, multipleOf: 1 }),
});
export const reverseHandoffBody = t.Object({
  handoffId: id,
  reason: t.String({ maxLength: 2000 }),
});
export const legacyCompletionsBody = t.Object({
  issueIds: t.Array(id, { minItems: 1, maxItems: 500, uniqueItems: true }),
});
