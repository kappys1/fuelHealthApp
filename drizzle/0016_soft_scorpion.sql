CREATE TABLE "flexible_meals" (
	"date" date NOT NULL,
	"meal" "meal" NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "flexible_meals_date_meal_pk" PRIMARY KEY("date","meal"),
	CONSTRAINT "flexible_meals_meal_check" CHECK ("flexible_meals"."meal" <> 'extra')
);
--> statement-breakpoint
ALTER TABLE "flexible_meals" ADD CONSTRAINT "flexible_meals_date_days_date_fk" FOREIGN KEY ("date") REFERENCES "public"."days"("date") ON DELETE cascade ON UPDATE no action;