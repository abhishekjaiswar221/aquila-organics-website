import { S3Client } from "@aws-sdk/client-s3";
import { env } from "@/lib/env";
import { LocalStorage } from "./local";
import { R2Storage } from "./r2";
import type { StorageProvider } from "./types";

export type { StorageProvider } from "./types";

let instance: StorageProvider | undefined;

export function getStorage(): StorageProvider {
  if (instance) return instance;
  switch (env.STORAGE_DRIVER) {
    case "local":
      instance = new LocalStorage(env.STORAGE_LOCAL_ROOT);
      return instance;
    case "r2": {
      // env.ts guarantees the four R2 variables when the driver is "r2".
      const client = new S3Client({
        region: "auto",
        endpoint: `https://${env.R2_ACCOUNT_ID}.r2.cloudflarestorage.com`,
        credentials: { accessKeyId: env.R2_ACCESS_KEY_ID!, secretAccessKey: env.R2_SECRET_ACCESS_KEY! },
      });
      instance = new R2Storage({ client, bucket: env.R2_BUCKET! });
      return instance;
    }
    default:
      throw new Error("Unsupported STORAGE_DRIVER");
  }
}
