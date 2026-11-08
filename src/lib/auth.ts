import { betterAuth } from "better-auth";
import { prismaAdapter } from "better-auth/adapters/prisma";
import { nextCookies } from "better-auth/next-js";
import { ROLES } from "@/lib/access";
import { db } from "@/lib/db";
import { env } from "@/lib/env";

export const MIN_PASSWORD_LENGTH = 12;

/** How Better Auth finds the client IP (rate-limit key). */
export type ClientIpConfig = {
  /** Headers to read, in order. Better Auth default: ["x-forwarded-for"]. */
  ipAddressHeaders?: string[];
  /**
   * Proxies that append to x-forwarded-for. With none, a header is trusted
   * only when it holds exactly one address.
   */
  trustedProxies?: string[];
};

function clientIpConfigFromEnv(): ClientIpConfig {
  return {
    ipAddressHeaders: env.AUTH_IP_HEADER ? [env.AUTH_IP_HEADER] : undefined,
    trustedProxies: env.AUTH_TRUSTED_PROXIES?.length ? env.AUTH_TRUSTED_PROXIES : undefined,
  };
}

/**
 * Builds a Better Auth instance. The app uses the lazy `auth` singleton below;
 * tests call this directly to exercise other client-IP settings.
 */
export function createAuth(clientIp: ClientIpConfig = clientIpConfigFromEnv()) {
  return betterAuth({
    appName: "Aquila Organics",
    baseURL: env.BETTER_AUTH_URL,
    secret: env.BETTER_AUTH_SECRET,
    database: prismaAdapter(db, { provider: "postgresql" }),
    emailAndPassword: {
      enabled: true,
      // Admin accounts are created only by `npm run seed:admin`.
      disableSignUp: true,
      minPasswordLength: MIN_PASSWORD_LENGTH,
    },
    // Belt and braces: the sign-up endpoint is not even routed.
    disabledPaths: ["/sign-up/email"],
    user: {
      additionalFields: {
        role: {
          type: [...ROLES],
          required: false,
          defaultValue: "CONTENT_EDITOR",
          // Never accepted from a client (sign-up or update-user).
          input: false,
        },
      },
    },
    rateLimit: {
      // Better Auth only rate limits in production by default; always on here.
      // In-memory store: per server instance.
      enabled: true,
      window: 60,
      max: 100,
      customRules: {
        "/sign-in/email": { window: 60, max: 5 },
      },
    },
    advanced: {
      database: { generateId: "uuid" },
      ipAddress: {
        ...(clientIp.ipAddressHeaders && { ipAddressHeaders: clientIp.ipAddressHeaders }),
        ...(clientIp.trustedProxies && { trustedProxies: clientIp.trustedProxies }),
      },
      // Secure cookies are forced in production; elsewhere they follow the
      // base URL's protocol. Session cookies are always HTTP-only.
      useSecureCookies: process.env.NODE_ENV === "production" ? true : undefined,
      defaultCookieAttributes: { httpOnly: true, sameSite: "lax" },
    },
    // Must stay last: lets server actions set auth cookies.
    plugins: [nextCookies()],
  });
}

export type Auth = ReturnType<typeof createAuth>;
export type AuthSession = Auth["$Infer"]["Session"];

let instance: Auth | undefined;
function getAuth(): Auth {
  instance ??= createAuth();
  return instance;
}

// Built on first use, like `env` and `db`, so importing this module (e.g.
// while `next build` collects route config) never reads the environment.
export const auth: Auth = new Proxy({} as Auth, {
  get(_target, prop) {
    return Reflect.get(getAuth(), prop);
  },
  has(_target, prop) {
    return prop in getAuth();
  },
});
