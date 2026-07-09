import { config } from "dotenv";
import { defineConfig } from "drizzle-kit";

// Scripts fuera de Next (drizzle-kit, seed) necesitan cargar el env a mano.
config({ path: ".env.local" });
config();

export default defineConfig({
  schema: "./src/server/db/schema.ts",
  out: "./drizzle",
  dialect: "postgresql",
  casing: "snake_case",
  dbCredentials: {
    url: process.env.DATABASE_URL ?? "",
  },
});
