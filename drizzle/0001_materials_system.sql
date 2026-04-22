CREATE TYPE "public"."batch_status" AS ENUM('active', 'used_up', 'inactive');--> statement-breakpoint
CREATE TYPE "public"."location_type" AS ENUM('warehouse', 'factory', 'other');--> statement-breakpoint
CREATE TYPE "public"."movement_type" AS ENUM('OUT', 'TRANSFER', 'RETURN', 'SCRAP', 'CONSUME');--> statement-breakpoint
DROP TABLE IF EXISTS "memos";--> statement-breakpoint
CREATE TABLE "materials" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"name" text NOT NULL,
	"type" text DEFAULT '' NOT NULL,
	"size" text DEFAULT '' NOT NULL,
	"unit" text DEFAULT '' NOT NULL,
	"remark" text DEFAULT '' NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "locations" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"name" text NOT NULL,
	"type" "location_type" DEFAULT 'warehouse' NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "batches" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"batch_code" text NOT NULL,
	"material_id" uuid NOT NULL,
	"production_date" date NOT NULL,
	"quantity" numeric(12, 2) NOT NULL,
	"price" numeric(12, 2) NOT NULL,
	"total_price" numeric(12, 2) NOT NULL,
	"supplier" text DEFAULT '' NOT NULL,
	"manufacturer" text DEFAULT '' NOT NULL,
	"initial_location_id" uuid NOT NULL,
	"status" "batch_status" DEFAULT 'active' NOT NULL,
	"remark" text DEFAULT '' NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "movements" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"batch_id" uuid NOT NULL,
	"date" date NOT NULL,
	"type" "movement_type" NOT NULL,
	"from_location_id" uuid,
	"to_location_id" uuid,
	"quantity" numeric(12, 2) NOT NULL,
	"remark" text DEFAULT '' NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "batches" ADD CONSTRAINT "batches_material_id_materials_id_fk" FOREIGN KEY ("material_id") REFERENCES "public"."materials"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "batches" ADD CONSTRAINT "batches_initial_location_id_locations_id_fk" FOREIGN KEY ("initial_location_id") REFERENCES "public"."locations"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "movements" ADD CONSTRAINT "movements_batch_id_batches_id_fk" FOREIGN KEY ("batch_id") REFERENCES "public"."batches"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "movements" ADD CONSTRAINT "movements_from_location_id_locations_id_fk" FOREIGN KEY ("from_location_id") REFERENCES "public"."locations"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "movements" ADD CONSTRAINT "movements_to_location_id_locations_id_fk" FOREIGN KEY ("to_location_id") REFERENCES "public"."locations"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "materials_name_idx" ON "materials" USING btree ("name");--> statement-breakpoint
CREATE INDEX "materials_type_idx" ON "materials" USING btree ("type");--> statement-breakpoint
CREATE UNIQUE INDEX "locations_name_idx" ON "locations" USING btree ("name");--> statement-breakpoint
CREATE UNIQUE INDEX "batches_code_idx" ON "batches" USING btree ("batch_code");--> statement-breakpoint
CREATE INDEX "batches_material_idx" ON "batches" USING btree ("material_id");--> statement-breakpoint
CREATE INDEX "batches_status_idx" ON "batches" USING btree ("status");--> statement-breakpoint
CREATE INDEX "batches_production_date_idx" ON "batches" USING btree ("production_date");--> statement-breakpoint
CREATE INDEX "batches_supplier_idx" ON "batches" USING btree ("supplier");--> statement-breakpoint
CREATE INDEX "batches_manufacturer_idx" ON "batches" USING btree ("manufacturer");--> statement-breakpoint
CREATE INDEX "movements_batch_idx" ON "movements" USING btree ("batch_id");--> statement-breakpoint
CREATE INDEX "movements_date_idx" ON "movements" USING btree ("date");--> statement-breakpoint
CREATE INDEX "movements_type_idx" ON "movements" USING btree ("type");--> statement-breakpoint
CREATE INDEX "movements_from_location_idx" ON "movements" USING btree ("from_location_id");--> statement-breakpoint
CREATE INDEX "movements_to_location_idx" ON "movements" USING btree ("to_location_id");--> statement-breakpoint
INSERT INTO "locations" ("name", "type") VALUES ('自己仓', 'warehouse') ON CONFLICT ("name") DO NOTHING;
