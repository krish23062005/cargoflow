/**
 * Client-side CSV export helpers. Trigger.dev becomes the place for server
 * background generation (PDF etc.) — for now exports are generated in the
 * browser so the Reports page works without a background job infrastructure.
 */
export function toCsv(
  rows: Record<string, unknown>[],
  headers?: string[],
): string {
  if (rows.length === 0) return "";
  const columns = headers ?? Object.keys(rows[0]!);
  const escape = (value: unknown): string => {
    const raw = value == null ? "" : String(value);
    if (/[",\n]/.test(raw)) {
      return `"${raw.replace(/"/g, '""')}"`;
    }
    return raw;
  };
  const lines = [columns.map(escape).join(",")];
  for (const row of rows) {
    lines.push(columns.map((c) => escape(row[c])).join(","));
  }
  return lines.join("\n");
}

/**
 * Trigger a browser download for a CSV string. Safe to call only on the
 * client (document.createElement is browser-only).
 */
export function downloadCsv(filename: string, csv: string): void {
  const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
}