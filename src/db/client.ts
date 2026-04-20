import { neon } from "@neondatabase/serverless";
import { drizzle } from "drizzle-orm/neon-http";

import { ensureDatabaseReady } from "@/db/init";
import * as schema from "@/db/schema";

export async function getDb() {
  const databaseUrl = process.env.DATABASE_URL;

  if (!databaseUrl) {
    throw new Error("DATABASE_URL is required. Configure Neon Postgres before using the app.");
  }

  await ensureDatabaseReady();

  return drizzle(neon(databaseUrl), { schema });
}
