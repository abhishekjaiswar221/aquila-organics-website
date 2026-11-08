export interface EmailItem {
  name: string;
  quantity: string;
  unit: string;
}

export interface AcknowledgementInput {
  reference: string;
  fullName: string;
  items: EmailItem[];
}

export interface InternalNotificationInput extends AcknowledgementInput {
  company?: string;
  email?: string;
  phone?: string;
  country?: string;
  businessSegment?: string;
  application?: string;
  notes?: string;
  attachmentNames?: string[];
}

export interface RenderedEmail {
  subject: string;
  html: string;
  text: string;
}

export function escapeHtml(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

// Header values must be single-line; CR/LF would allow header injection.
const LINE_BREAKS = new RegExp("[\r\n\u2028\u2029]+", "g");
function oneLine(value: string): string {
  return value.replace(LINE_BREAKS, " ").trim();
}

const h = escapeHtml;

function htmlItems(items: EmailItem[]): string {
  const rows = items
    .map((i) => `<li>${h(i.name)} &mdash; ${h(i.quantity)} ${h(i.unit)}</li>`)
    .join("");
  return `<ul>${rows}</ul>`;
}

function textItems(items: EmailItem[]): string {
  return items.map((i) => `- ${i.name}: ${i.quantity} ${i.unit}`).join("\n");
}

function wrapHtml(body: string): string {
  return `<!doctype html><html><body style="font-family:sans-serif;line-height:1.5">${body}</body></html>`;
}

export function acknowledgementEmail(e: AcknowledgementInput): RenderedEmail {
  const subject = oneLine(`We received your enquiry ${e.reference}`);
  const html = wrapHtml(
    `<p>Dear ${h(e.fullName)},</p>` +
      `<p>Thank you for your enquiry. Your reference is <strong>${h(e.reference)}</strong>.</p>` +
      `<p>Requested products:</p>${htmlItems(e.items)}` +
      `<p>Our team will review your request and reply shortly.</p>` +
      `<p>Aquila Organics</p>`,
  );
  const text =
    `Dear ${e.fullName},\n\n` +
    `Thank you for your enquiry. Your reference is ${e.reference}.\n\n` +
    `Requested products:\n${textItems(e.items)}\n\n` +
    `Our team will review your request and reply shortly.\n\nAquila Organics\n`;
  return { subject, html, text };
}

export function internalNotificationEmail(e: InternalNotificationInput): RenderedEmail {
  const subject = oneLine(`New enquiry ${e.reference} from ${e.fullName}`);
  const details: [string, string | undefined][] = [
    ["Name", e.fullName],
    ["Company", e.company],
    ["Email", e.email],
    ["Phone", e.phone],
    ["Country", e.country],
    ["Business segment", e.businessSegment],
    ["Application", e.application],
    ["Notes", e.notes],
    ["Attachments", e.attachmentNames?.length ? e.attachmentNames.join(", ") : undefined],
  ];
  const present = details.filter((d): d is [string, string] => Boolean(d[1]));
  const htmlDetails = present
    .map(([k, v]) => `<tr><th align="left">${h(k)}</th><td style="white-space:pre-wrap">${h(v)}</td></tr>`)
    .join("");
  const html = wrapHtml(
    `<p>New enquiry <strong>${h(e.reference)}</strong>.</p>` +
      `<table>${htmlDetails}</table>` +
      `<p>Requested products:</p>${htmlItems(e.items)}`,
  );
  const text =
    `New enquiry ${e.reference}\n\n` +
    present.map(([k, v]) => `${k}: ${v}`).join("\n") +
    `\n\nRequested products:\n${textItems(e.items)}\n`;
  return { subject, html, text };
}
