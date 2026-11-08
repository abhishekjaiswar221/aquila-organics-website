import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient } from "@/generated/prisma/client";
import { env } from "@/lib/env";

const globalForDb = globalThis as unknown as { db?: PrismaClient };

function createClient() {
  const adapter = new PrismaPg({ connectionString: env.DATABASE_URL });
  return new PrismaClient({ adapter });
}

// Singleton survives Next.js dev hot reloads.
export const db: PrismaClient = globalForDb.db ?? createClient();
if (process.env.NODE_ENV !== "production") globalForDb.db = db;
