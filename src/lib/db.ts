import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient } from "@/generated/prisma/client";
import { env } from "@/lib/env";

const globalForDb = globalThis as unknown as { db?: PrismaClient };

function createClient() {
  const adapter = new PrismaPg({ connectionString: env.DATABASE_URL });
  return new PrismaClient({ adapter });
}

let client: PrismaClient | undefined;
function getClient(): PrismaClient {
  if (!client) {
    // Singleton survives Next.js dev hot reloads.
    client = globalForDb.db ?? createClient();
    if (process.env.NODE_ENV !== "production") globalForDb.db = client;
  }
  return client;
}

// Created on first use, like `env`, so importing this module (e.g. while
// `next build` collects route config) never reads the environment.
export const db: PrismaClient = new Proxy({} as PrismaClient, {
  get(_target, prop) {
    const real = getClient();
    const value: unknown = Reflect.get(real, prop, real);
    return typeof value === "function" ? value.bind(real) : value;
  },
  has(_target, prop) {
    return prop in getClient();
  },
});
