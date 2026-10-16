function escapeCell(value: unknown) {
  if (value === null || value === undefined) return "";
  const text = Array.isArray(value) ? value.join("; ") : typeof value === "object" ? JSON.stringify(value) : String(value);
  // Neutralise spreadsheet formulas and quote when needed.
  const safe = /^[=+\-@]/.test(text) ? `'${text}` : text;
  return /[",\n\r]/.test(safe) ? `"${safe.replace(/"/g, '""')}"` : safe;
}

export function toCsv<T extends Record<string, unknown>>(rows: T[], columns: Array<{ key: keyof T; label: string }>) {
  const header = columns.map((column) => escapeCell(column.label)).join(",");
  const lines = rows.map((row) => columns.map((column) => escapeCell(row[column.key])).join(","));
  return [header, ...lines].join("\r\n");
}

/** Triggers a download of `csv` (UTF-8 with BOM so Excel shows ₱ correctly). */
export function downloadCsv(fileName: string, csv: string) {
  const blob = new Blob(["﻿", csv], { type: "text/csv;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = fileName;
  document.body.appendChild(link);
  link.click();
  link.remove();
  window.setTimeout(() => URL.revokeObjectURL(url), 1000);
}
