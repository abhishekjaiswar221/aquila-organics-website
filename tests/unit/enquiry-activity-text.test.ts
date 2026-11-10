import { describe, expect, it } from "vitest";
import { describeActivity } from "@/features/enquiries/activity-text";
import { ENQUIRY_STATUSES, STATUS_LABELS } from "@/features/enquiries/status";

describe("describeActivity", () => {
  it("describes the creation activity with counts only", () => {
    expect(
      describeActivity("enquiry.created", { source: "rfq-form", items: 2, catalogueItems: 1, attachments: 1 }),
    ).toBe("Enquiry received through the website form: 2 product lines, 1 attachment.");
    expect(describeActivity("enquiry.created", { items: 1, attachments: 0 })).toBe(
      "Enquiry received through the website form: 1 product line, no attachments.",
    );
    expect(describeActivity("enquiry.created", null)).toBe("Enquiry received.");
  });

  it("describes a contact form message (no product lines)", () => {
    expect(
      describeActivity("enquiry.created", { source: "contact-form", items: 0, catalogueItems: 0, attachments: 0 }),
    ).toBe("Message received through the contact form, no attachments.");
    expect(
      describeActivity("enquiry.created", { source: "contact-form", items: 0, catalogueItems: 0, attachments: 2 }),
    ).toBe("Message received through the contact form, 2 attachments.");
    expect(describeActivity("enquiry.created", { source: "contact-form" })).toBe(
      "Message received through the contact form.",
    );
  });

  it("describes email activities without echoing provider errors or addresses", () => {
    expect(describeActivity("email.sent", { kind: "acknowledgement", recipients: 1 })).toBe(
      "Acknowledgement email sent to the buyer.",
    );
    expect(describeActivity("email.sent", { kind: "internal", recipients: 3 })).toBe(
      "Internal notification sent to 3 recipients.",
    );
    expect(describeActivity("email.sent", { kind: "internal", recipients: 1 })).toBe(
      "Internal notification sent to 1 recipient.",
    );
    const failed = describeActivity("email.failed", {
      kind: "internal",
      error: "SMTP refused for jane@testfragrance.example",
    });
    expect(failed).toBe("Internal notification could not be sent.");
    expect(failed).not.toContain("jane@");
    expect(describeActivity("email.failed", { kind: "acknowledgement", error: "x" })).toBe(
      "Acknowledgement email could not be sent.",
    );
  });

  it("describes an acknowledgement skipped by the per-recipient limit", () => {
    expect(describeActivity("email.skipped", { reason: "recipient limit" })).toBe(
      "Acknowledgement email not sent: this address has reached its daily limit.",
    );
    expect(describeActivity("email.skipped", null)).toBe("Acknowledgement email not sent.");
  });

  it("describes a skipped notification", () => {
    expect(describeActivity("notification.skipped", { reason: "no recipients configured" })).toBe(
      "Internal notification skipped: no recipients are configured.",
    );
  });

  it("describes status changes with human labels", () => {
    expect(describeActivity("status.changed", { from: "NEW", to: "QUOTATION_SENT" })).toBe(
      "Status changed from New to Quotation sent.",
    );
    // Unknown values are not echoed.
    expect(describeActivity("status.changed", { from: "<b>x</b>", to: "WON" })).toBe("Status changed to Won.");
    expect(describeActivity("status.changed", "nonsense")).toBe("Status changed.");
  });

  it("describes attachment downloads, naming the file only when it is known", () => {
    const names = new Map([["00000000-0000-4000-8000-000000000001", "spec.pdf"]]);
    expect(
      describeActivity("attachment.downloaded", { attachmentId: "00000000-0000-4000-8000-000000000001" }, names),
    ).toBe("Attachment downloaded: spec.pdf.");
    expect(describeActivity("attachment.downloaded", { attachmentId: "other" }, names)).toBe("Attachment downloaded.");
  });

  it("falls back to the action key, trimmed, for anything unknown", () => {
    expect(describeActivity("custom.thing", { secret: "jane@example.test" })).toBe("custom.thing");
    expect(describeActivity("x".repeat(200), null)).toHaveLength(80);
  });
});

describe("status labels", () => {
  it("has a label for every enquiry status, in workflow order", () => {
    expect(ENQUIRY_STATUSES).toEqual([
      "NEW",
      "ASSIGNED",
      "CONTACTED",
      "QUOTATION_SENT",
      "NEGOTIATION",
      "WON",
      "LOST",
    ]);
    for (const s of ENQUIRY_STATUSES) expect(STATUS_LABELS[s]).toMatch(/^[A-Z][a-z ]+$/);
  });
});
