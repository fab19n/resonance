CREATE TYPE "public"."focus_type" AS ENUM('lyrics', 'beat', 'rhythm', 'production', 'instrumentation', 'emotion', 'structure');--> statement-breakpoint
CREATE TABLE "notifications" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid NOT NULL,
	"type" varchar(50) NOT NULL,
	"match_id" uuid,
	"read" boolean DEFAULT false NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "platform_track_ids" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"isrc" varchar(15) NOT NULL,
	"platform" varchar(30) NOT NULL,
	"platform_track_id" varchar(100) NOT NULL,
	CONSTRAINT "isrc_platform_uniq" UNIQUE("isrc","platform")
);
--> statement-breakpoint
CREATE TABLE "post_matches" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"post_a_id" uuid NOT NULL,
	"post_b_id" uuid NOT NULL,
	"match_tier" integer NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "resonance_posts" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid NOT NULL,
	"isrc" varchar(15) NOT NULL,
	"progress_ms" integer NOT NULL,
	"focus_type" "focus_type" NOT NULL,
	"sensory_tags" text[],
	"reflection" text,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "tracks" (
	"isrc" varchar(15) PRIMARY KEY NOT NULL,
	"title" varchar(255) NOT NULL,
	"artist" varchar(255) NOT NULL,
	"album_name" varchar(255),
	"album_art_url" text,
	"duration_ms" integer NOT NULL,
	"isrc_source" varchar(20) DEFAULT 'verified' NOT NULL
);
--> statement-breakpoint
CREATE TABLE "users" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"username" varchar(50) NOT NULL,
	"display_name" varchar(100),
	"avatar_url" text,
	"email" varchar(255),
	"spotify_id" varchar(50) NOT NULL,
	"spotify_access_token" text NOT NULL,
	"spotify_refresh_token" text NOT NULL,
	"spotify_token_expires_at" timestamp NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "users_username_unique" UNIQUE("username"),
	CONSTRAINT "users_email_unique" UNIQUE("email"),
	CONSTRAINT "users_spotify_id_unique" UNIQUE("spotify_id")
);
--> statement-breakpoint
ALTER TABLE "notifications" ADD CONSTRAINT "notifications_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "notifications" ADD CONSTRAINT "notifications_match_id_post_matches_id_fk" FOREIGN KEY ("match_id") REFERENCES "public"."post_matches"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "platform_track_ids" ADD CONSTRAINT "platform_track_ids_isrc_tracks_isrc_fk" FOREIGN KEY ("isrc") REFERENCES "public"."tracks"("isrc") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "post_matches" ADD CONSTRAINT "post_matches_post_a_id_resonance_posts_id_fk" FOREIGN KEY ("post_a_id") REFERENCES "public"."resonance_posts"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "post_matches" ADD CONSTRAINT "post_matches_post_b_id_resonance_posts_id_fk" FOREIGN KEY ("post_b_id") REFERENCES "public"."resonance_posts"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "resonance_posts" ADD CONSTRAINT "resonance_posts_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "resonance_posts" ADD CONSTRAINT "resonance_posts_isrc_tracks_isrc_fk" FOREIGN KEY ("isrc") REFERENCES "public"."tracks"("isrc") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "user_notif_idx" ON "notifications" USING btree ("user_id","read");--> statement-breakpoint
CREATE INDEX "platform_lookup_idx" ON "platform_track_ids" USING btree ("platform","platform_track_id");--> statement-breakpoint
CREATE INDEX "post_matches_a_idx" ON "post_matches" USING btree ("post_a_id");--> statement-breakpoint
CREATE INDEX "post_matches_b_idx" ON "post_matches" USING btree ("post_b_id");--> statement-breakpoint
CREATE INDEX "track_moment_idx" ON "resonance_posts" USING btree ("isrc","progress_ms");--> statement-breakpoint
CREATE INDEX "user_posts_idx" ON "resonance_posts" USING btree ("user_id","created_at");