CREATE TABLE "reaction" (
	"message_id" text NOT NULL,
	"scope" text NOT NULL,
	"user_id" text NOT NULL,
	"kind" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "reaction_message_id_user_id_pk" PRIMARY KEY("message_id","user_id")
);
--> statement-breakpoint
CREATE TABLE "toque" (
	"id" text PRIMARY KEY NOT NULL,
	"from_id" text NOT NULL,
	"to_id" text NOT NULL,
	"kind" text NOT NULL,
	"seen_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "reaction" ADD CONSTRAINT "reaction_user_id_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "toque" ADD CONSTRAINT "toque_from_id_user_id_fk" FOREIGN KEY ("from_id") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "toque" ADD CONSTRAINT "toque_to_id_user_id_fk" FOREIGN KEY ("to_id") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "reaction_msg_idx" ON "reaction" USING btree ("message_id");--> statement-breakpoint
CREATE INDEX "toque_to_idx" ON "toque" USING btree ("to_id","created_at");--> statement-breakpoint
CREATE INDEX "toque_pair_idx" ON "toque" USING btree ("from_id","to_id","created_at");