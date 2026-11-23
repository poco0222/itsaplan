import {
  customField,
  db,
  deliveryHandoff,
  issue,
  issueType,
  lockIssueTree,
  projectColumn,
  projectSetting,
  type DbExecutor,
} from '@repo/db';
import { and, desc, eq, inArray, isNull, sql } from 'drizzle-orm';
import { HttpError } from '#shared/lib';
import { getProjectSetting } from '#shared/project-settings';
import type { DeliveryHandoff, DeliveryItem, DeliverySettings } from './model';

const key = 'delivery_workflow';

export function readDeliverySettings(projectId: number, executor: DbExecutor = db) {
  return getProjectSetting<DeliverySettings>(projectId, key, executor);
}

export async function assertDeliveryDeletionAllowed(projectId: number, ids: number[]) {
  if (ids.length === 0 || !(await readDeliverySettings(projectId))) return;
  const locked = await db.execute(sql`
    SELECT 1 FROM delivery_rollup(${projectId}) d
    JOIN delivery_handoff h ON h.module_id = d.module_id AND h.reversed_at IS NULL
    WHERE d.role <> 'maintenance' AND d.id IN (${sql.join(
      ids.map((id) => sql`${id}`),
      sql`, `,
    )})
    LIMIT 1
  `);
  if (locked.length)
    throw new HttpError(
      409,
      'Reverse the maintenance handoff before changing delivery',
      'delivery_locked',
    );
}

export function writeDeliverySettings(projectId: number, settings: DeliverySettings) {
  return db.transaction(async (tx) => {
    await lockIssueTree(tx, projectId);
    const selectedTypes = [
      settings.moduleTypeId,
      settings.nodeTypeId,
      settings.taskTypeId,
      settings.maintenanceTypeId,
    ];
    const bindings = [
      [settings.nodeWeightId, settings.nodeTypeId],
      [settings.nodeProgressId, settings.nodeTypeId],
      [settings.taskWeightId, settings.taskTypeId],
      [settings.taskProgressId, settings.taskTypeId],
    ] as const;
    const [types, fields, columns] = await Promise.all([
      tx
        .select({ id: issueType.id })
        .from(issueType)
        .where(and(eq(issueType.projectId, projectId), inArray(issueType.id, selectedTypes))),
      tx
        .select()
        .from(customField)
        .where(
          and(
            eq(customField.projectId, projectId),
            inArray(
              customField.id,
              bindings.map(([id]) => id),
            ),
          ),
        ),
      tx
        .select({ state: projectColumn.stateType })
        .from(projectColumn)
        .where(eq(projectColumn.projectId, projectId)),
    ]);
    if (
      types.length !== 4 ||
      settings.nodeWeightId === settings.nodeProgressId ||
      settings.taskWeightId === settings.taskProgressId ||
      !bindings.every(([id, typeId]) =>
        fields.some(
          (field) =>
            field.id === id &&
            field.fieldType === 'number' &&
            (field.issueTypeId === null || field.issueTypeId === typeId),
        ),
      )
    ) {
      throw new HttpError(
        400,
        'Choose four distinct work item types and compatible numeric fields',
      );
    }
    if (
      !columns.some(({ state }) => state === 'started') ||
      !columns.some(({ state }) => state === 'completed')
    ) {
      throw new HttpError(
        400,
        'Add an In progress and a Completed status before enabling delivery',
      );
    }
    const current = await readDeliverySettings(projectId, tx);
    if (
      current &&
      Object.entries(settings).every(
        ([name, value]) => current[name as keyof DeliverySettings] === value,
      )
    )
      return settings;
    const [active] = await tx
      .select({ id: deliveryHandoff.id })
      .from(deliveryHandoff)
      .innerJoin(issue, eq(issue.id, deliveryHandoff.moduleId))
      .where(and(eq(issue.projectId, projectId), isNull(deliveryHandoff.reversedAt)))
      .limit(1);
    if (active)
      throw new HttpError(409, 'Reverse active handoffs before changing delivery bindings');
    await tx
      .insert(projectSetting)
      .values({ projectId, key, value: settings })
      .onConflictDoUpdate({
        target: [projectSetting.projectId, projectSetting.key],
        set: { value: settings, updatedAt: sql`now()` },
      });
    await tx.execute(sql`SELECT delivery_sync(${projectId}, NULL, true)`);
    return settings;
  });
}

export async function readDeliveryItems(
  projectId: number,
  issueId?: number,
  executor: DbExecutor = db,
): Promise<DeliveryItem[]> {
  const settings = await readDeliverySettings(projectId, executor);
  if (!settings) return [];
  return await executor.execute<DeliveryItem>(sql`
    SELECT d.id, d.module_id AS "moduleId", d.role, d.progress::float8, d.problem,
      CASE
        WHEN d.role IN ('module', 'node') THEN ${settings.nodeProgressId}::integer
        WHEN d.role = 'task' THEN ${settings.taskProgressId}::integer
      END AS "progressFieldId",
      CASE d.role
        WHEN 'node' THEN ${settings.nodeWeightId}::integer
        WHEN 'task' THEN ${settings.taskWeightId}::integer
      END AS "weightFieldId",
      (d.managed OR d.state = 'completed' OR h.id IS NOT NULL) AS "progressReadOnly",
      CASE WHEN d.valid THEN CASE
        WHEN d.role = 'module' AND h.id IS NOT NULL THEN ${settings.maintenanceTypeId}::integer
        WHEN d.role = 'module' THEN ${settings.nodeTypeId}::integer
        WHEN d.role = 'node' AND h.id IS NULL THEN ${settings.taskTypeId}::integer
      END END AS "childTypeId",
      d.state = 'completed' AS completed,
      CASE WHEN h.id IS NULL THEN 'delivery' ELSE 'maintenance' END AS phase,
      (d.role = 'module' AND d.valid AND d.ready AND d.state = 'completed' AND h.id IS NULL) AS "canConfirm",
      CASE WHEN c.id IS DISTINCT FROM i.delivery_unknown_completion_id THEN to_jsonb(c.entered_at)#>>'{}' END AS "completedAt"
    FROM delivery_rollup(${projectId}) d
    JOIN issue i ON i.id = d.id
    LEFT JOIN delivery_handoff h ON h.module_id = d.module_id AND h.reversed_at IS NULL
    LEFT JOIN LATERAL delivery_completion(i.id) c ON d.state = 'completed'
    ${issueId === undefined ? sql`` : sql`WHERE d.id = ${issueId}`}
  `);
}

export function readDeliveryDetail(projectId: number, issueId: number) {
  return db.transaction(
    async (tx) => {
      const [item] = await readDeliveryItems(projectId, issueId, tx);
      if (!item) return { item: null, history: [] };
      const history =
        item.role === 'module'
          ? await tx.execute<DeliveryHandoff>(sql`
      SELECT h.id, u.name AS "confirmedBy", to_jsonb(h.confirmed_at)#>>'{}' AS "confirmedAt",
        r.name AS "reversedBy", to_jsonb(h.reversed_at)#>>'{}' AS "reversedAt", h.reversal_reason AS "reversalReason"
      FROM delivery_handoff h
      LEFT JOIN "user" u ON u.id = h.confirmed_by LEFT JOIN "user" r ON r.id = h.reversed_by
      WHERE h.module_id = ${item.id}
      ORDER BY h.id DESC
    `)
          : [];
      return { item, history };
    },
    { isolationLevel: 'repeatable read', accessMode: 'read only' },
  );
}

async function handoffTarget(projectId: number, moduleId: number, tx: DbExecutor) {
  const [item] = await readDeliveryItems(projectId, moduleId, tx);
  if (item?.role !== 'module' || item.moduleId !== moduleId)
    throw new HttpError(404, 'Delivery module not found');
  return item;
}

export function confirmDeliveryHandoff(projectId: number, moduleId: number, actor: string) {
  return db.transaction(async (tx) => {
    await lockIssueTree(tx, projectId);
    const item = await handoffTarget(projectId, moduleId, tx);
    const [active] = await tx
      .select({ id: deliveryHandoff.id })
      .from(deliveryHandoff)
      .where(and(eq(deliveryHandoff.moduleId, moduleId), isNull(deliveryHandoff.reversedAt)));
    if (active) return active;
    if (!item.canConfirm)
      throw new HttpError(409, 'Complete the delivery and allocate 100 percent before handoff');
    const [created] = await tx
      .insert(deliveryHandoff)
      .values({ moduleId, confirmedBy: actor })
      .returning({ id: deliveryHandoff.id });
    return created;
  });
}

export function reverseDeliveryHandoff(
  projectId: number,
  moduleId: number,
  actor: string,
  handoffId: number,
  input: string,
) {
  const reason = input.trim();
  if (!reason) throw new HttpError(400, 'Enter a reason for reversing the handoff');
  return db.transaction(async (tx) => {
    await lockIssueTree(tx, projectId);
    await handoffTarget(projectId, moduleId, tx);
    const [latest] = await tx
      .select()
      .from(deliveryHandoff)
      .where(eq(deliveryHandoff.moduleId, moduleId))
      .orderBy(desc(deliveryHandoff.id))
      .limit(1);
    if (latest?.id !== handoffId)
      throw new HttpError(409, 'The handoff has changed. Refresh the module.');
    if (!latest.reversedAt) {
      await tx
        .update(deliveryHandoff)
        .set({ reversedAt: sql`clock_timestamp()`, reversedBy: actor, reversalReason: reason })
        .where(eq(deliveryHandoff.id, handoffId));
    }
    return { id: handoffId };
  });
}

export function markLegacyCompletions(projectId: number, ids: number[]) {
  return db.transaction(async (tx) => {
    await lockIssueTree(tx, projectId);
    const marked = await tx.execute<{ id: number }>(sql`
      WITH completed AS (
        SELECT d.id AS issue_id, s.id AS status_id
        FROM delivery_rollup(${projectId}) d CROSS JOIN LATERAL delivery_completion(d.id) s
        WHERE d.state = 'completed'
          AND d.id IN (${sql.join(
            ids.map((id) => sql`${id}`),
            sql`, `,
          )})
      )
      UPDATE issue i SET delivery_unknown_completion_id = c.status_id
        FROM completed c WHERE c.issue_id = i.id RETURNING i.id
    `);
    if (marked.length !== ids.length)
      throw new HttpError(
        400,
        'Select completed work items in this project with recorded status history',
      );
    return { count: marked.length };
  });
}
