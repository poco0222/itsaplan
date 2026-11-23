CREATE OR REPLACE FUNCTION delivery_settings(pid integer) RETURNS jsonb LANGUAGE sql STABLE AS $$
  SELECT value || jsonb_build_object('planHierarchy', EXISTS (
    SELECT 1 FROM project_setting WHERE project_id = pid AND key = 'delivery_plan_hierarchy'
  ))
  FROM project_setting WHERE project_id = pid AND key = 'delivery_workflow'
$$;
--> statement-breakpoint
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
        WHEN v.value_number IS NULL AND r.role = 'task' THEN 0::numeric
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
--> statement-breakpoint
CREATE OR REPLACE FUNCTION delivery_root(pid integer, own_id integer, own_role text, parent integer)
RETURNS integer LANGUAGE sql STABLE AS $$
  SELECT CASE WHEN delivery_settings(pid)->>'planHierarchy' = 'true' THEN
    CASE own_role WHEN 'node' THEN own_id WHEN 'task' THEN parent END
  ELSE CASE own_role
    WHEN 'module' THEN own_id
    WHEN 'node' THEN parent
    WHEN 'task' THEN (SELECT parent_id FROM issue WHERE id = parent AND project_id = pid)
  END END
$$;
--> statement-breakpoint
CREATE OR REPLACE FUNCTION delivery_check_issue() RETURNS trigger LANGUAGE plpgsql AS $$
DECLARE
  old_settings jsonb;
  new_settings jsonb;
  old_role text;
  new_role text;
  parent_role text;
  old_root integer;
  new_root integer;
  closing boolean;
  shape_changed boolean;
  by_plan boolean;
BEGIN
  IF current_setting('itsaplan.delivery_sync', true) = 'yes' THEN
    RETURN NEW;
  END IF;
  IF TG_OP <> 'INSERT' THEN old_settings := delivery_settings(OLD.project_id); END IF;
  IF TG_OP <> 'DELETE' THEN new_settings := delivery_settings(NEW.project_id); END IF;
  IF old_settings IS NULL AND new_settings IS NULL THEN
    IF TG_OP = 'DELETE' THEN RETURN OLD; ELSE RETURN NEW; END IF;
  END IF;
  IF TG_OP = 'UPDATE' AND
    (OLD.project_id, OLD.type_id, OLD.parent_id, OLD.column_id, OLD.due_date)
      IS NOT DISTINCT FROM (NEW.project_id, NEW.type_id, NEW.parent_id, NEW.column_id, NEW.due_date)
    AND (OLD.initiative_id IS NOT DISTINCT FROM NEW.initiative_id
      OR new_settings->>'planHierarchy' IS DISTINCT FROM 'true') THEN
    RETURN NEW;
  END IF;

  IF TG_OP <> 'INSERT' AND old_settings IS NOT NULL THEN
    PERFORM pg_advisory_xact_lock(1145390933, OLD.project_id);
    old_role := delivery_role(delivery_settings(OLD.project_id), OLD.type_id);
    old_root := delivery_root(OLD.project_id, OLD.id, old_role, OLD.parent_id);
  END IF;
  IF TG_OP <> 'DELETE' AND new_settings IS NOT NULL THEN
    PERFORM pg_advisory_xact_lock(1145390933, NEW.project_id);
    new_settings := delivery_settings(NEW.project_id);
    new_role := delivery_role(new_settings, NEW.type_id);
    new_root := delivery_root(NEW.project_id, NEW.id, new_role, NEW.parent_id);
  END IF;
  IF EXISTS (SELECT 1 FROM delivery_handoff h WHERE h.module_id IN (old_root, new_root) AND h.reversed_at IS NULL)
    AND EXISTS (SELECT 1 FROM project WHERE id = coalesce(NEW.project_id, OLD.project_id)) THEN
    RAISE EXCEPTION USING ERRCODE = 'DP001';
  END IF;
  IF TG_OP = 'DELETE' THEN RETURN OLD; END IF;

  by_plan := new_settings->>'planHierarchy' IS NOT DISTINCT FROM 'true';
  SELECT delivery_role(new_settings, p.type_id) INTO parent_role
  FROM issue p WHERE p.id = NEW.parent_id AND p.project_id = NEW.project_id;
  IF by_plan AND new_role = 'task' THEN
    SELECT p.initiative_id INTO NEW.initiative_id
    FROM issue p JOIN initiative n ON n.id = p.initiative_id
    WHERE p.id = NEW.parent_id AND p.project_id = NEW.project_id AND n.project_id = NEW.project_id;
  ELSIF by_plan AND new_role = 'node' AND NEW.initiative_id IS NOT NULL AND NOT EXISTS (
    SELECT 1 FROM initiative WHERE id = NEW.initiative_id AND project_id = NEW.project_id
  ) THEN
    RAISE EXCEPTION USING ERRCODE = 'DP002';
  END IF;

  shape_changed := TG_OP = 'INSERT' OR (OLD.project_id, OLD.type_id, OLD.parent_id)
    IS DISTINCT FROM (NEW.project_id, NEW.type_id, NEW.parent_id);
  IF shape_changed AND (
    CASE new_role
      WHEN 'module' THEN by_plan OR NEW.parent_id IS NOT NULL
      WHEN 'node' THEN CASE WHEN by_plan THEN NEW.parent_id IS NOT NULL
                            ELSE parent_role IS DISTINCT FROM 'module' END
      WHEN 'task' THEN parent_role IS DISTINCT FROM 'node'
      WHEN 'maintenance' THEN by_plan OR parent_role IS DISTINCT FROM 'module'
      ELSE parent_role IS NOT NULL
    END
    OR (TG_OP = 'UPDATE' AND old_role IS DISTINCT FROM new_role AND EXISTS (
      SELECT 1 FROM issue child CROSS JOIN LATERAL (
        SELECT delivery_role(new_settings, child.type_id) AS role
      ) r WHERE child.parent_id = NEW.id AND child.project_id = NEW.project_id
        AND NOT coalesce(
          (new_role = 'module' AND r.role IN ('node', 'maintenance')) OR
          (new_role = 'node' AND r.role = 'task') OR
          (new_role IS NULL AND r.role IS NULL), false)
    ))
  ) THEN
    RAISE EXCEPTION USING ERRCODE = 'DP002';
  END IF;

  IF new_role IN ('module', 'node') AND (TG_OP = 'INSERT' OR NEW.column_id <> OLD.column_id) THEN
    SELECT state_type = 'completed' INTO closing FROM project_column WHERE id = NEW.column_id;
    IF closing AND (
      (TG_OP = 'INSERT' AND new_role = 'module') OR EXISTS (
        SELECT 1 FROM delivery_rollup(NEW.project_id) d WHERE d.id = NEW.id AND d.managed AND NOT d.ready
      )
    ) THEN
      RAISE EXCEPTION USING ERRCODE = 'DP003';
    END IF;
  END IF;
  RETURN NEW;
END
$$;
--> statement-breakpoint
DROP TRIGGER delivery_issue_guard ON issue;
CREATE TRIGGER delivery_issue_guard
  BEFORE INSERT OR UPDATE OF project_id,type_id,parent_id,column_id,due_date,initiative_id OR DELETE ON issue
  FOR EACH ROW EXECUTE FUNCTION delivery_check_issue();
--> statement-breakpoint
CREATE FUNCTION delivery_plan_children_changed() RETURNS trigger LANGUAGE plpgsql AS $$
DECLARE
  settings jsonb := delivery_settings(NEW.project_id);
BEGIN
  IF settings->>'planHierarchy' = 'true' AND delivery_role(settings, NEW.type_id) = 'node' THEN
    UPDATE issue SET initiative_id = NEW.initiative_id
    WHERE project_id = NEW.project_id AND parent_id = NEW.id
      AND type_id = (settings->>'taskTypeId')::integer
      AND initiative_id IS DISTINCT FROM NEW.initiative_id;
  END IF;
  RETURN NULL;
END
$$;

CREATE TRIGGER delivery_plan_children AFTER UPDATE OF initiative_id ON issue
  FOR EACH ROW WHEN (OLD.initiative_id IS DISTINCT FROM NEW.initiative_id)
  EXECUTE FUNCTION delivery_plan_children_changed();
