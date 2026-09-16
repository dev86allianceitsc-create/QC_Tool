// Minimal CSV writer (no external dependency) with formula-injection
// neutralization per REQ-SEC-001: a field starting with =, +, -, or @ could
// be interpreted as a formula by spreadsheet software when the export is
// opened, so it gets a leading "'" to force plain-text interpretation.
const FORMULA_PREFIX_PATTERN = /^[=+\-@]/;

function escapeCsvField(value: unknown): string {
  let text = value === null || value === undefined ? "" : String(value);
  if (FORMULA_PREFIX_PATTERN.test(text)) {
    text = `'${text}`;
  }
  if (/[",\n\r]/.test(text)) {
    text = `"${text.replace(/"/g, '""')}"`;
  }
  return text;
}

export function toCsv(headers: string[], rows: unknown[][]): string {
  const lines = [headers.map(escapeCsvField).join(",")];
  for (const row of rows) {
    lines.push(row.map(escapeCsvField).join(","));
  }
  return lines.join("\r\n") + "\r\n";
}
