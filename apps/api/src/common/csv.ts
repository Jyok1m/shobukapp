type CsvValue = string | number | Date | null | undefined;

// A cell starting with these is run as a formula by spreadsheet software.
export function csvCell(value: CsvValue): string {
  if (value === null || value === undefined) return '';
  let text =
    value instanceof Date ? value.toISOString().slice(0, 10) : String(value);
  if (/^[=+\-@\t\r]/.test(text)) text = `'${text}`;
  return /[";\n\r]/.test(text) ? `"${text.replace(/"/g, '""')}"` : text;
}

// BOM: Excel reads accents correctly; CRLF and semicolons for French Excel.
export function toCsv(header: string[], rows: CsvValue[][]): string {
  return (
    '﻿' +
    [header, ...rows].map((row) => row.map(csvCell).join(';')).join('\r\n')
  );
}

export const SEX_LABEL = { FEMALE: 'F', MALE: 'M' } as const;
