import "server-only";
import type { Prisma } from "@/generated/prisma/client";
import type { EnquiryStatus, EnquiryType, Unit } from "@/generated/prisma/enums";
import { parseRecipients, recipientsKey } from "@/features/enquiries/recipients";
import { ENQUIRY_TYPES, isEnquiryStatus } from "@/features/enquiries/status";
import { db } from "@/lib/db";
import { normalizeUuid } from "@/lib/uuid";

/*
 * Admin-only enquiry queries. Callers authorise first with requireRole().
 * Internal fields (ipHash, userAgent) are never selected, and storage keys
 * leave this module only through getAttachmentFile(), for the download route.
 */

export const ENQUIRY_PAGE_SIZE = 25;
const MAX_QUERY = 100;

export type EnquiryFilter = { status?: EnquiryStatus; q?: string; page?: number };

export type EnquiryListItem = {
  id: string;
  reference: string;
  type: EnquiryType;
  status: EnquiryStatus;
  fullName: string;
  companyName: string | null;
  email: string;
  country: string | null;
  createdAt: Date;
  itemCount: number;
  attachmentCount: number;
};

export type EnquiryList = { items: EnquiryListItem[]; total: number; page: number; pageCount: number };

export type EnquiryDetail = {
  id: string;
  reference: string;
  type: EnquiryType;
  status: EnquiryStatus;
  fullName: string;
  companyName: string | null;
  email: string;
  phone: string | null;
  country: string | null;
  businessSegment: string | null;
  intendedApplication: string | null;
  additionalRequirements: string | null;
  consentAt: Date;
  createdAt: Date;
  items: {
    id: string;
    productId: string | null;
    productNameSnapshot: string;
    casSnapshot: string | null;
    quantity: string;
    unit: Unit;
    notes: string | null;
  }[];
  attachments: { id: string; filename: string; mimeType: string; sizeBytes: number; createdAt: Date }[];
  activities: { id: string; action: string; detail: Prisma.JsonValue; actorId: string | null; createdAt: Date }[];
};

const stripNul = (s: string) => s.replace(/\u0000/g, "");
const escapeLike = (s: string) => s.replace(/[\\%_]/g, (c) => `\\${c}`);

function searchWhere(q: string | undefined): Prisma.EnquiryWhereInput {
  const text = stripNul(q ?? "").trim().slice(0, MAX_QUERY);
  if (!text) return {};
  const contains = { contains: escapeLike(text), mode: "insensitive" as const };
  return {
    OR: [{ reference: contains }, { fullName: contains }, { companyName: contains }, { email: contains }],
  };
}

function normalizePage(page: number | undefined): number {
  if (typeof page !== "number" || !Number.isFinite(page)) return 1;
  return Math.min(1_000_000, Math.max(1, Math.floor(page)));
}

export async function listEnquiries(filter: EnquiryFilter): Promise<EnquiryList> {
  const page = normalizePage(filter.page);
  const where: Prisma.EnquiryWhereInput = {
    AND: [searchWhere(filter.q), isEnquiryStatus(filter.status) ? { status: filter.status } : {}],
  };
  const [total, rows] = await Promise.all([
    db.enquiry.count({ where }),
    db.enquiry.findMany({
      where,
      select: {
        id: true,
        reference: true,
        type: true,
        status: true,
        fullName: true,
        companyName: true,
        email: true,
        country: true,
        createdAt: true,
        _count: { select: { items: true, attachments: true } },
      },
      orderBy: [{ createdAt: "desc" }, { reference: "desc" }],
      skip: (page - 1) * ENQUIRY_PAGE_SIZE,
      take: ENQUIRY_PAGE_SIZE,
    }),
  ]);
  return {
    items: rows.map(({ _count, ...row }) => ({ ...row, itemCount: _count.items, attachmentCount: _count.attachments })),
    total,
    page,
    pageCount: Math.max(1, Math.ceil(total / ENQUIRY_PAGE_SIZE)),
  };
}

export async function getEnquiry(id: string): Promise<EnquiryDetail | null> {
  const enquiryId = normalizeUuid(id);
  if (!enquiryId) return null;
  const row = await db.enquiry.findUnique({
    where: { id: enquiryId },
    select: {
      id: true,
      reference: true,
      type: true,
      status: true,
      fullName: true,
      companyName: true,
      email: true,
      phone: true,
      country: true,
      businessSegment: true,
      intendedApplication: true,
      additionalRequirements: true,
      consentAt: true,
      createdAt: true,
      items: {
        select: {
          id: true,
          productId: true,
          productNameSnapshot: true,
          casSnapshot: true,
          quantity: true,
          unit: true,
          notes: true,
        },
        orderBy: [{ createdAt: "asc" }, { id: "asc" }],
      },
      attachments: {
        select: { id: true, filename: true, mimeType: true, sizeBytes: true, createdAt: true },
        orderBy: [{ createdAt: "asc" }, { id: "asc" }],
      },
      activities: {
        select: { id: true, action: true, detail: true, actorId: true, createdAt: true },
        orderBy: [{ createdAt: "asc" }, { id: "asc" }],
      },
    },
  });
  if (!row) return null;
  return { ...row, items: row.items.map((i) => ({ ...i, quantity: i.quantity.toString() })) };
}

export type AttachmentFile = { id: string; enquiryId: string; filename: string; mimeType: string; storageKey: string };

/**
 * SERVER ONLY (attachment download route): an attachment with its storage key.
 * The key opens the stream and must never be sent to a browser.
 */
export async function getAttachmentFile(id: string): Promise<AttachmentFile | null> {
  const attachmentId = normalizeUuid(id);
  if (!attachmentId) return null;
  return db.enquiryAttachment.findUnique({
    where: { id: attachmentId },
    select: { id: true, enquiryId: true, filename: true, mimeType: true, storageKey: true },
  });
}

/** Enquiry types whose notification recipients setting is missing or holds no valid address. */
export async function missingRecipientTypes(): Promise<EnquiryType[]> {
  const settings = await db.siteSetting.findMany({
    where: { key: { in: ENQUIRY_TYPES.map(recipientsKey) } },
    select: { key: true, value: true },
  });
  const byKey = new Map(settings.map((s) => [s.key, s.value]));
  return ENQUIRY_TYPES.filter((type) => parseRecipients(byKey.get(recipientsKey(type))).length === 0);
}
