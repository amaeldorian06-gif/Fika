/**
 * Export CSV minimal (P08) — sans dépendance.
 * Échappement RFC 4180 (guillemets doublés), BOM UTF-8 pour Excel,
 * séparateur « ; » (fr-FR) et séparateur décimal « , ».
 */

export function escapeCsvCell(value: unknown): string {
  if (value == null) return '';
  let str = typeof value === 'number' ? value.toString().replace('.', ',') : String(value);
  // Virgule décimale déjà présente : rien à faire pour les nombres.
  if (/[";\n\r]/.test(str)) {
    str = `"${str.replace(/"/g, '""')}"`;
  }
  return str;
}

export function encodeCsv(headers: string[], rows: unknown[][]): string {
  const lines = [headers, ...rows].map((row) => row.map(escapeCsvCell).join(';'));
  return `\uFEFF${lines.join('\r\n')}`;
}

export function downloadCsv(filename: string, headers: string[], rows: unknown[][]): void {
  const csv = encodeCsv(headers, rows);
  const blob = new Blob([csv], { type: 'text/csv;charset=utf-8' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
}
