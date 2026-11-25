ALTER TABLE "issue_field_value" ADD COLUMN "restore_on_reopen" boolean DEFAULT false NOT NULL;--> statement-breakpoint
ALTER TABLE "issue_field_value" ADD COLUMN "number_before_completion" numeric;--> statement-breakpoint
ALTER TABLE "project_column" ADD COLUMN "field_updates" jsonb DEFAULT '[]'::jsonb NOT NULL;
--> statement-breakpoint
CREATE FUNCTION apply_status_field_updates() RETURNS trigger LANGUAGE plpgsql AS $$
DECLARE
  previous_state text;
  target_state text;
  updates jsonb;
  transition_time timestamptz := clock_timestamp();
BEGIN
  -- The delivery rollup can move this item again before this trigger runs.
  SELECT source.state_type, target.state_type, target.field_updates
    INTO previous_state, target_state, updates
    FROM issue i
    JOIN project_column target ON target.id = i.column_id AND target.project_id = i.project_id
    JOIN project_column source ON source.id = OLD.column_id
    WHERE i.id = NEW.id AND target.id = NEW.column_id;
  IF NOT FOUND THEN RETURN NULL; END IF;

  IF previous_state IN ('completed', 'canceled') AND target_state IN ('backlog', 'unstarted', 'started') THEN
    UPDATE issue_field_value v SET
      value_number = CASE WHEN f.field_type = 'number' THEN v.number_before_completion ELSE v.value_number END,
      value_date = CASE WHEN f.field_type = 'date' THEN NULL ELSE v.value_date END,
      restore_on_reopen = false,
      number_before_completion = NULL
    FROM custom_field f
    WHERE v.issue_id = NEW.id AND v.restore_on_reopen
      AND f.id = v.field_id AND f.project_id = NEW.project_id;
  END IF;

  IF updates = '[]'::jsonb THEN RETURN NULL; END IF;

  INSERT INTO issue_field_value AS stored (issue_id, field_id, value_number, value_date, restore_on_reopen)
    SELECT NEW.id, f.id,
      CASE WHEN rule.type = 'number' THEN rule.value END,
      CASE WHEN rule.type = 'date' THEN (transition_time AT TIME ZONE rule."timeZone")::date END,
      target_state = 'completed'
    FROM jsonb_to_recordset(updates) AS rule("fieldId" integer, type text, value numeric, "timeZone" text)
    JOIN custom_field f ON f.id = rule."fieldId" AND f.project_id = NEW.project_id
      AND f.field_type = rule.type AND (f.issue_type_id IS NULL OR f.issue_type_id = NEW.type_id)
    ON CONFLICT (issue_id, field_id) DO UPDATE SET
      value_number = coalesce(excluded.value_number, stored.value_number),
      value_date = coalesce(excluded.value_date, stored.value_date),
      number_before_completion = CASE WHEN excluded.restore_on_reopen AND NOT stored.restore_on_reopen
        THEN stored.value_number ELSE stored.number_before_completion END,
      restore_on_reopen = stored.restore_on_reopen OR excluded.restore_on_reopen;
  RETURN NULL;
END
$$;
--> statement-breakpoint
-- Run after delivery status changes and before the issue revision takes the board lock.
CREATE TRIGGER issue_field_updates AFTER UPDATE OF column_id ON issue
  FOR EACH ROW WHEN (OLD.project_id = NEW.project_id AND OLD.column_id <> NEW.column_id)
  EXECUTE FUNCTION apply_status_field_updates();
