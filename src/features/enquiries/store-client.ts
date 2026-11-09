import { useSyncExternalStore } from "react";
import { z } from "zod";

/**
 * The visitor's enquiry list: product ids only, kept in localStorage. Every
 * storage access is guarded; when storage is missing or throws (private mode,
 * blocked site data, quota) the list lives in memory for the page's lifetime.
 * The ids are only hints: the server re-resolves each one and accepts only
 * published products.
 */

export const ENQUIRY_LIST_KEY = "aquila.enquiry.v1";
/** Dispatched on window after every change in this tab. */
export const ENQUIRY_LIST_EVENT = "aquila:enquiry-list-change";
export const MAX_LIST_ITEMS = 25;

const uuid = z.uuid();

let memory: string[] = [];
let storageFailed = false;

function storage(): Storage | null {
  if (storageFailed || typeof window === "undefined") return null;
  try {
    return window.localStorage ?? null;
  } catch {
    storageFailed = true;
    return null;
  }
}

function sanitise(value: unknown): string[] {
  if (!Array.isArray(value)) return [];
  const seen = new Set<string>();
  for (const entry of value) {
    if (typeof entry !== "string") continue;
    const id = entry.trim().toLowerCase();
    if (!uuid.safeParse(id).success) continue;
    seen.add(id);
    if (seen.size >= MAX_LIST_ITEMS) break;
  }
  return [...seen];
}

function read(): string[] {
  const s = storage();
  if (!s) return [...memory];
  let raw: string | null;
  try {
    raw = s.getItem(ENQUIRY_LIST_KEY);
  } catch {
    storageFailed = true;
    return [...memory];
  }
  if (raw === null) return [];
  try {
    return sanitise(JSON.parse(raw));
  } catch {
    return [];
  }
}

function write(list: string[]): void {
  memory = [...list];
  const s = storage();
  if (s) {
    try {
      s.setItem(ENQUIRY_LIST_KEY, JSON.stringify(list));
    } catch {
      // From now on memory is the source of truth for this page.
      storageFailed = true;
    }
  }
  if (typeof window !== "undefined") {
    try {
      window.dispatchEvent(new Event(ENQUIRY_LIST_EVENT));
    } catch {
      // Never let a notification failure break the caller.
    }
  }
}

export function getList(): string[] {
  return read();
}

export function addProduct(id: string): void {
  const normalised = typeof id === "string" ? id.trim().toLowerCase() : "";
  if (!uuid.safeParse(normalised).success) return;
  const list = read();
  if (list.includes(normalised) || list.length >= MAX_LIST_ITEMS) return;
  write([...list, normalised]);
}

export function removeProduct(id: string): void {
  const normalised = typeof id === "string" ? id.trim().toLowerCase() : "";
  const list = read();
  if (!list.includes(normalised)) return;
  write(list.filter((x) => x !== normalised));
}

export function clearList(): void {
  write([]);
}

/** Calls `listener` when the list changes here or in another tab. */
export function subscribe(listener: () => void): () => void {
  if (typeof window === "undefined") return () => {};
  const onStorage = (event: StorageEvent) => {
    if (event.key === null || event.key === ENQUIRY_LIST_KEY) listener();
  };
  window.addEventListener(ENQUIRY_LIST_EVENT, listener);
  window.addEventListener("storage", onStorage);
  return () => {
    window.removeEventListener(ENQUIRY_LIST_EVENT, listener);
    window.removeEventListener("storage", onStorage);
  };
}

// useSyncExternalStore needs a stable snapshot between changes.
let snapshot: string[] = [];
let snapshotKey = "[]";
function getSnapshot(): string[] {
  const list = read();
  const key = JSON.stringify(list);
  if (key !== snapshotKey) {
    snapshot = list;
    snapshotKey = key;
  }
  return snapshot;
}
const EMPTY: string[] = [];
const getServerSnapshot = () => EMPTY;

/** React hook: the current list (empty during server rendering). Do not mutate. */
export function useEnquiryList(): readonly string[] {
  return useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot);
}

/** Test helper: forget the in-memory fallback and retry real storage. */
export function resetMemoryForTests(): void {
  memory = [];
  storageFailed = false;
  snapshot = [];
  snapshotKey = "[]";
}
