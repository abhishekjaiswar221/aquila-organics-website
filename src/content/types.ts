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

export interface NavItem {
  label: string;
  href: string;
  /** Only pages that exist may be linked. Unbuilt pages stay unavailable. */
  available: boolean;
  children?: NavItem[];
}
