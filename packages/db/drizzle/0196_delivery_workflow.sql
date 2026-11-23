-- The fork recorded this schema under 0187 before adopting the upstream journal.
DO $delivery_workflow$
BEGIN
  IF EXISTS (
    SELECT 1 FROM drizzle.__drizzle_migrations
    WHERE created_at = 1795158939711
      AND hash = '07401cf6e90f2837a2dc37e8dcd5e8d58743ca3e81e644238a656e1ea81ce984'
  ) THEN
    RETURN;
  END IF;

CREATE TABLE "delivery_handoff" (
	"id" serial PRIMARY KEY NOT NULL,
	"module_id" integer NOT NULL,
	"confirmed_by" text,
	"confirmed_at" timestamp with time zone DEFAULT now() NOT NULL,
	"reversed_by" text,
	"reversed_at" timestamp with time zone,
	"reversal_reason" text
);

ALTER TABLE "issue" ADD COLUMN "delivery_unknown_completion_id" integer;
ALTER TABLE "delivery_handoff" ADD CONSTRAINT "delivery_handoff_module_id_issue_id_fk" FOREIGN KEY ("module_id") REFERENCES "public"."issue"("id") ON DELETE cascade ON UPDATE no action;
ALTER TABLE "delivery_handoff" ADD CONSTRAINT "delivery_handoff_confirmed_by_user_id_fk" FOREIGN KEY ("confirmed_by") REFERENCES "public"."user"("id") ON DELETE set null ON UPDATE no action;
ALTER TABLE "delivery_handoff" ADD CONSTRAINT "delivery_handoff_reversed_by_user_id_fk" FOREIGN KEY ("reversed_by") REFERENCES "public"."user"("id") ON DELETE set null ON UPDATE no action;
CREATE INDEX "delivery_handoff_module_idx" ON "delivery_handoff" USING btree ("module_id","id");
CREATE UNIQUE INDEX "delivery_handoff_active_idx" ON "delivery_handoff" USING btree ("module_id") WHERE "delivery_handoff"."reversed_at" IS NULL;

CREATE TRIGGER delivery_handoff_rev AFTER INSERT OR UPDATE OR DELETE ON delivery_handoff
  FOR EACH ROW EXECUTE FUNCTION rev_issue_child('module_id', 'board');

CREATE FUNCTION delivery_settings(pid integer) RETURNS jsonb LANGUAGE sql STABLE AS $$
  SELECT value FROM project_setting WHERE project_id = pid AND key = 'delivery_workflow'
$$;

CREATE FUNCTION delivery_role(settings jsonb, tid integer) RETURNS text LANGUAGE sql IMMUTABLE AS $$
  SELECT CASE tid
    WHEN (settings->>'moduleTypeId')::integer THEN 'module'
    WHEN (settings->>'nodeTypeId')::integer THEN 'node'
    WHEN (settings->>'taskTypeId')::integer THEN 'task'
    WHEN (settings->>'maintenanceTypeId')::integer THEN 'maintenance'
  END
$$;

CREATE FUNCTION delivery_rollup(pid integer) RETURNS TABLE (
  id integer, module_id integer, role text, state text, valid boolean, progress numeric,
  problem text, managed boolean, ready boolean
) LANGUAGE sql STABLE AS $$
  WITH settings AS (SELECT delivery_settings(pid) AS value),
  items AS MATERIALIZED (
    SELECT i.id, i.parent_id, c.state_type AS state, r.role,
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
  ),
  scopes AS MATERIALIZED (
    SELECT i.*,
      CASE i.role
        WHEN 'module' THEN CASE WHEN i.parent_id IS NULL THEN i.id END
        WHEN 'node' THEN CASE WHEN p.role = 'module' AND p.parent_id IS NULL THEN p.id END
        WHEN 'maintenance' THEN CASE WHEN p.role = 'module' AND p.parent_id IS NULL THEN p.id END
        WHEN 'task' THEN CASE WHEN p.role = 'node' AND m.role = 'module' AND m.parent_id IS NULL THEN m.id END
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

CREATE FUNCTION delivery_sync(pid integer, roots integer[], complete_only boolean DEFAULT false)
RETURNS void LANGUAGE plpgsql AS $$
DECLARE
  tier text;
BEGIN
  IF current_setting('itsaplan.delivery_sync', true) = 'yes' OR delivery_settings(pid) IS NULL THEN
    RETURN;
  END IF;
  PERFORM set_config('itsaplan.delivery_sync', 'yes', true);
  FOREACH tier IN ARRAY ARRAY['node', 'module'] LOOP
    UPDATE issue i SET column_id = target.id, updated_at = now()
    FROM delivery_rollup(pid) d
    CROSS JOIN LATERAL (
      SELECT id FROM project_column
      WHERE project_id = pid AND state_type = CASE WHEN d.ready THEN 'completed' ELSE 'started' END
      ORDER BY position, id LIMIT 1
    ) target
    WHERE i.id = d.id AND d.role = tier AND d.valid AND d.managed AND d.state <> 'canceled'
      AND (roots IS NULL OR d.module_id = ANY(roots))
      AND ((d.ready AND d.state <> 'completed') OR (NOT complete_only AND NOT d.ready AND d.state = 'completed'))
      AND NOT EXISTS (
        SELECT 1 FROM delivery_handoff h WHERE h.module_id = d.module_id AND h.reversed_at IS NULL
      );
  END LOOP;
  PERFORM set_config('itsaplan.delivery_sync', 'no', true);
END
$$;

CREATE FUNCTION delivery_root(pid integer, own_id integer, own_role text, parent integer)
RETURNS integer LANGUAGE sql STABLE AS $$
  SELECT CASE own_role
    WHEN 'module' THEN own_id
    WHEN 'node' THEN parent
    WHEN 'task' THEN (SELECT parent_id FROM issue WHERE id = parent AND project_id = pid)
  END
$$;

CREATE FUNCTION delivery_check_issue() RETURNS trigger LANGUAGE plpgsql AS $$
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
      IS NOT DISTINCT FROM (NEW.project_id, NEW.type_id, NEW.parent_id, NEW.column_id, NEW.due_date) THEN
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

  SELECT delivery_role(new_settings, p.type_id) INTO parent_role
  FROM issue p WHERE p.id = NEW.parent_id AND p.project_id = NEW.project_id;
  shape_changed := TG_OP = 'INSERT' OR (OLD.project_id, OLD.type_id, OLD.parent_id)
    IS DISTINCT FROM (NEW.project_id, NEW.type_id, NEW.parent_id);
  IF shape_changed AND (
    CASE new_role
      WHEN 'module' THEN NEW.parent_id IS NOT NULL
      WHEN 'node' THEN parent_role IS DISTINCT FROM 'module'
      WHEN 'task' THEN parent_role IS DISTINCT FROM 'node'
      WHEN 'maintenance' THEN parent_role IS DISTINCT FROM 'module'
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

CREATE TRIGGER delivery_issue_guard BEFORE INSERT OR UPDATE OF project_id,type_id,parent_id,column_id,due_date OR DELETE ON issue
  FOR EACH ROW EXECUTE FUNCTION delivery_check_issue();

CREATE FUNCTION delivery_issue_changed() RETURNS trigger LANGUAGE plpgsql AS $$
DECLARE
  settings jsonb;
  at_time timestamptz;
  before_root integer;
  after_root integer;
BEGIN
  IF TG_OP = 'UPDATE' AND (OLD.project_id, OLD.type_id, OLD.parent_id, OLD.column_id)
    IS NOT DISTINCT FROM (NEW.project_id, NEW.type_id, NEW.parent_id, NEW.column_id) THEN
    RETURN NULL;
  END IF;
  IF TG_OP <> 'DELETE' THEN
    settings := delivery_settings(NEW.project_id);
    after_root := delivery_root(NEW.project_id, NEW.id, delivery_role(settings, NEW.type_id), NEW.parent_id);
    IF delivery_role(settings, NEW.type_id) IS NOT NULL AND (TG_OP = 'INSERT' OR OLD.column_id <> NEW.column_id) THEN
      at_time := CASE WHEN TG_OP = 'INSERT' THEN NEW.created_at ELSE clock_timestamp() END;
      UPDATE issue_status SET left_at = at_time WHERE issue_id = NEW.id AND left_at IS NULL;
      INSERT INTO issue_status(issue_id, column_id, column_name, state_type, entered_at)
        SELECT NEW.id, id, name, state_type, at_time FROM project_column WHERE id = NEW.column_id;
    END IF;
  END IF;
  IF TG_OP <> 'INSERT' THEN
    before_root := delivery_root(OLD.project_id, OLD.id, delivery_role(delivery_settings(OLD.project_id), OLD.type_id), OLD.parent_id);
  END IF;
  IF TG_OP = 'UPDATE' AND OLD.project_id = NEW.project_id THEN
    IF before_root IS NOT NULL OR after_root IS NOT NULL THEN
      PERFORM delivery_sync(NEW.project_id, ARRAY[before_root, after_root]);
    END IF;
  ELSE
    IF before_root IS NOT NULL THEN PERFORM delivery_sync(OLD.project_id, ARRAY[before_root]); END IF;
    IF after_root IS NOT NULL THEN PERFORM delivery_sync(NEW.project_id, ARRAY[after_root]); END IF;
  END IF;
  RETURN NULL;
END
$$;

CREATE TRIGGER delivery_issue_rollup AFTER INSERT OR UPDATE OF project_id,type_id,parent_id,column_id OR DELETE ON issue
  FOR EACH ROW EXECUTE FUNCTION delivery_issue_changed();

CREATE FUNCTION delivery_field_changed() RETURNS trigger LANGUAGE plpgsql AS $$
DECLARE
  item issue%ROWTYPE;
  settings jsonb;
  fid integer;
  role text;
  root integer;
BEGIN
  SELECT * INTO item FROM issue WHERE id = coalesce(NEW.issue_id, OLD.issue_id);
  IF delivery_settings(item.project_id) IS NULL THEN
    IF TG_OP = 'DELETE' THEN RETURN OLD; ELSE RETURN NEW; END IF;
  END IF;
  PERFORM pg_advisory_xact_lock(1145390933, item.project_id);
  SELECT * INTO item FROM issue WHERE id = coalesce(NEW.issue_id, OLD.issue_id);
  settings := delivery_settings(item.project_id);

  fid := coalesce(NEW.field_id, OLD.field_id);
  role := delivery_role(settings, item.type_id);
  IF (role = 'node' AND fid IN ((settings->>'nodeWeightId')::integer, (settings->>'nodeProgressId')::integer))
    OR (role = 'task' AND fid IN ((settings->>'taskWeightId')::integer, (settings->>'taskProgressId')::integer)) THEN
    root := delivery_root(item.project_id, item.id, role, item.parent_id);
    IF TG_WHEN = 'AFTER' THEN
      IF root IS NOT NULL THEN PERFORM delivery_sync(item.project_id, ARRAY[root]); END IF;
      RETURN NULL;
    END IF;
    IF EXISTS (SELECT 1 FROM delivery_handoff WHERE module_id = root AND reversed_at IS NULL) THEN
      RAISE EXCEPTION USING ERRCODE = 'DP001';
    END IF;
    IF TG_OP <> 'DELETE' AND NEW.value_number IS NOT NULL AND NOT (NEW.value_number BETWEEN 0 AND 100) THEN
      RAISE EXCEPTION USING ERRCODE = 'DP004';
    END IF;
  END IF;
  IF TG_OP = 'DELETE' THEN RETURN OLD; ELSE RETURN NEW; END IF;
END
$$;

CREATE TRIGGER delivery_field_guard BEFORE INSERT OR UPDATE OR DELETE ON issue_field_value
  FOR EACH ROW EXECUTE FUNCTION delivery_field_changed();

CREATE TRIGGER delivery_field_rollup AFTER INSERT OR UPDATE OR DELETE ON issue_field_value
  FOR EACH ROW EXECUTE FUNCTION delivery_field_changed();

CREATE FUNCTION delivery_completion(target integer)
RETURNS TABLE (id integer, entered_at timestamptz) LANGUAGE sql STABLE AS $$
  SELECT s.id, s.entered_at FROM issue_status s
  WHERE s.issue_id = target AND s.state_type = 'completed'
    AND NOT EXISTS (
      SELECT 1 FROM issue_status p WHERE p.issue_id = s.issue_id AND p.state_type IS DISTINCT FROM 'completed'
        AND (p.entered_at, p.id) > (s.entered_at, s.id)
    )
  ORDER BY s.entered_at, s.id LIMIT 1
$$;

CREATE FUNCTION delivery_check_binding() RETURNS trigger LANGUAGE plpgsql AS $$
DECLARE
  settings jsonb;
BEGIN
  PERFORM pg_advisory_xact_lock(1145390933, OLD.project_id);
  settings := delivery_settings(OLD.project_id);
  IF settings IS NOT NULL AND EXISTS (SELECT 1 FROM project WHERE id = OLD.project_id) THEN
    IF TG_TABLE_NAME = 'issue_type' THEN
      IF delivery_role(settings, OLD.id) IS NOT NULL THEN RAISE EXCEPTION USING ERRCODE = 'DP005'; END IF;
    ELSIF TG_TABLE_NAME = 'custom_field' THEN
      IF OLD.id IN (
        (settings->>'nodeWeightId')::integer, (settings->>'taskWeightId')::integer,
        (settings->>'nodeProgressId')::integer, (settings->>'taskProgressId')::integer
      ) AND (TG_OP = 'DELETE' OR (OLD.field_type, OLD.issue_type_id) IS DISTINCT FROM (NEW.field_type, NEW.issue_type_id)) THEN
        RAISE EXCEPTION USING ERRCODE = 'DP005';
      END IF;
    ELSIF TG_OP = 'DELETE' OR OLD.state_type IS DISTINCT FROM NEW.state_type THEN
      IF EXISTS (
        SELECT 1 FROM issue i WHERE i.column_id = OLD.id
          AND delivery_role(settings, i.type_id) IS NOT NULL
      ) OR (OLD.state_type IN ('started', 'completed') AND NOT EXISTS (
        SELECT 1 FROM project_column c
        WHERE c.project_id = OLD.project_id AND c.id <> OLD.id AND c.state_type = OLD.state_type
      )) THEN
        RAISE EXCEPTION USING ERRCODE = 'DP005';
      END IF;
    END IF;
  END IF;
  IF TG_OP = 'DELETE' THEN RETURN OLD; ELSE RETURN NEW; END IF;
END
$$;

CREATE TRIGGER delivery_type_binding BEFORE DELETE ON issue_type
  FOR EACH ROW EXECUTE FUNCTION delivery_check_binding();

CREATE TRIGGER delivery_field_binding BEFORE UPDATE OF field_type,issue_type_id OR DELETE ON custom_field
  FOR EACH ROW EXECUTE FUNCTION delivery_check_binding();

CREATE TRIGGER delivery_column_binding BEFORE UPDATE OF state_type OR DELETE ON project_column
  FOR EACH ROW EXECUTE FUNCTION delivery_check_binding();

CREATE FUNCTION delivery_settings_changed() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  PERFORM bump_rev('board:' || NEW.project_id, NEW.project_id);
  RETURN NULL;
END
$$;

CREATE TRIGGER delivery_settings_rev AFTER INSERT OR UPDATE ON project_setting
  FOR EACH ROW WHEN (NEW.key = 'delivery_workflow') EXECUTE FUNCTION delivery_settings_changed();
END;
$delivery_workflow$;
