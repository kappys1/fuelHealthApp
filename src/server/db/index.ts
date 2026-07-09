import { neon } from "@neondatabase/serverless";
import { drizzle } from "drizzle-orm/neon-http";
import * as schema from "./schema";

// Cliente Drizzle sobre Neon (neon-http). En Next el env ya está cargado.
const sql = neon(process.env.DATABASE_URL!);

export const db = drizzle({ client: sql, schema, casing: "snake_case" });

export * as schema from "./schema";
