-- Day/template/interval identities stay attached to their original parent.
-- Replacements delete and insert children inside one transaction.
CREATE FUNCTION lock_schedule_parent() RETURNS trigger LANGUAGE plpgsql AS $$
DECLARE parent_column text; parent_table text; new_id uuid; old_id uuid;
BEGIN
 parent_column:=TG_ARGV[0]; parent_table:=TG_ARGV[1];
 new_id:=(to_jsonb(NEW)->>parent_column)::uuid; old_id:=(to_jsonb(OLD)->>parent_column)::uuid;
 IF TG_OP='UPDATE' AND new_id IS DISTINCT FROM old_id THEN
  RAISE EXCEPTION 'Schedule children cannot move between parents' USING ERRCODE='23514';
 END IF;
 EXECUTE format('SELECT id FROM %I WHERE id=$1 FOR UPDATE',parent_table) USING COALESCE(new_id,old_id);
 RETURN COALESCE(NEW,OLD);
END $$;
--> statement-breakpoint
DROP TRIGGER event_day_parent_lock ON event_days;
DROP FUNCTION lock_event_day_parent();
CREATE TRIGGER event_day_parent_lock BEFORE INSERT OR UPDATE OR DELETE ON event_days FOR EACH ROW EXECUTE FUNCTION lock_schedule_parent('occurrence_id','event_occurrences');
CREATE TRIGGER recurrence_day_parent_lock BEFORE INSERT OR UPDATE OR DELETE ON event_recurrence_days FOR EACH ROW EXECUTE FUNCTION lock_schedule_parent('recurrence_id','event_recurrences');
CREATE TRIGGER hours_interval_parent_lock BEFORE INSERT OR UPDATE OR DELETE ON place_hours_intervals FOR EACH ROW EXECUTE FUNCTION lock_schedule_parent('weekday_id','place_hours_weekdays');
CREATE TRIGGER exception_interval_parent_lock BEFORE INSERT OR UPDATE OR DELETE ON place_hours_exception_intervals FOR EACH ROW EXECUTE FUNCTION lock_schedule_parent('exception_id','place_hours_exceptions');
--> statement-breakpoint
CREATE FUNCTION validate_recurrence_days() RETURNS trigger LANGUAGE plpgsql AS $$
DECLARE rule_id uuid; rule event_recurrences; has_days boolean;
BEGIN
 IF TG_TABLE_NAME='event_recurrences' THEN rule_id:=COALESCE(NEW.id,OLD.id);
 ELSE rule_id:=COALESCE(NEW.recurrence_id,OLD.recurrence_id); END IF;
 SELECT * INTO rule FROM event_recurrences WHERE id=rule_id;
 IF NOT FOUND THEN RETURN NULL; END IF;
 SELECT EXISTS (SELECT FROM event_recurrence_days WHERE recurrence_id=rule_id) INTO has_days;
 IF (rule.mode='scheduled') IS DISTINCT FROM has_days THEN
  RAISE EXCEPTION 'Scheduled rules require days; expected rules cannot have days' USING ERRCODE='23514';
 END IF;
 RETURN NULL;
END $$;
--> statement-breakpoint
CREATE CONSTRAINT TRIGGER recurrence_days_valid AFTER INSERT OR UPDATE ON event_recurrences DEFERRABLE INITIALLY DEFERRED FOR EACH ROW EXECUTE FUNCTION validate_recurrence_days();
CREATE CONSTRAINT TRIGGER recurrence_template_valid AFTER INSERT OR UPDATE OR DELETE ON event_recurrence_days DEFERRABLE INITIALLY DEFERRED FOR EACH ROW EXECUTE FUNCTION validate_recurrence_days();
--> statement-breakpoint
CREATE FUNCTION validate_hours_state() RETURNS trigger LANGUAGE plpgsql AS $$
DECLARE parent_id uuid; parent_table text; child_table text; child_column text; state hours_state; has_intervals boolean;
BEGIN
 parent_table:=TG_ARGV[0]; child_table:=TG_ARGV[1]; child_column:=TG_ARGV[2];
 IF TG_TABLE_NAME=parent_table THEN parent_id:=COALESCE(NEW.id,OLD.id);
 ELSE parent_id:=COALESCE((to_jsonb(NEW)->>child_column)::uuid,(to_jsonb(OLD)->>child_column)::uuid); END IF;
 EXECUTE format('SELECT state FROM %I WHERE id=$1',parent_table) INTO state USING parent_id;
 IF state IS NULL THEN RETURN NULL; END IF;
 EXECUTE format('SELECT EXISTS (SELECT FROM %I WHERE %I=$1)',child_table,child_column) INTO has_intervals USING parent_id;
 IF (state='open') IS DISTINCT FROM has_intervals THEN
  RAISE EXCEPTION 'Open hours require intervals; closed and unknown hours cannot have intervals' USING ERRCODE='23514';
 END IF;
 RETURN NULL;
END $$;
--> statement-breakpoint
CREATE CONSTRAINT TRIGGER weekday_state_valid AFTER INSERT OR UPDATE ON place_hours_weekdays DEFERRABLE INITIALLY DEFERRED FOR EACH ROW EXECUTE FUNCTION validate_hours_state('place_hours_weekdays','place_hours_intervals','weekday_id');
CREATE CONSTRAINT TRIGGER weekday_intervals_valid AFTER INSERT OR UPDATE OR DELETE ON place_hours_intervals DEFERRABLE INITIALLY DEFERRED FOR EACH ROW EXECUTE FUNCTION validate_hours_state('place_hours_weekdays','place_hours_intervals','weekday_id');
CREATE CONSTRAINT TRIGGER exception_state_valid AFTER INSERT OR UPDATE ON place_hours_exceptions DEFERRABLE INITIALLY DEFERRED FOR EACH ROW EXECUTE FUNCTION validate_hours_state('place_hours_exceptions','place_hours_exception_intervals','exception_id');
CREATE CONSTRAINT TRIGGER exception_intervals_valid AFTER INSERT OR UPDATE OR DELETE ON place_hours_exception_intervals DEFERRABLE INITIALLY DEFERRED FOR EACH ROW EXECUTE FUNCTION validate_hours_state('place_hours_exceptions','place_hours_exception_intervals','exception_id');

--> statement-breakpoint
-- Compare local day boundaries without assuming midnight is unambiguous.
CREATE OR REPLACE FUNCTION validate_occurrence_days() RETURNS trigger LANGUAGE plpgsql AS $$
DECLARE occurrence_id uuid; parent event_occurrences; invalid boolean;
BEGIN
 IF TG_TABLE_NAME='event_occurrences' THEN occurrence_id:=COALESCE(NEW.id,OLD.id);
 ELSE occurrence_id:=COALESCE(NEW.occurrence_id,OLD.occurrence_id); END IF;
 SELECT * INTO parent FROM event_occurrences WHERE id=occurrence_id;
 IF NOT FOUND THEN RETURN NULL; END IF;
 IF parent.date_precision='month' THEN
  IF EXISTS (SELECT FROM event_days d WHERE d.occurrence_id=parent.id) THEN
   RAISE EXCEPTION 'Month placeholders cannot have days' USING ERRCODE='23514';
  END IF;
 ELSE
  IF NOT EXISTS (SELECT FROM event_days d WHERE d.occurrence_id=parent.id) THEN
   RAISE EXCEPTION 'Exact occurrences require a day' USING ERRCODE='23514';
  END IF;
  SELECT EXISTS (SELECT FROM event_days d WHERE d.occurrence_id=parent.id AND (
   d.date < parent.starts_on OR d.date >= parent.ends_on OR
   (d.time_kind <> 'unknown' AND (
    (d.starts_at AT TIME ZONE parent.timezone)::date <> d.date OR
    (d.starts_at AT TIME ZONE parent.timezone) < parent.starts_on::timestamp OR
    (d.ends_at AT TIME ZONE parent.timezone) > parent.ends_on::timestamp OR
    ((d.ends_at - interval '1 microsecond') AT TIME ZONE parent.timezone)::date > d.date+1 OR
    (d.time_kind='all_day' AND (
     ((d.starts_at - interval '1 microsecond') AT TIME ZONE parent.timezone)::date >= d.date OR
     (d.ends_at AT TIME ZONE parent.timezone)::date <= d.date OR
     ((d.ends_at - interval '1 microsecond') AT TIME ZONE parent.timezone)::date <> d.date
    ))
   ))
  )) INTO invalid;
  IF invalid THEN RAISE EXCEPTION 'Invalid occurrence day bounds' USING ERRCODE='23514'; END IF;
 END IF;
 RETURN NULL;
END $$;
