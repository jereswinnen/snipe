import { Pool } from "pg";
import { drizzle } from "drizzle-orm/node-postgres";
import { env } from "@/lib/env";
import * as schema from "./schema";

type Db = ReturnType<typeof drizzle<typeof schema>>;
let instance: Db | null = null;

function getDb(): Db {
  if (!instance) {
    const pool = new Pool({ connectionString: env.DATABASE_URL });
    instance = drizzle(pool, { schema });
  }
  return instance;
}

export const db = new Proxy({} as Db, {
  get(_target, prop) {
    const target = getDb() as unknown as Record<PropertyKey, unknown>;
    const value = target[prop];
    return typeof value === "function" ? (value as Function).bind(target) : value;
  },
});

export { schema };
