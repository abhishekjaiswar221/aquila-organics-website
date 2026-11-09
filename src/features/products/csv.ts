/** Parses RFC 4180-style CSV: quoted fields, escaped quotes, commas/newlines in quotes. */
export function parseCsv(text: string): string[][] {
  const rows: string[][] = [];
  let row: string[] = [];
  let field = "";
  let inQuotes = false;
  const src = text.replace(/^\uFEFF/, "");

  for (let i = 0; i < src.length; i++) {
    const ch = src[i];
    if (inQuotes) {
      if (ch === '"') {
        if (src[i + 1] === '"') {
          field += '"';
          i += 1;
        } else {
          inQuotes = false;
        }
      } else {
        field += ch;
      }
    } else if (ch === '"') {
      inQuotes = true;
    } else if (ch === ",") {
      row.push(field);
      field = "";
    } else if (ch === "\n" || ch === "\r") {
      if (ch === "\r" && src[i + 1] === "\n") i += 1;
      row.push(field);
      field = "";
      rows.push(row);
      row = [];
    } else {
      field += ch;
    }
  }
  if (field !== "" || row.length > 0) {
    row.push(field);
    rows.push(row);
  }
  return rows.filter((r) => r.some((cell) => cell.trim() !== ""));
}

/** Turns CSV text into row objects for importProducts (header row required). */
export function csvToProductRows(text: string): Record<string, unknown>[] {
  const [header, ...body] = parseCsv(text);
  if (!header) return [];
  const names = header.map((h) => h.trim());
  return body.map((cells) => {
    const obj: Record<string, unknown> = {};
    names.forEach((key, i) => {
      const value = (cells[i] ?? "").trim();
      if (!key || value === "") return;
      obj[key] = key === "applications" ? value.split(";").map((a) => a.trim()).filter(Boolean) : value;
    });
    return obj;
  });
}
