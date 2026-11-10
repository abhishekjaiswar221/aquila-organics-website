export interface EmailItem {
  name: string;
  quantity: string;
  unit: string;
  notes?: string;
}

/**
 * The acknowledgement goes to whatever address the visitor typed, so it is
 * kept minimal: it must not become a way to deliver someone else's text to a
 * third party. Only a constant greeting, the reference and the number of
 * product lines; nothing the visitor typed (not even their name: a "name"
 * can be a phishing line, and mail clients autolink domains). The internal
 * notification carries the full details.
 */
export interface AcknowledgementInput {
  reference: string;
  lineCount: number;
}

export interface InternalNotificationInput {
  reference: string;
  fullName: string;
  items: EmailItem[];
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
const LINE_BREAKS = new RegExp("[\u0000\n\v\f\r\u0085\u2028\u2029]+", "g");
function oneLine(value: string): string {
  return value.replace(LINE_BREAKS, " ").trim();
}

const ACK_GREETING = "Dear customer,";

const h = escapeHtml;

function itemLine(i: EmailItem): string {
  return `${i.name}: ${i.quantity} ${i.unit}${i.notes ? ` (${i.notes})` : ""}`;
}

function htmlItems(items: EmailItem[]): string {
  const rows = items
    .map(
      (i) =>
        `<li>${h(i.name)} &mdash; ${h(i.quantity)} ${h(i.unit)}` +
        `${i.notes ? ` <span style="white-space:pre-wrap">(${h(i.notes)})</span>` : ""}</li>`,
    )
    .join("");
  return `<ul>${rows}</ul>`;
}

function textItems(items: EmailItem[]): string {
  return items.map((i) => `- ${itemLine(i)}`).join("\n");
}

function wrapHtml(body: string): string {
  return `<!doctype html><html><body style="font-family:sans-serif;line-height:1.5">${body}</body></html>`;
}

function productLines(n: number): string {
  return `${n} product ${n === 1 ? "line" : "lines"}`;
}

export function acknowledgementEmail(e: AcknowledgementInput): RenderedEmail {
  const lines = productLines(e.lineCount);
  const subject = oneLine(`We received your enquiry ${e.reference}`);
  const html = wrapHtml(
    `<p>${h(ACK_GREETING)}</p>` +
      `<p>Thank you for your enquiry. Your reference is <strong>${h(e.reference)}</strong>.</p>` +
      `<p>We have received your request for ${h(lines)}.</p>` +
      `<p>Our team will review your request and reply shortly. Please quote the reference in any correspondence.</p>` +
      `<p>Aquila Organics</p>`,
  );
  const text =
    `${ACK_GREETING}\n\n` +
    `Thank you for your enquiry. Your reference is ${e.reference}.\n\n` +
    `We have received your request for ${lines}.\n\n` +
    `Our team will review your request and reply shortly. Please quote the reference in any correspondence.\n\n` +
    `Aquila Organics\n`;
  return { subject, html, text };
}

type Details = [string, string | undefined][];

/** The labelled details table (empty values left out), as HTML rows and text lines. */
function renderDetails(details: Details): { html: string; text: string } {
  const present = details.filter((d): d is [string, string] => Boolean(d[1]));
  return {
    html: present
      .map(([k, v]) => `<tr><th align="left">${h(k)}</th><td style="white-space:pre-wrap">${h(v)}</td></tr>`)
      .join(""),
    text: present.map(([k, v]) => `${k}: ${v}`).join("\n"),
  };
}

function attachmentList(names: string[] | undefined): string | undefined {
  return names?.length ? names.join(", ") : undefined;
}

export function internalNotificationEmail(e: InternalNotificationInput): RenderedEmail {
  const subject = oneLine(`New enquiry ${e.reference} from ${e.fullName}`);
  const details = renderDetails([
    ["Name", e.fullName],
    ["Company", e.company],
    ["Email", e.email],
    ["Phone", e.phone],
    ["Country", e.country],
    ["Business segment", e.businessSegment],
    ["Application", e.application],
    ["Notes", e.notes],
    ["Attachments", attachmentList(e.attachmentNames)],
  ]);
  const html = wrapHtml(
    `<p>New enquiry <strong>${h(e.reference)}</strong>.</p>` +
      `<table>${details.html}</table>` +
      `<p>Requested products:</p>${htmlItems(e.items)}`,
  );
  const text =
    `New enquiry ${e.reference}\n\n` +
    details.text +
    `\n\nRequested products:\n${textItems(e.items)}\n`;
  return { subject, html, text };
}

/**
 * Acknowledgement for a Contact form message. Same rule as
 * acknowledgementEmail: a constant greeting, the reference and constant
 * sentences only; the message itself is never echoed.
 */
export interface MessageAcknowledgementInput {
  reference: string;
}

export function messageAcknowledgementEmail(e: MessageAcknowledgementInput): RenderedEmail {
  const subject = oneLine(`We received your message ${e.reference}`);
  const html = wrapHtml(
    `<p>${h(ACK_GREETING)}</p>` +
      `<p>Thank you for contacting us. Your reference is <strong>${h(e.reference)}</strong>.</p>` +
      `<p>We have received your message.</p>` +
      `<p>Our team will review it and reply shortly. Please quote the reference in any correspondence.</p>` +
      `<p>Aquila Organics</p>`,
  );
  const text =
    `${ACK_GREETING}\n\n` +
    `Thank you for contacting us. Your reference is ${e.reference}.\n\n` +
    `We have received your message.\n\n` +
    `Our team will review it and reply shortly. Please quote the reference in any correspondence.\n\n` +
    `Aquila Organics\n`;
  return { subject, html, text };
}

export interface InternalMessageNotificationInput {
  reference: string;
  /** Human label of the enquiry type, e.g. "Flavours". */
  enquiryType: string;
  fullName: string;
  company?: string;
  email?: string;
  phone?: string;
  country?: string;
  application?: string;
  message: string;
  attachmentNames?: string[];
}

/** Internal notification for a Contact form message; the subject carries no visitor text. */
export function internalMessageNotificationEmail(e: InternalMessageNotificationInput): RenderedEmail {
  const subject = oneLine(`New contact message ${e.reference}`);
  const details = renderDetails([
    ["Enquiry type", e.enquiryType],
    ["Name", e.fullName],
    ["Company", e.company],
    ["Email", e.email],
    ["Phone", e.phone],
    ["Country", e.country],
    ["Application", e.application],
    ["Attachments", attachmentList(e.attachmentNames)],
  ]);
  const html = wrapHtml(
    `<p>New contact message <strong>${h(e.reference)}</strong>.</p>` +
      `<table>${details.html}</table>` +
      `<p>Message:</p><p style="white-space:pre-wrap">${h(e.message)}</p>`,
  );
  const text = `New contact message ${e.reference}\n\n` + details.text + `\n\nMessage:\n${e.message}\n`;
  return { subject, html, text };
}
