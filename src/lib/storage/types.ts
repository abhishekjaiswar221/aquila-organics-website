export interface StorageProvider {
  put(key: string, data: Uint8Array, meta: { mimeType: string }): Promise<void>;
  getStream(key: string): Promise<ReadableStream | null>;
  delete(key: string): Promise<void>;
}
