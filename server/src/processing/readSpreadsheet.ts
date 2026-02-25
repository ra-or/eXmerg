import ExcelJS from 'exceljs';
import type { SheetSource } from '../services/mergeStrategies.js';
import { getExtension, isSpreadsheetFile } from 'shared';
import { parseOdsBuffer } from './parseOds.js';
import { parseCsvToRows } from './parseCsv.js';

// ---------------------------------------------------------------------------
// Hilfsfunktionen
// ---------------------------------------------------------------------------

async function loadXlsxWorkbook(buffer: Buffer): Promise<ExcelJS.Workbook> {
  const wb = new ExcelJS.Workbook();
  await wb.xlsx.load(buffer as unknown as ArrayBuffer);
  return wb;
}

function cellToString(cell: ExcelJS.Cell): string {
  const v = cell.value;
  if (v == null) return '';
  if (typeof v === 'object' && 'text' in v) return String((v as { text: string }).text);
  if (typeof v === 'object' && 'result' in v) {
    // Formel-Zelle: Ergebnis nutzen
    const res = (v as { result?: unknown }).result;
    return res != null ? String(res) : '';
  }
  return String(v);
}

function sheetToRows(ws: ExcelJS.Worksheet): string[][] {
  const rows: string[][] = [];
  const rowCount = ws.rowCount ?? 0;
  const maxCol = Math.max(ws.columnCount || 0, 1);
  for (let r = 1; r <= rowCount; r++) {
    const row = ws.getRow(r);
    const cells: string[] = [];
    for (let c = 1; c <= maxCol; c++) cells.push(cellToString(row.getCell(c)));
    rows.push(cells);
  }
  return rows;
}

// ---------------------------------------------------------------------------
// ODS → SheetSource[]
// ---------------------------------------------------------------------------

async function readOdsToSources(buffer: Buffer, filename: string, selectedSheetIds?: string[]): Promise<SheetSource[]> {
  const odsSheets = await parseOdsBuffer(buffer);
  const sources: SheetSource[] = [];
  for (let i = 0; i < odsSheets.length; i++) {
    const sheet = odsSheets[i];
    if (!sheet) continue;
    const sheetId = String(i);
    if (selectedSheetIds?.length && !selectedSheetIds.includes(sheetId)) continue;
    const rows = sheet.rows;
    sources.push({
      filename,
      sheetName: sheet.name,
      sheetIndex: i,
      rows,
      headers: rows[0] ?? [],
    });
  }
  return sources;
}

// ---------------------------------------------------------------------------
// XLSX → SheetSource[]
// ---------------------------------------------------------------------------

async function readXlsxToSources(
  buffer: Buffer,
  filename: string,
  selectedSheetIds?: string[],
): Promise<SheetSource[]> {
  const workbook = await loadXlsxWorkbook(buffer);
  const sources: SheetSource[] = [];
  for (let i = 0; i < workbook.worksheets.length; i++) {
    const ws = workbook.worksheets[i];
    if (!ws) continue;
    const sheetId = String(i);
    if (selectedSheetIds?.length && !selectedSheetIds.includes(sheetId)) continue;
    const rows = sheetToRows(ws);
    sources.push({
      filename,
      sheetName: ws.name || 'Sheet' + (i + 1),
      sheetIndex: i,
      rows,
      headers: rows[0] ?? [],
    });
  }
  return sources;
}

// ---------------------------------------------------------------------------
// Öffentliche API
// ---------------------------------------------------------------------------

export async function readSpreadsheetToSources(
  buffer: Buffer,
  filename: string,
  selectedSheetIds?: string[],
): Promise<SheetSource[]> {
  if (!isSpreadsheetFile(filename)) throw new Error('Kein Tabellenformat: ' + filename);

  const ext = getExtension(filename);

  if (ext === '.xlsx') {
    return readXlsxToSources(buffer, filename, selectedSheetIds);
  }

  if (ext === '.ods') {
    return readOdsToSources(buffer, filename, selectedSheetIds);
  }

  if (ext === '.csv' || ext === '.tsv') {
    const rows = parseCsvToRows(buffer, { delimiter: ext === '.tsv' ? '\t' : undefined });
    return [
      {
        filename,
        sheetName: 'Daten',
        sheetIndex: 0,
        rows: rows.map((r) => r.map(String)),
        headers: rows[0]?.map(String) ?? [],
      },
    ];
  }

  if (ext === '.xls') {
    throw new Error(
      `Das Format .xls (altes Excel-Binärformat) wird nicht direkt unterstützt. ` +
        `Bitte die Datei in Excel oder LibreOffice als .xlsx speichern und erneut hochladen.`,
    );
  }

  throw new Error(`Nicht unterstütztes Format für Merge: ${ext}`);
}
