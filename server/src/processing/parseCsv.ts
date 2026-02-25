import ExcelJS from 'exceljs';

export type CsvDelimiter = ',' | ';' | '\t' | '|';

interface CsvParseOptions {
  delimiter?: CsvDelimiter;
  encoding?: BufferEncoding;
}

/**
 * Auto-detects the CSV delimiter by analyzing the first few lines.
 * Checks for tab, semicolon, pipe, then falls back to comma.
 */
function detectDelimiter(text: string): CsvDelimiter {
  const sample = text.slice(0, 4096);
  const lines = sample.split(/\r?\n/).slice(0, 10);

  const candidates: CsvDelimiter[] = ['\t', ';', '|', ','];
  let best: CsvDelimiter = ',';
  let bestScore = 0;

  for (const delim of candidates) {
    const counts = lines.filter((l) => l.trim()).map((l) => l.split(delim).length - 1);
    if (counts.length === 0) continue;
    const consistent = counts.every((c) => c === counts[0] && c > 0);
    const score = consistent ? counts[0]! * lines.length : 0;
    if (score > bestScore) {
      bestScore = score;
      best = delim;
    }
  }

  return best;
}

/**
 * Parses a single CSV/TSV line, respecting quoted fields.
 */
function parseCsvLine(line: string, delimiter: string): string[] {
  const fields: string[] = [];
  let current = '';
  let inQuotes = false;

  for (let i = 0; i < line.length; i++) {
    const ch = line[i]!;
    if (inQuotes) {
      if (ch === '"') {
        if (i + 1 < line.length && line[i + 1] === '"') {
          current += '"';
          i++;
        } else {
          inQuotes = false;
        }
      } else {
        current += ch;
      }
    } else {
      if (ch === '"') {
        inQuotes = true;
      } else if (ch === delimiter) {
        fields.push(current);
        current = '';
      } else {
        current += ch;
      }
    }
  }
  fields.push(current);
  return fields;
}

/**
 * Parses a CSV/TSV buffer into rows of string arrays.
 */
export function parseCsvToRows(buffer: Buffer, options?: CsvParseOptions): string[][] {
  const encoding = options?.encoding ?? 'utf-8';
  const text = buffer.toString(encoding);
  const delimiter = options?.delimiter ?? detectDelimiter(text);
  const lines = text.split(/\r?\n/);
  const rows: string[][] = [];

  for (const line of lines) {
    if (line.trim() === '') continue;
    rows.push(parseCsvLine(line, delimiter));
  }

  return rows;
}

/**
 * Converts a CSV/TSV buffer into an ExcelJS Workbook with a single "Daten" worksheet.
 */
export async function parseCsvToWorkbook(buffer: Buffer, options?: CsvParseOptions): Promise<ExcelJS.Workbook> {
  const rows = parseCsvToRows(buffer, options);
  const wb = new ExcelJS.Workbook();
  const ws = wb.addWorksheet('Daten');

  for (const row of rows) {
    ws.addRow(row.map((cell) => parseNumericCell(cell)));
  }

  return wb;
}

/**
 * Attempts to parse a cell value as a number if it looks numeric.
 */
function parseNumericCell(value: string): string | number {
  const trimmed = value.trim();
  if (trimmed === '') return '';
  const num = Number(trimmed);
  if (!Number.isNaN(num) && trimmed !== '') return num;
  return value;
}
