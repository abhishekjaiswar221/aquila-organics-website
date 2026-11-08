import { env } from "@/lib/env";
import { LocalStorage } from "./local";
import type { StorageProvider } from "./types";

export type { StorageProvider } from "./types";

let instance: StorageProvider | undefined;

export function getStorage(): StorageProvider {
  if (instance) return instance;
  switch (env.STORAGE_DRIVER) {
    case "local":
      instance = new LocalStorage();
      return instance;
    default:
      throw new Error("Unsupported STORAGE_DRIVER");
  }
}
