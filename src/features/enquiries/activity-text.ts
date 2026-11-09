import { STATUS_LABELS, isEnquiryStatus } from "./status";

const MAX_FALLBACK = 80;

function field(detail: unknown, key: string): unknown {
  if (!detail || typeof detail !== "object" || Array.isArray(detail)) return undefined;
  return (detail as Record<string, unknown>)[key];
}

function count(detail: unknown, key: string): number | null {
  const value = field(detail, key);
  return typeof value === "number" && Number.isInteger(value) && value >= 0 ? value : null;
}

function plural(n: number, one: string, many: string): string {
  return `${n} ${n === 1 ? one : many}`;
}

/**
 * Friendly text for an enquiry activity row. Only known fields are read, and
 * only counts and enum values are rendered: free text in `detail` (provider
 * error messages, which can contain addresses) never reaches the page. Unknown
 * actions show their (trimmed) action key.
 */
export function describeActivity(
  action: string,
  detail: unknown,
  attachmentNames: ReadonlyMap<string, string> = new Map(),
): string {
  switch (action) {
    case "enquiry.created": {
      const items = count(detail, "items");
      const attachments = count(detail, "attachments");
      if (items === null) return "Enquiry received.";
      const files = attachments ? plural(attachments, "attachment", "attachments") : "no attachments";
      return `Enquiry received through the website form: ${plural(items, "product line", "product lines")}, ${files}.`;
    }
    case "email.sent": {
      if (field(detail, "kind") === "acknowledgement") return "Acknowledgement email sent to the buyer.";
      const recipients = count(detail, "recipients");
      return recipients === null
        ? "Internal notification sent."
        : `Internal notification sent to ${plural(recipients, "recipient", "recipients")}.`;
    }
    case "email.failed":
      return field(detail, "kind") === "acknowledgement"
        ? "Acknowledgement email could not be sent."
        : "Internal notification could not be sent.";
    case "email.skipped":
      return field(detail, "reason") === "recipient limit"
        ? "Acknowledgement email not sent: this address has reached its daily limit."
        : "Acknowledgement email not sent.";
    case "notification.skipped":
      return "Internal notification skipped: no recipients are configured.";
    case "status.changed": {
      const from = field(detail, "from");
      const to = field(detail, "to");
      if (!isEnquiryStatus(to)) return "Status changed.";
      if (!isEnquiryStatus(from)) return `Status changed to ${STATUS_LABELS[to]}.`;
      return `Status changed from ${STATUS_LABELS[from]} to ${STATUS_LABELS[to]}.`;
    }
    case "attachment.downloaded": {
      const id = field(detail, "attachmentId");
      const name = typeof id === "string" ? attachmentNames.get(id) : undefined;
      return name ? `Attachment downloaded: ${name}.` : "Attachment downloaded.";
    }
    default:
      return action.slice(0, MAX_FALLBACK);
  }
}
