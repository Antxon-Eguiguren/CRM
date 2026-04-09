/** RFC 4180-style CSV cell escaping for export. */
function escapeCell(value: unknown): string {
  if (value === null || value === undefined) return '';
  const s = String(value);
  if (/[",\n\r]/.test(s)) return `"${s.replace(/"/g, '""')}"`;
  return s;
}

export function rowsToCsv(rows: (string | number | boolean | null | undefined)[][]): string {
  return rows.map((row) => row.map(escapeCell).join(',')).join('\r\n');
}

export function downloadCsvFile(filename: string, csvBody: string): void {
  const blob = new Blob(['\ufeff', csvBody], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}
