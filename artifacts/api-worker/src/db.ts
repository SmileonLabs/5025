import { drizzle, type PostgresJsDatabase } from "drizzle-orm/postgres-js";
import postgres from "postgres";
import * as schema from "@workspace/db/schema";

export type WorkerDb = PostgresJsDatabase<typeof schema>;

const clients = new Map<string, ReturnType<typeof postgres>>();

export function getDatabase(env: Env): WorkerDb {
  const connectionString = env.HYPERDRIVE?.connectionString ?? env.DATABASE_URL;
  if (!connectionString) {
    throw new Error("HYPERDRIVE or DATABASE_URL must be configured.");
  }

  let client = clients.get(connectionString);
  if (!client) {
    client = postgres(connectionString, {
      prepare: false,
      max: 5,
    });
    clients.set(connectionString, client);
  }

  return drizzle(client, { schema });
}

export * from "@workspace/db/schema";
