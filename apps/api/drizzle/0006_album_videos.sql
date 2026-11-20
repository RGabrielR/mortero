ALTER TABLE "album_grant" ADD COLUMN "expires_at" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "photo" ADD COLUMN "kind" text DEFAULT 'photo' NOT NULL;--> statement-breakpoint
ALTER TABLE "photo" ADD COLUMN "poster_key" text;--> statement-breakpoint
ALTER TABLE "photo" ADD COLUMN "seconds" integer;