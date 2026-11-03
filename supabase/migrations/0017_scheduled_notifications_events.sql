CREATE TABLE "product_events" (
	"id" text PRIMARY KEY NOT NULL,
	"user_id" uuid NOT NULL,
	"name" text NOT NULL,
	"schema_version" integer DEFAULT 1 NOT NULL,
	"properties_json" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"occurred_at" timestamp with time zone NOT NULL,
	"created_at" timestamp with time zone NOT NULL,
	CONSTRAINT "product_events_schema_version_check" CHECK ("product_events"."schema_version" >= 1)
);
--> statement-breakpoint
ALTER TABLE "product_events" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE TABLE "scheduled_notifications" (
	"id" text PRIMARY KEY NOT NULL,
	"user_id" uuid NOT NULL,
	"kind" text NOT NULL,
	"fire_at" timestamp with time zone NOT NULL,
	"payload_json" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"status" text DEFAULT 'scheduled' NOT NULL,
	"sent_at" timestamp with time zone,
	"created_at" timestamp with time zone NOT NULL,
	"updated_at" timestamp with time zone NOT NULL,
	"deleted_at" timestamp with time zone,
	CONSTRAINT "scheduled_notifications_status_check" CHECK ("scheduled_notifications"."status" in ('scheduled','sent','cancelled')),
	CONSTRAINT "scheduled_notifications_kind_check" CHECK ("scheduled_notifications"."kind" in ('plan_ready','due_review','streak_risk','weekly_mission','media_pick','reengagement'))
);
--> statement-breakpoint
ALTER TABLE "scheduled_notifications" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE "product_events" ADD CONSTRAINT "product_events_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "scheduled_notifications" ADD CONSTRAINT "scheduled_notifications_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "idx_product_events_user_time" ON "product_events" USING btree ("user_id","occurred_at");--> statement-breakpoint
CREATE INDEX "idx_scheduled_notifications_user_time" ON "scheduled_notifications" USING btree ("user_id","fire_at");