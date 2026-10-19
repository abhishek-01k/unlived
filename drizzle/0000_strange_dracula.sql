CREATE TABLE "market_signals" (
	"field_id" text PRIMARY KEY NOT NULL,
	"signal" jsonb NOT NULL,
	"fetched_at" timestamp with time zone NOT NULL
);
