import { SQL } from 'bun';
import { parseArgs } from 'node:util';

const mode = 'delivery_plan_hierarchy';
const status = {
  backlog: 'proposed',
  unstarted: 'planned',
  started: 'active',
  completed: 'completed',
  canceled: 'canceled',
} as const;

interface WorkItem {
  id: number;
  sequenceNumber: number;
  role: 'module' | 'node' | 'task' | 'maintenance' | null;
  parentId: number | null;
  initiativeId: number | null;
  archived: boolean;
  state: keyof typeof status;
  title: string;
}

export function migrateDeliveryPlans(db: SQL, ref: string, apply: boolean) {
  const separator = ref.lastIndexOf('.');
  if (separator < 1 || separator === ref.length - 1)
    throw new Error('Use a project ref such as team.KEY.');
  const team = ref.slice(0, separator);
  const key = ref.slice(separator + 1);

  return db.begin(async (tx) => {
    if (!apply) await tx`SET TRANSACTION ISOLATION LEVEL REPEATABLE READ, READ ONLY`;
    const target = tx`
      SELECT p.id, p.initiatives_enabled AS "plansEnabled" FROM project p
      JOIN team t ON t.id = p.team_id
      WHERE p.key = ${key} AND coalesce(t.slug, t.id::text) = ${team} AND p.archived_at IS NULL
    `;
    const [project] = await target;
    if (!project?.plansEnabled) throw new Error('The project must exist and have Plans enabled.');
    const projectId = project.id as number;
    if (apply) {
      const [schema] = await tx`
        SELECT to_regprocedure('public.delivery_plan_children_changed()') IS NOT NULL AS ready
      `;
      if (!schema.ready)
        throw new Error('Apply the plan delivery hierarchy schema migration first.');
      await tx`SELECT pg_advisory_xact_lock(1145390933, ${projectId})`;
      const [locked] = await tx`${target} FOR UPDATE OF p`;
      if (locked?.id !== projectId || !locked?.plansEnabled)
        throw new Error('The project changed. Preview it again.');
    }

    const [converted] = await tx`
      SELECT value FROM project_setting WHERE project_id = ${projectId} AND key = ${mode}
    `;
    if (converted) return { project: ref, status: 'already-applied', sources: converted.value };
    const [workflow] = await tx`SELECT delivery_settings(${projectId}) AS settings`;
    const settings = workflow.settings as {
      moduleTypeId: number;
      nodeTypeId: number;
      taskTypeId: number;
    } | null;
    if (!settings) throw new Error('The project must have a configured delivery workflow.');

    const items = await tx<WorkItem[]>`
      SELECT i.id, i.sequence_number AS "sequenceNumber", i.title, i.parent_id AS "parentId",
        i.initiative_id AS "initiativeId", i.archived_at IS NOT NULL AS archived,
        delivery_role(delivery_settings(${projectId}), i.type_id) AS role, c.state_type AS state
      FROM issue i JOIN project_column c ON c.id = i.column_id
      WHERE i.project_id = ${projectId} ORDER BY i.sequence_number
      ${apply ? tx`FOR UPDATE OF i` : tx``}
    `;
    const active = items.filter((item) => !item.archived);
    const modules = active.filter((item) => item.role === 'module' && item.parentId === null);
    const moduleIds = new Set(modules.map((item) => item.id));
    const nodes = items.filter(
      (i) => i.role === 'node' && i.parentId !== null && moduleIds.has(i.parentId),
    );
    const nodeIds = new Set(nodes.map((item) => item.id));
    const tasks = items.filter(
      (i) => i.role === 'task' && i.parentId !== null && nodeIds.has(i.parentId),
    );
    const taskIds = new Set(tasks.map((item) => item.id));
    const migrating = new Set([...moduleIds, ...nodeIds, ...taskIds]);
    const identifier = (item: WorkItem) => `${key}-${item.sequenceNumber}`;
    const conflicts = active
      .filter(
        (i) =>
          (i.role !== null || (i.parentId !== null && migrating.has(i.parentId))) &&
          !migrating.has(i.id),
      )
      .map((i) => `${identifier(i)} is outside the module, node, and execution hierarchy.`);
    conflicts.push(
      ...items
        .filter((i) => migrating.has(i.id) && i.initiativeId !== null)
        .map((i) => `${identifier(i)} already belongs to a plan.`),
    );
    const [handoff] = await tx`
      SELECT h.id FROM delivery_handoff h JOIN issue i ON i.id = h.module_id
      WHERE i.project_id = ${projectId} LIMIT 1
    `;
    if (handoff) conflicts.push('The project has maintenance handoff history.');
    if (!modules.length) conflicts.push('The project has no active delivery modules.');
    const plans = await tx<
      { title: string }[]
    >`SELECT title FROM initiative WHERE project_id = ${projectId}`;
    const titles = new Set(plans.map((plan) => plan.title));
    for (const module of modules) {
      if (titles.has(module.title))
        conflicts.push(`${identifier(module)} has the same title as an existing plan.`);
    }
    const preview = {
      project: ref,
      modules: modules.map((item) => ({
        source: identifier(item),
        title: item.title,
        status: status[item.state],
      })),
      nodes: nodes.length,
      tasks: tasks.length,
      conflicts,
    };
    if (!apply) return { ...preview, status: 'preview' };
    if (conflicts.length) throw new Error(conflicts.join('\n'));

    const sources: Record<number, number> = {};
    const planForModule = new Map<number, number>();
    for (const module of modules) {
      const [created] = await tx<{ id: number }[]>`
        INSERT INTO initiative (project_id, title, description, status, target_date, position)
        SELECT i.project_id, i.title, i.description, ${status[module.state]}, i.due_date,
          (SELECT coalesce(max(position), 0) + 1000 FROM initiative WHERE project_id = ${projectId})
        FROM issue i WHERE i.id = ${module.id} AND i.project_id = ${projectId}
        RETURNING id
      `;
      planForModule.set(module.id, created.id);
      sources[created.id] = module.sequenceNumber;
    }
    await tx`
      INSERT INTO project_setting (project_id, key, value)
      VALUES (${projectId}, ${mode}, ${JSON.stringify(sources)}::text::jsonb)
    `;

    // Enrollment preserves historical status transitions and does not recalculate work item states.
    await tx`SELECT set_config('itsaplan.delivery_sync', 'yes', true)`;
    for (const [moduleId, planId] of planForModule) {
      await tx`
        UPDATE issue SET parent_id = NULL, initiative_id = ${planId}
        WHERE project_id = ${projectId} AND parent_id = ${moduleId} AND type_id = ${settings.nodeTypeId}
      `;
      await tx`UPDATE issue SET archived_at = now() WHERE id = ${moduleId} AND project_id = ${projectId}`;
    }
    await tx`
      UPDATE issue_type SET name = CASE id WHEN ${settings.nodeTypeId} THEN '节点' ELSE '执行' END
      WHERE project_id = ${projectId} AND id IN (${settings.nodeTypeId}, ${settings.taskTypeId})
    `;
    await tx`UPDATE issue_type SET is_default = false WHERE project_id = ${projectId} AND id = ${settings.moduleTypeId}`;
    return { ...preview, status: 'applied', sources };
  });
}

if (import.meta.main) {
  const { values } = parseArgs({
    options: { project: { type: 'string' }, apply: { type: 'boolean' } },
  });
  const url = process.env.DATABASE_URL;
  if (!values.project || !url)
    throw new Error('Set DATABASE_URL and supply --project team.KEY. Use --apply to write.');
  const db = new SQL(url);
  try {
    console.log(
      JSON.stringify(
        await migrateDeliveryPlans(db, values.project, values.apply ?? false),
        null,
        2,
      ),
    );
  } finally {
    await db.close();
  }
}
