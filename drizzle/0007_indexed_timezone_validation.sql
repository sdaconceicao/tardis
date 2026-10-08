CREATE TABLE "valid_timezones" (
	"name" text PRIMARY KEY NOT NULL
);--> statement-breakpoint
INSERT INTO valid_timezones (name)
SELECT DISTINCT name FROM pg_timezone_names;--> statement-breakpoint
CREATE OR REPLACE FUNCTION validate_entity_timezone() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
 IF NOT EXISTS (SELECT 1 FROM valid_timezones WHERE name = NEW.timezone)
    AND NOT EXISTS (SELECT 1 FROM pg_timezone_names WHERE name = NEW.timezone) THEN
  RAISE EXCEPTION 'Invalid time zone' USING ERRCODE = '23514';
 END IF;
 RETURN NEW;
END $$;
