CREATE OR REPLACE FUNCTION delivery_rollup(pid integer) RETURNS TABLE (
  id integer, module_id integer, role text, state text, valid boolean, progress numeric,
  problem text, managed boolean, ready boolean
) LANGUAGE sql STABLE AS $$
  WITH settings AS (
    SELECT value, value->>'planHierarchy' IS NOT DISTINCT FROM 'true' AS by_plan
    FROM (SELECT delivery_settings(pid) AS value) s
  ),
  items AS MATERIALIZED (
    SELECT i.id, i.parent_id, c.state_type AS state, r.role, s.by_plan,
      w.value_number AS weight,
      CASE
        WHEN c.state_type = 'completed' THEN 100::numeric
        WHEN v.value_number BETWEEN 0 AND 100 THEN v.value_number
        WHEN v.value_number IS NULL AND (r.role = 'task' OR (s.by_plan AND r.role = 'node'))
          THEN 0::numeric
      END AS entered
    FROM issue i
    JOIN project_column c ON c.id = i.column_id
    CROSS JOIN settings s
    CROSS JOIN LATERAL (SELECT delivery_role(s.value, i.type_id) AS role) r
    LEFT JOIN issue_field_value w ON w.issue_id = i.id AND w.field_id = (
      CASE r.role WHEN 'node' THEN s.value->>'nodeWeightId' WHEN 'task' THEN s.value->>'taskWeightId' END
    )::integer
    LEFT JOIN issue_field_value v ON v.issue_id = i.id AND v.field_id = (
      CASE r.role WHEN 'node' THEN s.value->>'nodeProgressId' WHEN 'task' THEN s.value->>'taskProgressId' END
    )::integer
    WHERE i.project_id = pid AND r.role IS NOT NULL
      AND (NOT s.by_plan OR r.role IN ('node', 'task'))
  ),
  scopes AS MATERIALIZED (
    SELECT i.*,
      CASE
        WHEN i.by_plan THEN CASE
          WHEN i.role = 'node' AND i.parent_id IS NULL THEN i.id
          WHEN i.role = 'task' AND p.role = 'node' AND p.parent_id IS NULL THEN p.id
        END
        ELSE CASE i.role
        WHEN 'module' THEN CASE WHEN i.parent_id IS NULL THEN i.id END
        WHEN 'node' THEN CASE WHEN p.role = 'module' AND p.parent_id IS NULL THEN p.id END
        WHEN 'maintenance' THEN CASE WHEN p.role = 'module' AND p.parent_id IS NULL THEN p.id END
        WHEN 'task' THEN CASE WHEN p.role = 'node' AND m.role = 'module' AND m.parent_id IS NULL THEN m.id END
        END
      END AS root_id
    FROM items i
    LEFT JOIN items p ON p.id = i.parent_id
    LEFT JOIN items m ON m.id = p.parent_id
  ),
  task_groups AS (
    SELECT parent_id, sum(weight * entered) / 100 AS rate,
      bool_and(coalesce(weight BETWEEN 0 AND 100, false)) AND sum(weight) = 100 AS allocated,
      bool_and(entered IS NOT NULL) AS rates_known,
      bool_and(state = 'completed') AS all_done
    FROM scopes WHERE role = 'task' AND root_id IS NOT NULL AND state <> 'canceled'
    GROUP BY parent_id
  ),
  nodes AS (
    SELECT n.*,
      CASE WHEN g.parent_id IS NULL THEN n.entered WHEN g.allocated AND g.rates_known THEN g.rate END AS rate,
      CASE
        WHEN g.parent_id IS NULL THEN CASE WHEN n.entered IS NULL THEN 'progress' END
        WHEN NOT g.allocated THEN 'weights'
        WHEN NOT g.rates_known THEN 'child'
      END AS problem,
      g.parent_id IS NOT NULL AS managed,
      coalesce(g.allocated AND g.all_done, false) AS ready
    FROM scopes n LEFT JOIN task_groups g ON g.parent_id = n.id
    WHERE n.role = 'node'
  ),
  node_groups AS (
    SELECT parent_id, sum(weight * rate) / 100 AS rate,
      bool_and(coalesce(weight BETWEEN 0 AND 100, false)) AND sum(weight) = 100 AS allocated,
      bool_and(rate IS NOT NULL) AS rates_known,
      bool_and(state = 'completed' AND (NOT managed OR ready)) AS all_done
    FROM nodes WHERE root_id IS NOT NULL AND state <> 'canceled'
    GROUP BY parent_id
  )
  SELECT s.id, s.root_id, s.role, s.state, s.root_id IS NOT NULL,
    CASE WHEN s.root_id IS NOT NULL AND s.state <> 'canceled' THEN
      CASE s.role WHEN 'module' THEN CASE WHEN g.allocated AND g.rates_known THEN g.rate END
                  WHEN 'node' THEN n.rate WHEN 'task' THEN s.entered END
    END,
    CASE WHEN s.root_id IS NULL THEN 'hierarchy'
      WHEN s.state <> 'canceled' THEN CASE s.role
        WHEN 'module' THEN CASE WHEN g.parent_id IS NULL THEN 'children'
          WHEN NOT g.allocated THEN 'weights' WHEN NOT g.rates_known THEN 'child' END
        WHEN 'node' THEN n.problem
        WHEN 'task' THEN CASE WHEN s.entered IS NULL THEN 'progress' END
      END
    END,
    s.role = 'module' OR coalesce(n.managed, false),
    CASE WHEN s.role = 'module' THEN coalesce(g.allocated AND g.all_done, false)
         ELSE coalesce(n.ready, false) END
  FROM scopes s LEFT JOIN nodes n ON n.id = s.id LEFT JOIN node_groups g ON g.parent_id = s.id
$$;
