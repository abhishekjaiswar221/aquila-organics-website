import { env } from "@/lib/env";
import { DevEmailProvider } from "./dev";
import type { EmailProvider } from "./types";

export type { EmailMessage, EmailProvider } from "./types";

let instance: EmailProvider | undefined;

export function getEmailProvider(): EmailProvider {
  if (instance) return instance;
  switch (env.EMAIL_DRIVER) {
    case "dev":
      instance = new DevEmailProvider();
      return instance;
    default:
      throw new Error("Unsupported EMAIL_DRIVER");
  }
}
