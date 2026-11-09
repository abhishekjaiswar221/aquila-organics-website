import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  addProduct,
  clearList,
  ENQUIRY_LIST_EVENT,
  ENQUIRY_LIST_KEY,
  getList,
  MAX_LIST_ITEMS,
  removeProduct,
  resetMemoryForTests,
  subscribe,
} from "@/features/enquiries/store-client";

const id = (n: number) => `00000000-0000-4000-8000-${n.toString().padStart(12, "0")}`;
const A = id(1);
const B = id(2);

beforeEach(() => {
  window.localStorage.clear();
  resetMemoryForTests();
});

afterEach(() => {
  vi.restoreAllMocks();
});

describe("enquiry list store", () => {
  it("starts empty, adds, dedupes, removes and clears", () => {
    expect(getList()).toEqual([]);
    addProduct(A);
    addProduct(B);
    addProduct(A);
    addProduct(A.toUpperCase());
    expect(getList()).toEqual([A, B]);
    removeProduct(A);
    expect(getList()).toEqual([B]);
    removeProduct(id(99));
    expect(getList()).toEqual([B]);
    clearList();
    expect(getList()).toEqual([]);
  });

  it("persists as a JSON array of ids under a namespaced key", () => {
    addProduct(A);
    expect(JSON.parse(window.localStorage.getItem(ENQUIRY_LIST_KEY) ?? "null")).toEqual([A]);
  });

  it("caps the list at 25 entries", () => {
    for (let i = 1; i <= MAX_LIST_ITEMS + 5; i++) addProduct(id(i));
    const list = getList();
    expect(list).toHaveLength(MAX_LIST_ITEMS);
    expect(list[0]).toBe(id(1));
    expect(list).not.toContain(id(MAX_LIST_ITEMS + 1));
  });

  it("ignores ids that are not uuids", () => {
    addProduct("not-a-uuid");
    addProduct("");
    addProduct("<script>");
    expect(getList()).toEqual([]);
  });

  it("discards junk JSON and non-uuid entries found in storage", () => {
    window.localStorage.setItem(ENQUIRY_LIST_KEY, "{not json");
    expect(getList()).toEqual([]);
    window.localStorage.setItem(ENQUIRY_LIST_KEY, JSON.stringify({ a: 1 }));
    expect(getList()).toEqual([]);
    window.localStorage.setItem(ENQUIRY_LIST_KEY, JSON.stringify([A, 42, null, "junk", A, { id: B }, B]));
    expect(getList()).toEqual([A, B]);
    const tooMany = Array.from({ length: 40 }, (_, i) => id(i + 1));
    window.localStorage.setItem(ENQUIRY_LIST_KEY, JSON.stringify(tooMany));
    expect(getList()).toHaveLength(MAX_LIST_ITEMS);
  });

  it("survives localStorage.getItem throwing (falls back to memory)", () => {
    vi.spyOn(Storage.prototype, "getItem").mockImplementation(() => {
      throw new DOMException("blocked", "SecurityError");
    });
    expect(() => getList()).not.toThrow();
    expect(getList()).toEqual([]);
    addProduct(A);
    expect(getList()).toEqual([A]);
  });

  it("survives localStorage.setItem throwing (private mode / quota)", () => {
    vi.spyOn(Storage.prototype, "setItem").mockImplementation(() => {
      throw new DOMException("quota", "QuotaExceededError");
    });
    expect(() => addProduct(A)).not.toThrow();
    expect(() => addProduct(B)).not.toThrow();
    expect(getList()).toEqual([A, B]);
    expect(() => removeProduct(A)).not.toThrow();
    expect(getList()).toEqual([B]);
    expect(() => clearList()).not.toThrow();
    expect(getList()).toEqual([]);
  });

  it("survives the localStorage getter itself throwing", () => {
    vi.spyOn(window, "localStorage", "get").mockImplementation(() => {
      throw new DOMException("denied", "SecurityError");
    });
    expect(() => addProduct(A)).not.toThrow();
    expect(getList()).toEqual([A]);
  });

  it("returns a copy, not the internal list", () => {
    addProduct(A);
    const list = getList();
    list.push(B);
    expect(getList()).toEqual([A]);
  });

  it("notifies subscribers on change and stops after unsubscribe", () => {
    const listener = vi.fn();
    const onEvent = vi.fn();
    window.addEventListener(ENQUIRY_LIST_EVENT, onEvent);
    const unsubscribe = subscribe(listener);
    addProduct(A);
    expect(listener).toHaveBeenCalledTimes(1);
    expect(onEvent).toHaveBeenCalledTimes(1);
    // Another tab writing the key also notifies.
    window.dispatchEvent(new StorageEvent("storage", { key: ENQUIRY_LIST_KEY }));
    expect(listener).toHaveBeenCalledTimes(2);
    window.dispatchEvent(new StorageEvent("storage", { key: "unrelated" }));
    expect(listener).toHaveBeenCalledTimes(2);
    unsubscribe();
    removeProduct(A);
    expect(listener).toHaveBeenCalledTimes(2);
    window.removeEventListener(ENQUIRY_LIST_EVENT, onEvent);
  });
});
