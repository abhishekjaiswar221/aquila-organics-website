// Clearly fake e2e fixtures. Seeded into the TEST database only, by
// tests/e2e/support/seed.ts. Never part of any production seed.

const id = (n: number) => `e2e00000-0000-4000-8000-${n.toString(16).padStart(12, "0")}`;

export const CATEGORY = {
  solvents: { id: id(0x100), slug: "test-solvents", name: "TEST-Solvents" },
  fixtures: { id: id(0x101), slug: "test-fixtures", name: "TEST-Fixtures" },
} as const;

/** Full product: description, specifications, applications and a document. */
export const ETHANOL = {
  id: id(1),
  slug: "test-ethanol",
  name: "TEST-Ethanol",
  code: "TEST-ETH-001",
  cas: "64-17-5",
  description: "A clearly fake e2e fixture used to exercise the product page.",
  specifications: [
    // \u{2265} is the "greater than or equal to" sign.
    { label: "TEST-Purity", value: "\u{2265} 99.5 %" },
    { label: "TEST-Appearance", value: "Clear liquid" },
  ],
  applications: ["TEST-Application Alpha", "TEST-Application Beta"],
  document: {
    id: id(0x201),
    title: "TEST-Ethanol datasheet",
    storageKey: "e2e-test-ethanol-datasheet",
    mimeType: "application/pdf",
    body: "%PDF-1.4\n% TEST fixture, not a real datasheet\n%%EOF\n",
  },
} as const;

export const WATER = {
  id: id(2),
  slug: "test-water",
  name: "TEST-Water",
  code: "TEST-H2O-002",
  cas: "7732-18-5",
} as const;

/** Nothing but a name (and the slug every product needs). */
export const MINIMAL = { id: id(3), slug: "test-minimal", name: "TEST-Minimal" } as const;

export const DRAFT = {
  id: id(4),
  slug: "test-draft-compound",
  name: "TEST-Draft Compound",
  code: "TEST-DRAFT-004",
  cas: "50-00-0",
  document: {
    id: id(0x204),
    title: "TEST-Draft datasheet",
    storageKey: "e2e-test-draft-datasheet",
    mimeType: "application/pdf",
    body: "%PDF-1.4\n% TEST draft fixture\n%%EOF\n",
  },
} as const;

export const ARCHIVED = {
  id: id(5),
  slug: "test-archived-compound",
  name: "TEST-Archived Compound",
  code: "TEST-ARCH-005",
  cas: "67-56-1",
} as const;

/** Bulk published rows so the list has more than one page (page size 24). */
export const BULK = Array.from({ length: 30 }, (_, i) => {
  const n = String(i + 1).padStart(2, "0");
  return { id: id(0x1000 + i), slug: `test-fixture-${n}`, name: `TEST-Fixture ${n}`, code: `TEST-FX-${n}` };
});

export const PUBLISHED_COUNT = 3 + BULK.length;

/** Internal provenance note on every fixture; must never reach a page. */
export const SOURCE_NOTE = "TEST-internal-source-note";

/** Fake admin accounts with known test passwords (TEST database only). */
export const ADMIN_USERS = {
  superAdmin: {
    id: id(0x301),
    email: "test-super-admin@admin.example.test",
    password: "TEST-super-admin-passphrase",
    role: "SUPER_ADMIN",
    roleLabel: "Super admin",
  },
  salesManager: {
    id: id(0x302),
    email: "test-sales-manager@admin.example.test",
    password: "TEST-sales-manager-passphrase",
    role: "SALES_MANAGER",
    roleLabel: "Sales manager",
  },
  contentEditor: {
    id: id(0x303),
    email: "test-content-editor@admin.example.test",
    password: "TEST-content-editor-passphrase",
    role: "CONTENT_EDITOR",
    roleLabel: "Content editor",
  },
} as const;

export type AdminUser = (typeof ADMIN_USERS)[keyof typeof ADMIN_USERS];
