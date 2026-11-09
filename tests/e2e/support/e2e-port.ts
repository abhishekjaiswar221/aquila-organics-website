// Port for the e2e build (`next start`). Pure, so it is unit tested
// (tests/unit/e2e-port.test.ts). Same precedence as every other e2e variable:
// the shell environment first, then .env, then the default.

export const DEFAULT_E2E_PORT = 3100;

type Env = Record<string, string | undefined>;

export function resolveE2ePort(shellEnv: Env, fileEnv: Env): number {
  const pick = (env: Env) => {
    const value = env.E2E_PORT?.trim();
    return value ? value : undefined;
  };
  const value = pick(shellEnv) ?? pick(fileEnv);
  if (value === undefined) return DEFAULT_E2E_PORT;
  const port = /^\d+$/.test(value) ? Number(value) : NaN;
  if (!Number.isInteger(port) || port < 1 || port > 65535) {
    throw new Error(`E2E_PORT must be an integer from 1 to 65535, got "${value}".`);
  }
  return port;
}
