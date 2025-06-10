CREATE TABLE "group_members" (
	"id" text PRIMARY KEY NOT NULL,
	"group_id" text,
	"wallet_address" text NOT NULL,
	"joined_at" timestamp DEFAULT now(),
	"contributed_amount" numeric(18, 6) DEFAULT '0',
	"voting_power" numeric(5, 2) DEFAULT '1.0',
	"is_active" boolean DEFAULT true
);
--> statement-breakpoint
CREATE TABLE "investment_groups" (
	"id" text PRIMARY KEY NOT NULL,
	"name" text NOT NULL,
	"description" text,
	"xmtp_group_id" text NOT NULL,
	"created_by" text NOT NULL,
	"created_at" timestamp DEFAULT now(),
	"total_funds" numeric(18, 6) DEFAULT '0',
	"member_count" integer DEFAULT 1,
	CONSTRAINT "investment_groups_xmtp_group_id_unique" UNIQUE("xmtp_group_id")
);
--> statement-breakpoint
CREATE TABLE "proposals" (
	"id" text PRIMARY KEY NOT NULL,
	"group_id" text,
	"title" text NOT NULL,
	"description" text NOT NULL,
	"strategy" text NOT NULL,
	"requested_amount" numeric(18, 6) NOT NULL,
	"proposed_by" text NOT NULL,
	"created_at" timestamp DEFAULT now(),
	"deadline" timestamp NOT NULL,
	"status" text DEFAULT 'active',
	"approval_votes" integer DEFAULT 0,
	"rejection_votes" integer DEFAULT 0,
	"required_votes" integer NOT NULL
);
--> statement-breakpoint
CREATE TABLE "votes" (
	"id" text PRIMARY KEY NOT NULL,
	"proposal_id" text,
	"voter_address" text NOT NULL,
	"vote" text NOT NULL,
	"voting_power" numeric(5, 2) DEFAULT '1.0',
	"voted_at" timestamp DEFAULT now()
);
--> statement-breakpoint
ALTER TABLE "group_members" ADD CONSTRAINT "group_members_group_id_investment_groups_id_fk" FOREIGN KEY ("group_id") REFERENCES "public"."investment_groups"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "proposals" ADD CONSTRAINT "proposals_group_id_investment_groups_id_fk" FOREIGN KEY ("group_id") REFERENCES "public"."investment_groups"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "votes" ADD CONSTRAINT "votes_proposal_id_proposals_id_fk" FOREIGN KEY ("proposal_id") REFERENCES "public"."proposals"("id") ON DELETE no action ON UPDATE no action;