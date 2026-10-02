CREATE TYPE "public"."hours_state" AS ENUM('open', 'closed', 'unknown');--> statement-breakpoint
CREATE TYPE "public"."time_kind" AS ENUM('timed', 'all_day', 'unknown');--> statement-breakpoint
CREATE TYPE "public"."visibility" AS ENUM('public', 'private');--> statement-breakpoint
CREATE TYPE "public"."date_precision" AS ENUM('exact', 'month');--> statement-breakpoint
CREATE TYPE "public"."occurrence_status" AS ENUM('scheduled', 'tentative', 'cancelled');--> statement-breakpoint
CREATE TYPE "public"."recurrence_mode" AS ENUM('scheduled', 'expected');--> statement-breakpoint
CREATE TABLE "account" (
	"id" text PRIMARY KEY NOT NULL,
	"account_id" text NOT NULL,
	"provider_id" text NOT NULL,
	"issuer" text,
	"user_id" text NOT NULL,
	"access_token" text,
	"refresh_token" text,
	"id_token" text,
	"access_token_expires_at" timestamp,
	"refresh_token_expires_at" timestamp,
	"scope" text,
	"password" text,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "session" (
	"id" text PRIMARY KEY NOT NULL,
	"token" text NOT NULL,
	"expires_at" timestamp NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	"ip_address" text,
	"user_agent" text,
	"user_id" text NOT NULL,
	CONSTRAINT "session_token_unique" UNIQUE("token")
);
--> statement-breakpoint
CREATE TABLE "user" (
	"id" text PRIMARY KEY NOT NULL,
	"name" text NOT NULL,
	"email" text NOT NULL,
	"email_verified" boolean DEFAULT false NOT NULL,
	"image" text,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "user_email_unique" UNIQUE("email")
);
--> statement-breakpoint
CREATE TABLE "verification" (
	"id" text PRIMARY KEY NOT NULL,
	"identifier" text NOT NULL,
	"value" text NOT NULL,
	"expires_at" timestamp NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "locations" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"label" text NOT NULL,
	"address" text,
	"latitude" double precision NOT NULL,
	"longitude" double precision NOT NULL,
	"point" geography(Point,4326) GENERATED ALWAYS AS (ST_SetSRID(ST_MakePoint(longitude, latitude),4326)::geography) STORED,
	CONSTRAINT "locations_coordinates_check" CHECK ("locations"."latitude" BETWEEN -90 AND 90 AND "locations"."longitude" BETWEEN -180 AND 180)
);
--> statement-breakpoint
CREATE TABLE "place_hours_exception_intervals" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"exception_id" uuid NOT NULL,
	"start_minute" integer NOT NULL,
	"end_minute" integer NOT NULL,
	CONSTRAINT "place_exception_interval_check" CHECK ("place_hours_exception_intervals"."start_minute" BETWEEN 0 AND 1439 AND "place_hours_exception_intervals"."end_minute" > "place_hours_exception_intervals"."start_minute" AND "place_hours_exception_intervals"."end_minute" <= 2880)
);
--> statement-breakpoint
CREATE TABLE "place_hours_exceptions" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"place_id" uuid NOT NULL,
	"date" date NOT NULL,
	"state" "hours_state" NOT NULL,
	"note" text,
	CONSTRAINT "place_hours_exception_unique" UNIQUE("place_id","date")
);
--> statement-breakpoint
CREATE TABLE "place_hours_intervals" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"weekday_id" uuid NOT NULL,
	"start_minute" integer NOT NULL,
	"end_minute" integer NOT NULL,
	CONSTRAINT "place_hours_interval_check" CHECK ("place_hours_intervals"."start_minute" BETWEEN 0 AND 1439 AND "place_hours_intervals"."end_minute" > "place_hours_intervals"."start_minute" AND "place_hours_intervals"."end_minute" <= 2880)
);
--> statement-breakpoint
CREATE TABLE "place_hours_schedules" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"place_id" uuid NOT NULL,
	"label" text,
	"valid_from" date NOT NULL,
	"valid_to" date,
	CONSTRAINT "place_hours_dates_check" CHECK ("place_hours_schedules"."valid_to" IS NULL OR "place_hours_schedules"."valid_to" > "place_hours_schedules"."valid_from")
);
--> statement-breakpoint
CREATE TABLE "place_hours_weekdays" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"schedule_id" uuid NOT NULL,
	"weekday" integer NOT NULL,
	"state" "hours_state" NOT NULL,
	CONSTRAINT "place_hours_weekday_unique" UNIQUE("schedule_id","weekday"),
	CONSTRAINT "place_hours_weekday_check" CHECK ("place_hours_weekdays"."weekday" BETWEEN 1 AND 7)
);
--> statement-breakpoint
CREATE TABLE "place_prices" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"place_id" uuid NOT NULL,
	"label" text DEFAULT 'Admission' NOT NULL,
	"category" text DEFAULT 'general' NOT NULL,
	"coverage" text DEFAULT 'admission' NOT NULL,
	"amount" numeric(12, 2) NOT NULL,
	"currency" text NOT NULL,
	"valid_from" date NOT NULL,
	"valid_to" date,
	"weekdays" integer[] DEFAULT ARRAY[1,2,3,4,5,6,7]::integer[] NOT NULL,
	"start_minute" integer DEFAULT 0 NOT NULL,
	"end_minute" integer DEFAULT 1440 NOT NULL,
	CONSTRAINT "place_prices_amount_check" CHECK (amount >= 0 AND currency ~ '^[A-Z]{3}$'),
	CONSTRAINT "place_prices_dates_check" CHECK (valid_to IS NULL OR valid_to > valid_from),
	CONSTRAINT "place_prices_time_check" CHECK (start_minute >= 0 AND end_minute <= 1440 AND end_minute > start_minute),
	CONSTRAINT "place_prices_weekdays_check" CHECK (cardinality(weekdays) BETWEEN 1 AND 7 AND weekdays <@ ARRAY[1,2,3,4,5,6,7]::integer[] AND array_position(weekdays, NULL) IS NULL),
	CONSTRAINT "place_prices_coverage_check" CHECK (coverage IN ('admission', 'day', 'occurrence'))
);
--> statement-breakpoint
CREATE TABLE "places" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"owner_id" text NOT NULL,
	"name" text NOT NULL,
	"description" text,
	"visibility" "visibility" DEFAULT 'private' NOT NULL,
	"location_id" uuid NOT NULL,
	"timezone" text NOT NULL
);
--> statement-breakpoint
CREATE TABLE "event_days" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"occurrence_id" uuid NOT NULL,
	"date" date NOT NULL,
	"description" text,
	"time_kind" time_kind NOT NULL,
	"starts_at" timestamp with time zone,
	"ends_at" timestamp with time zone,
	CONSTRAINT "event_day_date_unique" UNIQUE("occurrence_id","date"),
	CONSTRAINT "event_day_time_check" CHECK (("event_days"."time_kind" = 'unknown' AND "event_days"."starts_at" IS NULL AND "event_days"."ends_at" IS NULL) OR ("event_days"."time_kind" <> 'unknown' AND "event_days"."starts_at" IS NOT NULL AND "event_days"."ends_at" IS NOT NULL AND "event_days"."ends_at" > "event_days"."starts_at"))
);
--> statement-breakpoint
CREATE TABLE "event_occurrences" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"event_id" uuid NOT NULL,
	"recurrence_id" uuid,
	"original_anchor" date,
	"status" "occurrence_status" DEFAULT 'scheduled' NOT NULL,
	"date_precision" date_precision NOT NULL,
	"starts_on" date,
	"ends_on" date,
	"expected_month" date,
	"location_id" uuid NOT NULL,
	"place_id" uuid,
	"timezone" text NOT NULL,
	"title" text,
	"description" text,
	CONSTRAINT "event_occurrence_event_unique" UNIQUE("id","event_id"),
	CONSTRAINT "event_occurrence_anchor_unique" UNIQUE("recurrence_id","original_anchor"),
	CONSTRAINT "event_occurrence_anchor_check" CHECK (("event_occurrences"."recurrence_id" IS NULL) = ("event_occurrences"."original_anchor" IS NULL)),
	CONSTRAINT "event_occurrence_dates_check" CHECK (("event_occurrences"."date_precision" = 'exact' AND "event_occurrences"."starts_on" IS NOT NULL AND "event_occurrences"."ends_on" IS NOT NULL AND "event_occurrences"."ends_on" > "event_occurrences"."starts_on" AND "event_occurrences"."expected_month" IS NULL) OR ("event_occurrences"."date_precision" = 'month' AND "event_occurrences"."starts_on" IS NULL AND "event_occurrences"."ends_on" IS NULL AND "event_occurrences"."expected_month" IS NOT NULL AND extract(day FROM "event_occurrences"."expected_month") = 1 AND "event_occurrences"."status" <> 'scheduled'))
);
--> statement-breakpoint
CREATE TABLE "event_prices" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"event_id" uuid NOT NULL,
	"occurrence_id" uuid,
	"label" text DEFAULT 'Admission' NOT NULL,
	"category" text DEFAULT 'general' NOT NULL,
	"coverage" text DEFAULT 'admission' NOT NULL,
	"amount" numeric(12, 2) NOT NULL,
	"currency" text NOT NULL,
	"valid_from" date NOT NULL,
	"valid_to" date,
	"weekdays" integer[] DEFAULT ARRAY[1,2,3,4,5,6,7]::integer[] NOT NULL,
	"start_minute" integer DEFAULT 0 NOT NULL,
	"end_minute" integer DEFAULT 1440 NOT NULL,
	CONSTRAINT "event_prices_amount_check" CHECK (amount >= 0 AND currency ~ '^[A-Z]{3}$'),
	CONSTRAINT "event_prices_dates_check" CHECK (valid_to IS NULL OR valid_to > valid_from),
	CONSTRAINT "event_prices_time_check" CHECK (start_minute >= 0 AND end_minute <= 1440 AND end_minute > start_minute),
	CONSTRAINT "event_prices_weekdays_check" CHECK (cardinality(weekdays) BETWEEN 1 AND 7 AND weekdays <@ ARRAY[1,2,3,4,5,6,7]::integer[] AND array_position(weekdays, NULL) IS NULL),
	CONSTRAINT "event_prices_coverage_check" CHECK (coverage IN ('admission', 'day', 'occurrence'))
);
--> statement-breakpoint
CREATE TABLE "event_recurrence_days" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"recurrence_id" uuid NOT NULL,
	"day_offset" integer NOT NULL,
	"description" text,
	"time_kind" time_kind NOT NULL,
	"start_minute" integer,
	"end_minute" integer,
	CONSTRAINT "event_template_day_unique" UNIQUE("recurrence_id","day_offset"),
	CONSTRAINT "event_template_offset_check" CHECK ("event_recurrence_days"."day_offset" BETWEEN 0 AND 365),
	CONSTRAINT "event_template_time_check" CHECK (("event_recurrence_days"."time_kind" = 'timed' AND "event_recurrence_days"."start_minute" IS NOT NULL AND "event_recurrence_days"."end_minute" IS NOT NULL AND "event_recurrence_days"."start_minute" BETWEEN 0 AND 1439 AND "event_recurrence_days"."end_minute" > "event_recurrence_days"."start_minute" AND "event_recurrence_days"."end_minute" <= 2880) OR ("event_recurrence_days"."time_kind" <> 'timed' AND "event_recurrence_days"."start_minute" IS NULL AND "event_recurrence_days"."end_minute" IS NULL))
);
--> statement-breakpoint
CREATE TABLE "event_recurrences" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"event_id" uuid NOT NULL,
	"mode" "recurrence_mode" NOT NULL,
	"anchor_date" date NOT NULL,
	"until_date" date,
	"rrule" text,
	"interval_months" integer,
	CONSTRAINT "event_recurrence_event_unique" UNIQUE("id","event_id"),
	CONSTRAINT "event_recurrence_mode_check" CHECK (("event_recurrences"."mode" = 'scheduled' AND "event_recurrences"."rrule" IS NOT NULL AND "event_recurrences"."interval_months" IS NULL) OR ("event_recurrences"."mode" = 'expected' AND "event_recurrences"."rrule" IS NULL AND "event_recurrences"."interval_months" > 0)),
	CONSTRAINT "event_recurrence_end_check" CHECK ("event_recurrences"."until_date" IS NULL OR "event_recurrences"."until_date" >= "event_recurrences"."anchor_date")
);
--> statement-breakpoint
CREATE TABLE "events" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"owner_id" text NOT NULL,
	"title" text NOT NULL,
	"description" text,
	"visibility" "visibility" DEFAULT 'private' NOT NULL,
	"location_id" uuid NOT NULL,
	"place_id" uuid,
	"timezone" text NOT NULL
);
--> statement-breakpoint
CREATE TABLE "event_tags" (
	"event_id" uuid NOT NULL,
	"tag_id" uuid NOT NULL,
	CONSTRAINT "event_tags_event_id_tag_id_pk" PRIMARY KEY("event_id","tag_id")
);
--> statement-breakpoint
CREATE TABLE "place_tags" (
	"place_id" uuid NOT NULL,
	"tag_id" uuid NOT NULL,
	CONSTRAINT "place_tags_place_id_tag_id_pk" PRIMARY KEY("place_id","tag_id")
);
--> statement-breakpoint
CREATE TABLE "tags" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"slug" text NOT NULL,
	"name" text NOT NULL,
	CONSTRAINT "tags_slug_unique" UNIQUE("slug")
);
--> statement-breakpoint
ALTER TABLE "account" ADD CONSTRAINT "account_user_id_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "session" ADD CONSTRAINT "session_user_id_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "place_hours_exception_intervals" ADD CONSTRAINT "place_hours_exception_intervals_exception_id_place_hours_exceptions_id_fk" FOREIGN KEY ("exception_id") REFERENCES "public"."place_hours_exceptions"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "place_hours_exceptions" ADD CONSTRAINT "place_hours_exceptions_place_id_places_id_fk" FOREIGN KEY ("place_id") REFERENCES "public"."places"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "place_hours_intervals" ADD CONSTRAINT "place_hours_intervals_weekday_id_place_hours_weekdays_id_fk" FOREIGN KEY ("weekday_id") REFERENCES "public"."place_hours_weekdays"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "place_hours_schedules" ADD CONSTRAINT "place_hours_schedules_place_id_places_id_fk" FOREIGN KEY ("place_id") REFERENCES "public"."places"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "place_hours_weekdays" ADD CONSTRAINT "place_hours_weekdays_schedule_id_place_hours_schedules_id_fk" FOREIGN KEY ("schedule_id") REFERENCES "public"."place_hours_schedules"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "place_prices" ADD CONSTRAINT "place_prices_place_id_places_id_fk" FOREIGN KEY ("place_id") REFERENCES "public"."places"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "places" ADD CONSTRAINT "places_owner_id_user_id_fk" FOREIGN KEY ("owner_id") REFERENCES "public"."user"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "places" ADD CONSTRAINT "places_location_id_locations_id_fk" FOREIGN KEY ("location_id") REFERENCES "public"."locations"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "event_days" ADD CONSTRAINT "event_days_occurrence_id_event_occurrences_id_fk" FOREIGN KEY ("occurrence_id") REFERENCES "public"."event_occurrences"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "event_occurrences" ADD CONSTRAINT "event_occurrences_event_id_events_id_fk" FOREIGN KEY ("event_id") REFERENCES "public"."events"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "event_occurrences" ADD CONSTRAINT "event_occurrences_location_id_locations_id_fk" FOREIGN KEY ("location_id") REFERENCES "public"."locations"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "event_occurrences" ADD CONSTRAINT "event_occurrences_place_id_places_id_fk" FOREIGN KEY ("place_id") REFERENCES "public"."places"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "event_occurrences" ADD CONSTRAINT "event_occurrence_recurrence_fk" FOREIGN KEY ("recurrence_id","event_id") REFERENCES "public"."event_recurrences"("id","event_id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "event_prices" ADD CONSTRAINT "event_prices_event_id_events_id_fk" FOREIGN KEY ("event_id") REFERENCES "public"."events"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "event_prices" ADD CONSTRAINT "event_price_occurrence_fk" FOREIGN KEY ("occurrence_id","event_id") REFERENCES "public"."event_occurrences"("id","event_id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "event_recurrence_days" ADD CONSTRAINT "event_recurrence_days_recurrence_id_event_recurrences_id_fk" FOREIGN KEY ("recurrence_id") REFERENCES "public"."event_recurrences"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "event_recurrences" ADD CONSTRAINT "event_recurrences_event_id_events_id_fk" FOREIGN KEY ("event_id") REFERENCES "public"."events"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "events" ADD CONSTRAINT "events_owner_id_user_id_fk" FOREIGN KEY ("owner_id") REFERENCES "public"."user"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "events" ADD CONSTRAINT "events_location_id_locations_id_fk" FOREIGN KEY ("location_id") REFERENCES "public"."locations"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "events" ADD CONSTRAINT "events_place_id_places_id_fk" FOREIGN KEY ("place_id") REFERENCES "public"."places"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "event_tags" ADD CONSTRAINT "event_tags_event_id_events_id_fk" FOREIGN KEY ("event_id") REFERENCES "public"."events"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "event_tags" ADD CONSTRAINT "event_tags_tag_id_tags_id_fk" FOREIGN KEY ("tag_id") REFERENCES "public"."tags"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "place_tags" ADD CONSTRAINT "place_tags_place_id_places_id_fk" FOREIGN KEY ("place_id") REFERENCES "public"."places"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "place_tags" ADD CONSTRAINT "place_tags_tag_id_tags_id_fk" FOREIGN KEY ("tag_id") REFERENCES "public"."tags"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "account_user_idx" ON "account" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "session_user_idx" ON "session" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "verification_identifier_idx" ON "verification" USING btree ("identifier");--> statement-breakpoint
CREATE INDEX "locations_point_idx" ON "locations" USING gist ("point");--> statement-breakpoint
CREATE INDEX "place_exception_intervals_day_idx" ON "place_hours_exception_intervals" USING btree ("exception_id");--> statement-breakpoint
CREATE INDEX "place_hours_intervals_day_idx" ON "place_hours_intervals" USING btree ("weekday_id");--> statement-breakpoint
CREATE INDEX "place_hours_place_idx" ON "place_hours_schedules" USING btree ("place_id");--> statement-breakpoint
CREATE INDEX "place_prices_place_idx" ON "place_prices" USING btree ("place_id");--> statement-breakpoint
CREATE INDEX "places_owner_idx" ON "places" USING btree ("owner_id");--> statement-breakpoint
CREATE INDEX "places_location_idx" ON "places" USING btree ("location_id");--> statement-breakpoint
CREATE INDEX "places_visibility_idx" ON "places" USING btree ("visibility");--> statement-breakpoint
CREATE INDEX "event_day_availability_idx" ON "event_days" USING gist (tstzrange("starts_at","ends_at",'[)')) WHERE "event_days"."time_kind" <> 'unknown';--> statement-breakpoint
CREATE INDEX "event_occurrence_event_idx" ON "event_occurrences" USING btree ("event_id");--> statement-breakpoint
CREATE INDEX "event_occurrence_place_idx" ON "event_occurrences" USING btree ("place_id");--> statement-breakpoint
CREATE INDEX "event_occurrence_location_idx" ON "event_occurrences" USING btree ("location_id");--> statement-breakpoint
CREATE INDEX "event_occurrence_dates_idx" ON "event_occurrences" USING gist (daterange("starts_on", "ends_on", '[)')) WHERE "event_occurrences"."date_precision" = 'exact';--> statement-breakpoint
CREATE INDEX "event_prices_event_idx" ON "event_prices" USING btree ("event_id");--> statement-breakpoint
CREATE INDEX "event_prices_occurrence_idx" ON "event_prices" USING btree ("occurrence_id");--> statement-breakpoint
CREATE INDEX "event_recurrence_event_idx" ON "event_recurrences" USING btree ("event_id");--> statement-breakpoint
CREATE INDEX "events_owner_idx" ON "events" USING btree ("owner_id");--> statement-breakpoint
CREATE INDEX "events_place_idx" ON "events" USING btree ("place_id");--> statement-breakpoint
CREATE INDEX "events_location_idx" ON "events" USING btree ("location_id");--> statement-breakpoint
CREATE INDEX "events_visibility_idx" ON "events" USING btree ("visibility");--> statement-breakpoint
CREATE INDEX "event_tags_tag_idx" ON "event_tags" USING btree ("tag_id");--> statement-breakpoint
CREATE INDEX "place_tags_tag_idx" ON "place_tags" USING btree ("tag_id");