CREATE EXTENSION IF NOT EXISTS btree_gist;
--> statement-breakpoint
ALTER TABLE place_hours_schedules ADD CONSTRAINT place_hours_seasons_exclude
EXCLUDE USING gist (place_id WITH =, daterange(valid_from, valid_to, '[)') WITH &&);
--> statement-breakpoint
ALTER TABLE event_recurrences ADD CONSTRAINT event_recurrence_segments_exclude
EXCLUDE USING gist (event_id WITH =, daterange(anchor_date, until_date, '[]') WITH &&);
--> statement-breakpoint
ALTER TABLE place_hours_intervals ADD CONSTRAINT place_hours_intervals_exclude
EXCLUDE USING gist (weekday_id WITH =, int4range(start_minute, end_minute, '[)') WITH &&);
--> statement-breakpoint
ALTER TABLE place_hours_exception_intervals ADD CONSTRAINT place_exception_intervals_exclude
EXCLUDE USING gist (exception_id WITH =, int4range(start_minute, end_minute, '[)') WITH &&);
--> statement-breakpoint
CREATE FUNCTION validate_entity_timezone() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
 IF NOT EXISTS (SELECT FROM pg_timezone_names WHERE name = NEW.timezone) THEN
  RAISE EXCEPTION 'Invalid time zone' USING ERRCODE = '23514';
 END IF;
 RETURN NEW;
END $$;
--> statement-breakpoint
CREATE TRIGGER places_timezone BEFORE INSERT OR UPDATE OF timezone ON places FOR EACH ROW EXECUTE FUNCTION validate_entity_timezone();
CREATE TRIGGER events_timezone BEFORE INSERT OR UPDATE OF timezone ON events FOR EACH ROW EXECUTE FUNCTION validate_entity_timezone();
CREATE TRIGGER occurrences_timezone BEFORE INSERT OR UPDATE OF timezone ON event_occurrences FOR EACH ROW EXECUTE FUNCTION validate_entity_timezone();
--> statement-breakpoint
-- Share locks on venues conflict with privacy changes, but allow concurrent event creation.
CREATE FUNCTION validate_event_venues() RETURNS trigger LANGUAGE plpgsql AS $$
DECLARE venue places; venue_id uuid;
BEGIN
 FOR venue_id IN SELECT DISTINCT id FROM (
  SELECT NEW.place_id AS id UNION ALL SELECT place_id FROM event_occurrences WHERE event_id=NEW.id
 ) refs WHERE id IS NOT NULL ORDER BY id LOOP
  SELECT * INTO venue FROM places WHERE id=venue_id FOR SHARE;
  IF NEW.visibility='public' AND venue.visibility <> 'public' THEN
   RAISE EXCEPTION 'Public events require public places' USING ERRCODE='23514';
  END IF;
 END LOOP;
 RETURN NEW;
END $$;
--> statement-breakpoint
CREATE TRIGGER events_venues BEFORE INSERT OR UPDATE OF visibility, place_id ON events FOR EACH ROW EXECUTE FUNCTION validate_event_venues();
--> statement-breakpoint
CREATE FUNCTION validate_occurrence_venue() RETURNS trigger LANGUAGE plpgsql AS $$
DECLARE parent events; venue places;
BEGIN
 SELECT * INTO parent FROM events WHERE id=NEW.event_id FOR SHARE;
 IF NEW.place_id IS NOT NULL THEN
  SELECT * INTO venue FROM places WHERE id=NEW.place_id FOR SHARE;
  IF parent.visibility='public' AND venue.visibility <> 'public' THEN
   RAISE EXCEPTION 'Public occurrences require public places' USING ERRCODE='23514';
  END IF;
 END IF;
 RETURN NEW;
END $$;
--> statement-breakpoint
CREATE TRIGGER occurrences_venues BEFORE INSERT OR UPDATE OF event_id, place_id ON event_occurrences FOR EACH ROW EXECUTE FUNCTION validate_occurrence_venue();
--> statement-breakpoint
CREATE FUNCTION validate_place_privacy() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
 IF NEW.visibility='private' AND OLD.visibility='public' AND (
  EXISTS (SELECT FROM events WHERE place_id=NEW.id AND visibility='public') OR
  EXISTS (SELECT FROM event_occurrences o JOIN events e ON e.id=o.event_id WHERE o.place_id=NEW.id AND e.visibility='public')
 ) THEN RAISE EXCEPTION 'Place is referenced by a public event' USING ERRCODE='23514'; END IF;
 RETURN NEW;
END $$;
--> statement-breakpoint
CREATE TRIGGER places_privacy BEFORE UPDATE OF visibility ON places FOR EACH ROW EXECUTE FUNCTION validate_place_privacy();
--> statement-breakpoint
CREATE FUNCTION lock_event_day_parent() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
 PERFORM id FROM event_occurrences WHERE id=COALESCE(NEW.occurrence_id,OLD.occurrence_id) FOR UPDATE;
 RETURN COALESCE(NEW,OLD);
END $$;
--> statement-breakpoint
CREATE TRIGGER event_day_parent_lock BEFORE INSERT OR UPDATE OR DELETE ON event_days FOR EACH ROW EXECUTE FUNCTION lock_event_day_parent();
--> statement-breakpoint
CREATE FUNCTION validate_occurrence_days() RETURNS trigger LANGUAGE plpgsql AS $$
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
    d.starts_at < (parent.starts_on::timestamp AT TIME ZONE parent.timezone) OR
    d.ends_at > (parent.ends_on::timestamp AT TIME ZONE parent.timezone) OR
    (d.ends_at AT TIME ZONE parent.timezone)::date > d.date+1 OR
    (d.time_kind='all_day' AND (
     d.starts_at <> (d.date::timestamp AT TIME ZONE parent.timezone) OR
     d.ends_at <> ((d.date+1)::timestamp AT TIME ZONE parent.timezone)
    ))
   ))
  )) INTO invalid;
  IF invalid THEN RAISE EXCEPTION 'Invalid occurrence day bounds' USING ERRCODE='23514'; END IF;
 END IF;
 RETURN NULL;
END $$;
--> statement-breakpoint
CREATE CONSTRAINT TRIGGER occurrence_days_valid AFTER INSERT OR UPDATE ON event_occurrences DEFERRABLE INITIALLY DEFERRED FOR EACH ROW EXECUTE FUNCTION validate_occurrence_days();
CREATE CONSTRAINT TRIGGER event_days_valid AFTER INSERT OR UPDATE OR DELETE ON event_days DEFERRABLE INITIALLY DEFERRED FOR EACH ROW EXECUTE FUNCTION validate_occurrence_days();
--> statement-breakpoint
CREATE FUNCTION validate_price_overlap() RETURNS trigger LANGUAGE plpgsql AS $$
DECLARE owner_column text; parent_table text; parent_id uuid; overlap_found boolean; scope_predicate text;
BEGIN
 IF TG_TABLE_NAME='event_prices' THEN owner_column:='event_id'; parent_table:='events'; scope_predicate:='occurrence_id IS NOT DISTINCT FROM $10';
 ELSE owner_column:='place_id'; parent_table:='places'; scope_predicate:='true'; END IF;
 parent_id := (to_jsonb(NEW)->>owner_column)::uuid;
 EXECUTE format('SELECT id FROM %I WHERE id=$1 FOR UPDATE',parent_table) USING parent_id;
 EXECUTE format('SELECT EXISTS (SELECT FROM %I WHERE %I=$1 AND id<>$2 AND label=$3 AND category=$4 AND coverage=$5 AND daterange(valid_from,valid_to,''[)'') && $6 AND weekdays && $7 AND start_minute<$9 AND end_minute>$8 AND %s)', TG_TABLE_NAME,owner_column,scope_predicate)
 INTO overlap_found USING parent_id,NEW.id,NEW.label,NEW.category,NEW.coverage,daterange(NEW.valid_from,NEW.valid_to,'[)'),NEW.weekdays,NEW.start_minute,NEW.end_minute,(to_jsonb(NEW)->>'occurrence_id')::uuid;
 IF overlap_found THEN RAISE EXCEPTION 'Conflicting prices' USING ERRCODE='23514'; END IF;
 RETURN NEW;
END $$;
--> statement-breakpoint
CREATE TRIGGER event_prices_overlap BEFORE INSERT OR UPDATE ON event_prices FOR EACH ROW EXECUTE FUNCTION validate_price_overlap();
CREATE TRIGGER place_prices_overlap BEFORE INSERT OR UPDATE ON place_prices FOR EACH ROW EXECUTE FUNCTION validate_price_overlap();
