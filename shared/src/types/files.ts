export const ALLOWED_EXTENSIONS = ['.xlsx', '.xls', '.ods', '.csv', '.tsv'] as const;

export type AllowedExtension = (typeof ALLOWED_EXTENSIONS)[number];

export const SPREADSHEET_MIME_TYPES: Record<string, string> = {
  '.xlsx': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  '.xls': 'application/vnd.ms-excel',
  '.ods': 'application/vnd.oasis.opendocument.spreadsheet',
  '.csv': 'text/csv',
  '.tsv': 'text/tab-separated-values',
};

export function getExtension(filename: string): string {
  const i = filename.lastIndexOf('.');
  return i >= 0 ? filename.slice(i).toLowerCase() : '';
}

export function isSpreadsheetFile(filename: string): boolean {
  const ext = getExtension(filename);
  return (ALLOWED_EXTENSIONS as readonly string[]).includes(ext);
}

export function isAllowedFile(filename: string): boolean {
  return isSpreadsheetFile(filename);
}
