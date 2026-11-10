export type ContentStatus =
  | "verified"
  | "brief-supplied"
  | "needs-client-confirmation"
  | "hidden";

export interface Block<T> {
  id: string;
  status: ContentStatus;
  data: T;
}

export interface Address {
  label: string;
  lines: string[];
}

/** A renderable section of a content page. Templates render only sections that exist. */
export type PageSection =
  | { kind: "paragraphs"; heading?: string; paragraphs: string[] }
  | { kind: "list"; heading: string; items: string[] }
  | { kind: "quote"; eyebrow?: string; text: string };

export interface ApplicationRecord {
  slug: string;
  name: string;
  summary: string;
  /** Optional extra sections (only the Incense and Bakhoor page has any today). */
  blocks: Block<PageSection>[];
}

export interface SegmentRecord {
  id: "fragrances" | "flavours";
  name: string;
  path: string;
  lead: Block<string>;
  applications: ApplicationRecord[];
  /** Segment-level notes that are not tied to one application. */
  extras: Block<PageSection>[];
}

/** Dates are ISO `YYYY-MM-DD`. `status` must be `verified` before an entry can count as active. */
export interface CertificateRecord {
  id: string;
  title: string;
  issuer: string | null;
  issuedOn: string | null;
  expiresOn: string | null;
  scope: string | null;
  documentPath: string | null;
  status: ContentStatus;
}

export interface NavItem {
  label: string;
  href: string;
  /** Only pages that exist may be linked. Unbuilt pages stay unavailable. */
  available: boolean;
  children?: NavItem[];
}
