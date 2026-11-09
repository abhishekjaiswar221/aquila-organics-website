import { z } from "zod";

// Server-only secrets and config. Never expose any of these as NEXT_PUBLIC_*.
export const secretEnvSchema = z.object({
  DATABASE_URL: z.string().min(1),
  BETTER_AUTH_SECRET: z.string().min(32),
  BETTER_AUTH_URL: z.url(),
  STORAGE_DRIVER: z.literal("local"),
  // Optional root directory for the local storage driver (default ./storage/uploads).
  // The e2e suite points it at its own fixture directory.
  STORAGE_LOCAL_ROOT: z.string().trim().min(1).optional(),
  EMAIL_DRIVER: z.literal("dev"),
  RATE_LIMIT_SALT: z.string().min(8),
  ADMIN_EMAIL: z.string().min(1).optional(),
  ADMIN_PASSWORD: z.string().min(1).optional(),
  // Client IP for auth rate limiting (see README "Deployment: reverse proxy").
  // Header the proxy overwrites with the real client IP; default x-forwarded-for.
  AUTH_IP_HEADER: z
    .string()
    .trim()
    .toLowerCase()
    .regex(/^[a-z0-9-]+$/)
    .optional(),
  // Comma-separated proxy IPs/CIDRs that append to x-forwarded-for.
  AUTH_TRUSTED_PROXIES: z
    .string()
    .transform((value) =>
      value
        .split(",")
        .map((entry) => entry.trim())
        .filter(Boolean),
    )
    .pipe(z.array(z.union([z.ipv4(), z.ipv6(), z.cidrv4(), z.cidrv6()])))
    .optional(),
});

export type Env = z.infer<typeof secretEnvSchema>;

export function parseEnv(source: Record<string, string | undefined>): Env {
  const result = secretEnvSchema.safeParse(source);
  if (!result.success) {
    const keys = [...new Set(result.error.issues.map((i) => String(i.path[0])))];
    throw new Error(`Invalid environment: ${keys.join(", ")}`);
  }
  return result.data;
}

// Parsed on first access, so importing this module (tests, build) never throws;
// reading any value on a misconfigured server does.
let cached: Env | undefined;
export const env: Env = new Proxy({} as Env, {
  get(_target, prop) {
    cached ??= parseEnv(process.env);
    return cached[prop as keyof Env];
  },
});
