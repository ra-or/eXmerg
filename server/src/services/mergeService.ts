import ExcelJS from 'exceljs';
import { readFile, writeFile } from 'fs/promises';
import type { SpreadsheetMergeOptions } from 'shared';
import { getExtension } from 'shared';
import { parseOdsToWorkbook } from '../processing/parseOdsToWorkbook.js';
import { copyWorksheet, prepareValue } from '../processing/copySheet.js';

/** Pfad zur Warnings-Datei neben der Output-Datei. */
export function warningsPath(outputFilePath: string): string {
  return outputFilePath + '.warnings.json';
}

export interface FileRef {
  /** Absoluter Pfad zur Datei auf Disk. */
  filePath: string;
  filename: string;
}

export interface MergeSpreadsheetInput {
  files: FileRef[];
  options: SpreadsheetMergeOptions;
  selectedSheets?: Record<string, string[]>;
  /** Absoluter Pfad, unter dem die fertige Datei abgelegt wird. */
  outputFilePath: string;
  /** Optionaler Fortschritts-Callback (pct: 0-100, msg: Statustext). */
  onProgress?: (pct: number, msg: string) => void;
}

/** Einheitliche Referenz auf ein Sheet (flache Liste für alle Merge-Modi). */
export interface SheetSourceRef {
  filePath: string;
  filename: string;
  sheetName: string;
  sheetIndex: number;
}

/** Sheet-Name-Filter (include = nur behalten; exclude = entfernen). */
export interface SheetNameFilter {
  mode: 'include' | 'exclude';
  values: string[];
  match?: 'exact' | 'contains' | 'regex';
  caseSensitive?: boolean;
}

/** Optionen für collectSheetSources. */
export interface SheetCollectOptions {
  mode?: 'all' | 'first' | 'selected';
  /** Bei mode === 'selected': Indizes (global für jede Datei). */
  selectedSheets?: number[];
  /**
   * Pro-Datei-Auswahl (überschreibt mode/selectedSheets wenn gesetzt).
   * Ermöglicht Backward-Kompatibilität mit Record<filename, string[]>-API.
   */
  selectedSheetsByFile?: Record<string, number[]>;
  sheetNameFilter?: SheetNameFilter;
}

const DEFAULT_MATCH: NonNullable<SheetNameFilter['match']> = 'exact';
const DEFAULT_CASE_SENSITIVE = false;

/**
 * Prüft, ob ein Sheet-Name zum Filter passt.
 * Defaults: match = 'exact', caseSensitive = false.
 */
export function matchesSheetName(sheetName: string, filter: SheetNameFilter): boolean {
  const match = filter.match ?? DEFAULT_MATCH;
  const caseSensitive = filter.caseSensitive ?? DEFAULT_CASE_SENSITIVE;
  const name = caseSensitive ? sheetName : sheetName.toLowerCase();
  const values = filter.values;

  for (const raw of values) {
    const value = caseSensitive ? raw : raw.toLowerCase();
    let hit = false;
    if (match === 'exact') {
      hit = name === value;
    } else if (match === 'contains') {
      hit = name.includes(value);
    } else if (match === 'regex') {
      try {
        const re = new RegExp(value, caseSensitive ? '' : 'i');
        hit = re.test(sheetName);
      } catch {
        hit = false;
      }
    }
    if (hit) return true;
  }
  return false;
}

/**
 * Baut aus allen Dateien eine flache Liste von Sheet-Quellen.
 * options undefined → alle Sheets (wie bisher). mode 'first' / 'selected' / 'all',
 * danach optional sheetNameFilter (include/exclude).
 * Leere Dateien nach Filter werden übersprungen. Keine Sheets → klarer Fehler.
 */
export async function collectSheetSources(
  files: FileRef[],
  options?: SheetCollectOptions,
  onProgress?: (pct: number, msg: string) => void,
): Promise<SheetSourceRef[]> {
  const result: SheetSourceRef[] = [];
  const filter = options?.sheetNameFilter;
  const byFile = options?.selectedSheetsByFile;

  for (let i = 0; i < files.length; i++) {
    const f = files[i]!;
    onProgress?.(Math.round((i / files.length) * 100), `Lade Verzeichnis ${i + 1}/${files.length}: ${f.filename}`);
    const ext = getExtension(f.filename);
    if (ext !== '.xlsx' && ext !== '.ods' && ext !== '.xls') continue;
    let wb: ExcelJS.Workbook;
    try {
      wb = await loadWorkbook(f);
    } catch {
      continue;
    }

    let indices: number[];
    if (byFile != null && byFile[f.filename] != null) {
      const arr = byFile[f.filename]!;
      indices = arr.filter((n) => Number.isInteger(n) && n >= 0 && n < wb.worksheets.length);
    } else {
      const mode = options?.mode ?? 'all';
      if (mode === 'first') {
        indices = wb.worksheets.length > 0 ? [0] : [];
      } else if (mode === 'selected' && options?.selectedSheets?.length) {
        indices = options.selectedSheets.filter(
          (n) => Number.isInteger(n) && n >= 0 && n < wb.worksheets.length,
        );
      } else {
        indices = wb.worksheets.map((_, idx) => idx);
      }
    }

    for (const sheetIndex of indices) {
      const ws = wb.worksheets[sheetIndex];
      if (!ws) continue;
      const sheetName = ws.name || `Sheet${sheetIndex + 1}`;

      if (filter) {
        const matches = matchesSheetName(sheetName, filter);
        if (filter.mode === 'include' && !matches) continue;
        if (filter.mode === 'exclude' && matches) continue;
      }

      result.push({
        filePath: f.filePath,
        filename: f.filename,
        sheetName,
        sheetIndex,
      });
    }
  }

  if (result.length === 0) {
    throw new Error('No sheets matched the current sheet selection or filter.');
  }
  return result;
}

/**
 * Lädt die Datei einer Sheet-Quelle und gibt das zugehörige Worksheet zurück.
 * Workbook nur für die Dauer des Aufrufs halten, danach verwerfen.
 */
export async function loadSheet(source: SheetSourceRef): Promise<{ wb: ExcelJS.Workbook; ws: ExcelJS.Worksheet }> {
  const wb = await loadWorkbook({ filePath: source.filePath, filename: source.filename });
  const ws = wb.worksheets[source.sheetIndex];
  if (!ws) throw new Error(`Sheet ${source.sheetIndex} nicht gefunden: ${source.filename}`);
  return { wb, ws };
}

/**
 * Lädt eine Datei von Disk und parst sie zu einem ExcelJS-Workbook.
 * Jede Datei wird nur einmal geladen und nach der Verarbeitung freigegeben.
 */
async function loadWorkbook(f: FileRef): Promise<ExcelJS.Workbook> {
  const ext = getExtension(f.filename);
  if (ext === '.xlsx' || ext === '.xls') {
    const wb = new ExcelJS.Workbook();
    await wb.xlsx.readFile(f.filePath);
    return wb;
  }
  if (ext === '.ods') {
    const buf = await readFile(f.filePath);
    const wb = await parseOdsToWorkbook(buf);
    return wb;
  }
  throw new Error(`Nicht unterstütztes Format: ${f.filename}`);
}

/** Gibt die Sheet-Namen einer Datei zurück (für /api/sheets). */
export async function getSheetNames(f: FileRef): Promise<string[]> {
  const wb = await loadWorkbook(f);
  return wb.worksheets.map((ws) => ws.name);
}

/**
 * Gibt Sheet-Namen + erste 3 Zeilen des ersten Sheets zurück (für Hover-Vorschau).
 * Max. 8 Spalten, max. 3 Zeilen. Werte werden als Strings normalisiert.
 */
export async function getSheetInfo(f: FileRef): Promise<{ names: string[]; previewRows: string[][] }> {
  const wb = await loadWorkbook(f);
  const names = wb.worksheets.map((ws) => ws.name);

  const ws = wb.worksheets[0];
  if (!ws) return { names, previewRows: [] };

  const previewRows: string[][] = [];
  const maxRows = Math.min(ws.rowCount, 6);
  const maxCols = 8;

  for (let r = 1; r <= maxRows; r++) {
    const row = ws.getRow(r);
    const cells: string[] = [];
    for (let c = 1; c <= maxCols; c++) {
      const cell = row.getCell(c);
      const v = cell.value;
      if (v == null) { cells.push(''); continue; }
      if (typeof v === 'object' && ('formula' in v || 'sharedFormula' in v)) {
        const res = (v as ExcelJS.CellFormulaValue).result;
        cells.push(res == null ? '' : String(res));
      } else if (v instanceof Date) {
        cells.push(v.toLocaleDateString('de-DE'));
      } else {
        cells.push(String(v));
      }
    }
    // Trailing-Leerzellen abschneiden
    while (cells.length > 0 && cells[cells.length - 1] === '') cells.pop();
    previewRows.push(cells);
  }

  return { names, previewRows };
}

/** Konvertiert Merge-Input in SheetCollectOptions (Modus, pro-Datei-Auswahl, Namen-Filter). */
function toSheetCollectOptions(input: MergeSpreadsheetInput): SheetCollectOptions | undefined {
  const { options, selectedSheets } = input;
  const sheetSelectionMode = options.sheetSelectionMode;
  const sheetNameFilter = options.sheetNameFilter;

  const out: SheetCollectOptions = {};

  if (sheetSelectionMode === 'first') {
    out.mode = 'first';
  } else if (selectedSheets && Object.keys(selectedSheets).length > 0) {
    const byFile: Record<string, number[]> = {};
    for (const [filename, ids] of Object.entries(selectedSheets)) {
      const indices = (ids ?? [])
        .map((id) => parseInt(id, 10))
        .filter((n) => !Number.isNaN(n) && n >= 0);
      if (indices.length > 0) byFile[filename] = indices;
    }
    if (Object.keys(byFile).length > 0) out.selectedSheetsByFile = byFile;
  }

  if (sheetNameFilter?.values?.length) {
    out.sheetNameFilter = {
      mode: sheetNameFilter.mode,
      values: sheetNameFilter.values.filter((v) => typeof v === 'string' && v.trim() !== ''),
      match: sheetNameFilter.match,
      caseSensitive: sheetNameFilter.caseSensitive,
    };
  }

  if (Object.keys(out).length === 0) return undefined;
  return out;
}

export async function mergeSpreadsheets(input: MergeSpreadsheetInput): Promise<string[]> {
  const { files, options, outputFilePath, onProgress } = input;
  const warnings: string[] = [];

  onProgress?.(1, 'Lade Sheet-Verzeichnis…');
  const collectOptions = toSheetCollectOptions(input);
  const sources = await collectSheetSources(files, collectOptions, (pct, msg) => onProgress?.(pct * 0.2, msg));

  if (options.mode === 'one_file_per_sheet') {
    await copyFilesToSheets(sources, outputFilePath, warnings, onProgress);
  } else if (options.mode === 'consolidated_sheets') {
    await copyFilesToSheetsWithSummary(sources, outputFilePath, warnings, onProgress);
  } else if (options.mode === 'all_to_one_sheet') {
    await mergeAllToOneSheetFormatted(sources, false, outputFilePath, warnings, onProgress);
  } else if (options.mode === 'all_with_source_column') {
    await mergeAllToOneSheetFormatted(sources, true, outputFilePath, warnings, onProgress);
  } else if (options.mode === 'row_per_file') {
    await mergeRowPerFile(sources, true, outputFilePath, warnings, onProgress);
  } else if (options.mode === 'row_per_file_no_sum') {
    await mergeRowPerFile(sources, false, outputFilePath, warnings, onProgress);
  } else {
    throw new Error(`Unbekannter Merge-Modus: ${(options as SpreadsheetMergeOptions).mode}`);
  }

  if (warnings.length > 0) {
    await writeFile(warningsPath(outputFilePath), JSON.stringify(warnings));
  }
  return warnings;
}

// ─────────────────────────────────────────────────────────────────────────────
// Hilfsfunktionen
// ─────────────────────────────────────────────────────────────────────────────

function makeSheetNameUnique(base: string, used: Set<string>): string {
  const safe = base.replace(/[\\/?*[\]:]/g, '_').slice(0, 31);
  if (!used.has(safe)) { used.add(safe); return safe; }
  for (let n = 2; n < 1000; n++) {
    const suffix = ` (${n})`;
    const candidate = safe.slice(0, 31 - suffix.length) + suffix;
    if (!used.has(candidate)) { used.add(candidate); return candidate; }
  }
  return safe;
}

/**
 * Schreibt ein Workbook als XLSX auf Disk.
 * Nutzt writeBuffer + fs.writeFile für zuverlässige, vollständige Dateien (insb. in Docker).
 */
async function writeWorkbookToFile(workbook: ExcelJS.Workbook, outputFilePath: string): Promise<void> {
  const buffer = await workbook.xlsx.writeBuffer();
  const nodeBuffer = Buffer.isBuffer(buffer) ? buffer : Buffer.from(buffer as ArrayBuffer);
  await writeFile(outputFilePath, nodeBuffer);
}

/**
 * WorkbookWriter (Streaming) ohne Datei-Stream: schreibt in internen StreamBuf,
 * nach commit() Puffer holen und mit writeFile schreiben → zuverlässig lesbare XLSX.
 */
async function flushStreamWorkbookToFile(
  streamWb: { commit: () => Promise<void>; stream: { toBuffer(): Buffer | Uint8Array } },
  outputFilePath: string,
): Promise<void> {
  await streamWb.commit();
  // Ein Tick warten, damit der interne StreamBuf alle Chunks abgeschlossen hat (ExcelJS-Zip-Pipeline).
  await new Promise<void>((r) => setImmediate(r));
  const buffer = streamWb.stream.toBuffer();
  const nodeBuffer = Buffer.isBuffer(buffer) ? buffer : Buffer.from(buffer as ArrayLike<number>);
  await writeFile(outputFilePath, nodeBuffer);
}

/** Numerischen Wert einer Zelle lesen (direkter Wert oder Formel-Ergebnis). */
function getNumericValue(cell: ExcelJS.Cell): number | null {
  const val = cell.value;
  if (typeof val === 'number') return val;
  if (val !== null && val !== undefined && typeof val === 'object') {
    if ('formula' in val || 'sharedFormula' in val) {
      const r = (val as ExcelJS.CellFormulaValue).result;
      if (typeof r === 'number') return r;
    }
  }
  return null;
}

// ─────────────────────────────────────────────────────────────────────────────
// Modus B: jede Datei = ein Sheet
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Modus B – jede Datei = ein Sheet.
 * Standard: In-Memory (writeBuffer + writeFile) für zuverlässig in Excel öffnbare XLSX.
 * Optional: EXCEL_STREAM=true für Streaming (kann ungültige XLSX liefern – ExcelJS-Known-Issue).
 */
async function copyFilesToSheets(
  sources: SheetSourceRef[],
  outputFilePath: string,
  warnings: string[],
  onProgress?: (pct: number, msg: string) => void,
): Promise<void> {
  type MergeDims = { top: number; left: number; bottom: number; right: number };
  type WsInternal = ExcelJS.Worksheet & { _merges?: Record<string, MergeDims> };

  const usedNames = new Set<string>();
  const baseNameCount = new Map<string, number>();

  if (process.env.EXCEL_STREAM === 'true') {
    // Streaming (kann bei ExcelJS zu ungültiger XLSX führen)
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const StreamWb = (ExcelJS as unknown as any).stream?.xlsx?.WorkbookWriter as
        new (opts: { filename: string; useStyles: boolean; useSharedStrings: boolean }) => {
          addWorksheet: (name: string, opts?: { views?: ExcelJS.WorksheetView[] }) => ExcelJS.Worksheet & { commit: () => Promise<void> };
          commit: () => Promise<void>;
        };
    if (!StreamWb) throw new Error('ExcelJS streaming writer nicht verfügbar.');
    const streamWb = new StreamWb({ useStyles: false, useSharedStrings: false } as any);
    for (let si = 0; si < sources.length; si++) {
      const source = sources[si]!;
      onProgress?.(20 + Math.round((si / sources.length) * 75), `Sheet ${si + 1}/${sources.length}: ${source.filename}`);
      let srcWs: ExcelJS.Worksheet;
      try {
        const { ws } = await loadSheet(source);
        srcWs = ws;
      } catch (err) {
        warnings.push(`${source.filename} (${source.sheetName}): ${err instanceof Error ? err.message : String(err)}`);
        continue;
      }
      const baseName = source.filename.replace(/\.[^.]+$/, '');
      const countFromSameFile = (baseNameCount.get(baseName) ?? 0) + 1;
      baseNameCount.set(baseName, countFromSameFile);
      const rawName = countFromSameFile === 1 ? baseName : `${baseName} - ${source.sheetName}`;
      const destName = makeSheetNameUnique(rawName, usedNames);
      const destWs = streamWb.addWorksheet(destName);
      if (Array.isArray(srcWs.views) && srcWs.views.length > 0) {
        try {
          (destWs as unknown as { views?: ExcelJS.WorksheetView[] }).views = srcWs.views.map((v) => ({ ...v })) as ExcelJS.WorksheetView[];
        } catch { /* ignorieren */ }
      }
      const maxCol = srcWs.columnCount || 0;
      for (let c = 1; c <= maxCol; c++) {
        try {
          const srcCol = srcWs.getColumn(c);
          const destCol = destWs.getColumn(c);
          if (srcCol.width !== undefined && srcCol.width > 0) destCol.width = srcCol.width;
          if (srcCol.hidden) destCol.hidden = true;
        } catch { /* ignorieren */ }
      }
      const srcInternal = srcWs as unknown as WsInternal;
      if (srcInternal._merges) {
        for (const dims of Object.values(srcInternal._merges)) {
          if (!dims || typeof dims.top !== 'number') continue;
          if (dims.top === dims.bottom && dims.left === dims.right) continue;
          try { destWs.mergeCells(dims.top, dims.left, dims.bottom, dims.right); } catch { /* überspringen */ }
        }
      }
      srcWs.eachRow({ includeEmpty: true }, (srcRow, rowNum) => {
        const destRow = destWs.getRow(rowNum);
        if (srcRow.height && srcRow.height > 0) destRow.height = srcRow.height;
        if (srcRow.hidden) destRow.hidden = true;
        srcRow.eachCell({ includeEmpty: true }, (srcCell, colNum) => {
          if (srcCell.isMerged && srcCell.address !== srcCell.master.address) return;
          const destCell = destRow.getCell(colNum);
          destCell.value = prepareValue(srcCell);
          const style = srcCell.style;
          if (style && Object.keys(style).length > 0) {
            try { destCell.style = JSON.parse(JSON.stringify(style)) as ExcelJS.Style; } catch { /* ignorieren */ }
          }
        });
        (destRow as ExcelJS.Row & { commit?: () => void }).commit?.();
      });
    }
    await flushStreamWorkbookToFile(streamWb as unknown as { commit: () => Promise<void>; stream: { toBuffer(): Buffer } }, outputFilePath);
    return;
  }

  // In-Memory (Standard – XLSX öffnet zuverlässig in Excel)
  const workbook = new ExcelJS.Workbook();
    for (let si = 0; si < sources.length; si++) {
      const source = sources[si]!;
      onProgress?.(20 + Math.round((si / sources.length) * 75), `Sheet ${si + 1}/${sources.length}: ${source.filename}`);
      let srcWs: ExcelJS.Worksheet;
      try {
        const { ws } = await loadSheet(source);
        srcWs = ws;
      } catch (err) {
        warnings.push(`${source.filename} (${source.sheetName}): ${err instanceof Error ? err.message : String(err)}`);
        continue;
      }
      const baseName = source.filename.replace(/\.[^.]+$/, '');
      const countFromSameFile = (baseNameCount.get(baseName) ?? 0) + 1;
      baseNameCount.set(baseName, countFromSameFile);
      const rawName = countFromSameFile === 1 ? baseName : `${baseName} - ${source.sheetName}`;
      const destName = makeSheetNameUnique(rawName, usedNames);
      const destWs = workbook.addWorksheet(destName);
      if (Array.isArray(srcWs.views) && srcWs.views.length > 0) {
        try {
          (destWs as unknown as { views?: ExcelJS.WorksheetView[] }).views = srcWs.views.map((v) => ({ ...v })) as ExcelJS.WorksheetView[];
        } catch { /* ignorieren */ }
      }
      const maxCol = srcWs.columnCount || 0;
      for (let c = 1; c <= maxCol; c++) {
        try {
          const srcCol = srcWs.getColumn(c);
          const destCol = destWs.getColumn(c);
          if (srcCol.width !== undefined && srcCol.width > 0) destCol.width = srcCol.width;
          if (srcCol.hidden) destCol.hidden = true;
        } catch { /* ignorieren */ }
      }
      const srcInternal = srcWs as unknown as WsInternal;
      if (srcInternal._merges) {
        for (const dims of Object.values(srcInternal._merges)) {
          if (!dims || typeof dims.top !== 'number') continue;
          if (dims.top === dims.bottom && dims.left === dims.right) continue;
          try { destWs.mergeCells(dims.top, dims.left, dims.bottom, dims.right); } catch { /* überspringen */ }
        }
      }
      srcWs.eachRow({ includeEmpty: true }, (srcRow, rowNum) => {
        const destRow = destWs.getRow(rowNum);
        if (srcRow.height && srcRow.height > 0) destRow.height = srcRow.height;
        if (srcRow.hidden) destRow.hidden = true;
        srcRow.eachCell({ includeEmpty: true }, (srcCell, colNum) => {
          if (srcCell.isMerged && srcCell.address !== srcCell.master.address) return;
          const destCell = destRow.getCell(colNum);
          destCell.value = prepareValue(srcCell);
          const style = srcCell.style;
          if (style && Object.keys(style).length > 0) {
            try { destCell.style = JSON.parse(JSON.stringify(style)) as ExcelJS.Style; } catch { /* ignorieren */ }
          }
        });
      });
    }
  await writeWorkbookToFile(workbook, outputFilePath);
}

// ─────────────────────────────────────────────────────────────────────────────
// Modus A + C: Alle Sheets formaterhaltend untereinander (Streaming)
// ─────────────────────────────────────────────────────────────────────────────

type MergeRect = [number, number, number, number];

/**
 * Stapelt alle Sheet-Quellen untereinander in einem Sheet.
 * Standard: In-Memory (writeBuffer) für in Excel öffnbare XLSX. Optional: EXCEL_STREAM=true für Streaming.
 * addSourceCol = true (Modus C): Herkunftsspalte links.
 */
async function mergeAllToOneSheetFormatted(
  sources: SheetSourceRef[],
  addSourceCol: boolean,
  outputFilePath: string,
  warnings: string[],
  onProgress?: (pct: number, msg: string) => void,
): Promise<void> {
  const colOffset = addSourceCol ? 1 : 0;
  const colWidthMap = new Map<number, number>();
  const pendingMerges: MergeRect[] = [];
  const validSources: SheetSourceRef[] = [];
  const rowOffsets: number[] = [0];

  type WsWithCols = { _columns?: Array<{ number: number; width?: number } | null> };
  type WsInternal = { _merges?: Record<string, { top: number; left: number; bottom: number; right: number }> };

  for (let si = 0; si < sources.length; si++) {
    const source = sources[si]!;
    onProgress?.(Math.round((si / sources.length) * 45), `Metadaten ${si + 1}/${sources.length}: ${source.filename}`);
    let srcWs: ExcelJS.Worksheet;
    try {
      const { ws } = await loadSheet(source);
      srcWs = ws;
    } catch (err) {
      warnings.push(`${source.filename} (${source.sheetName}): ${err instanceof Error ? err.message : String(err)}`);
      continue;
    }
    validSources.push(source);
    const rowOffset = rowOffsets[rowOffsets.length - 1]!;
    let copiedRows = 0;
    srcWs.eachRow({ includeEmpty: true }, (_, srcRowNum) => {
      copiedRows = Math.max(copiedRows, srcRowNum);
    });
    const internalCols = ((srcWs as unknown as WsWithCols)._columns) ?? [];
    const maxSrcCol = Math.max(srcWs.columnCount || 0, internalCols.length);
    for (let c = 1; c <= maxSrcCol; c++) {
      try {
        const w = srcWs.getColumn(c).width;
        if (w && w > 0) {
          const destC = colOffset + c;
          colWidthMap.set(destC, Math.max(colWidthMap.get(destC) ?? 0, w));
        }
      } catch { /* ignore */ }
    }
    const wsi = srcWs as unknown as WsInternal;
    if (wsi._merges) {
      for (const dims of Object.values(wsi._merges)) {
        if (!dims || typeof dims.top !== 'number') continue;
        if (dims.top === dims.bottom && dims.left === dims.right) continue;
        pendingMerges.push([
          rowOffset + dims.top,
          colOffset + dims.left,
          rowOffset + dims.bottom,
          colOffset + dims.right,
        ]);
      }
    }
    if (addSourceCol && copiedRows > 0) {
      pendingMerges.push([rowOffset + 1, 1, rowOffset + copiedRows, 1]);
      if (!colWidthMap.has(1)) colWidthMap.set(1, 6);
    }
    rowOffsets.push(rowOffset + copiedRows);
  }

  if (rowOffsets.length <= 1) {
    throw new Error('Keine Daten zum Zusammenführen.');
  }

  const sourceCellStyle = {
    font: { bold: true, size: 9, color: { argb: 'FFAAAAAA' } },
    alignment: { vertical: 'top', horizontal: 'center', wrapText: true, textRotation: 90 },
    fill: { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF2A2A2A' } },
    border: { right: { style: 'thin', color: { argb: 'FF444444' } } },
  } as ExcelJS.Style;

  if (process.env.EXCEL_STREAM === 'true') {
    type StreamWs = ExcelJS.Worksheet & { commit: () => Promise<void> };
    const StreamWb = (ExcelJS as unknown as { stream?: { xlsx?: { WorkbookWriter: new (opts: { filename: string; useStyles: boolean; useSharedStrings: boolean }) => { addWorksheet: (n: string) => StreamWs; commit: () => Promise<void> } } } }).stream?.xlsx?.WorkbookWriter;
    if (!StreamWb) throw new Error('ExcelJS streaming writer nicht verfügbar.');
    const streamWb = new StreamWb({ useStyles: false, useSharedStrings: false } as any);
    const destWs = streamWb.addWorksheet('Merged');
    for (const [colNum, width] of colWidthMap) {
      try { destWs.getColumn(colNum).width = width; } catch { /* ignore */ }
    }
    for (const [r1, c1, r2, c2] of pendingMerges) {
      try { destWs.mergeCells(r1, c1, r2, c2); } catch { /* ignore */ }
    }
    onProgress?.(50, 'Schreibe Zeilen…');
    for (let si = 0; si < validSources.length; si++) {
      const source = validSources[si]!;
      onProgress?.(50 + Math.round((si / validSources.length) * 45), `Sheet ${si + 1}/${validSources.length}: ${source.filename}`);
      let srcWs: ExcelJS.Worksheet;
      try {
        const { ws } = await loadSheet(source);
        srcWs = ws;
      } catch {
        continue;
      }
      const rowOffset = rowOffsets[si]!;
      const baseName = source.filename.replace(/\.[^.]+$/, '');
      const multiFromSameFile = validSources.filter((s) => s.filename === source.filename).length > 1;
      const sourceLabel = multiFromSameFile ? `${baseName} • ${source.sheetName}` : baseName;
      srcWs.eachRow({ includeEmpty: true }, (srcRow, srcRowNum) => {
        const destRowNum = rowOffset + srcRowNum;
        const destRow = destWs.getRow(destRowNum);
        if (srcRow.height && srcRow.height > 0) destRow.height = srcRow.height;
        srcRow.eachCell({ includeEmpty: true }, (srcCell, srcColNum) => {
          if (srcCell.isMerged && srcCell.address !== srcCell.master.address) return;
          const destCell = destRow.getCell(colOffset + srcColNum);
          destCell.value = prepareValue(srcCell);
          const style = srcCell.style;
          if (style && Object.keys(style).length > 0) {
            try { destCell.style = JSON.parse(JSON.stringify(style)) as ExcelJS.Style; } catch { /* ignore */ }
          }
        });
        if (addSourceCol && srcRowNum === 1) {
          destRow.getCell(1).value = sourceLabel;
          destRow.getCell(1).style = sourceCellStyle;
        }
        (destRow as ExcelJS.Row & { commit?: () => void }).commit?.();
      });
    }
    await flushStreamWorkbookToFile(streamWb as unknown as { commit: () => Promise<void>; stream: { toBuffer(): Buffer } }, outputFilePath);
    return;
  }

  // In-Memory (Standard)
  const workbook = new ExcelJS.Workbook();
  const destWs = workbook.addWorksheet('Merged');
  for (const [colNum, width] of colWidthMap) {
    try { destWs.getColumn(colNum).width = width; } catch { /* ignore */ }
  }
  for (const [r1, c1, r2, c2] of pendingMerges) {
    try { destWs.mergeCells(r1, c1, r2, c2); } catch { /* ignore */ }
  }
  onProgress?.(50, 'Schreibe Zeilen…');
  for (let si = 0; si < validSources.length; si++) {
    const source = validSources[si]!;
    onProgress?.(50 + Math.round((si / validSources.length) * 45), `Sheet ${si + 1}/${validSources.length}: ${source.filename}`);
    let srcWs: ExcelJS.Worksheet;
    try {
      const { ws } = await loadSheet(source);
      srcWs = ws;
    } catch {
      continue;
    }
    const rowOffset = rowOffsets[si]!;
    const baseName = source.filename.replace(/\.[^.]+$/, '');
    const multiFromSameFile = validSources.filter((s) => s.filename === source.filename).length > 1;
    const sourceLabel = multiFromSameFile ? `${baseName} • ${source.sheetName}` : baseName;
    srcWs.eachRow({ includeEmpty: true }, (srcRow, srcRowNum) => {
      const destRowNum = rowOffset + srcRowNum;
      const destRow = destWs.getRow(destRowNum);
      if (srcRow.height && srcRow.height > 0) destRow.height = srcRow.height;
      srcRow.eachCell({ includeEmpty: true }, (srcCell, srcColNum) => {
        if (srcCell.isMerged && srcCell.address !== srcCell.master.address) return;
        const destCell = destRow.getCell(colOffset + srcColNum);
        destCell.value = prepareValue(srcCell);
        const style = srcCell.style;
        if (style && Object.keys(style).length > 0) {
          try { destCell.style = JSON.parse(JSON.stringify(style)) as ExcelJS.Style; } catch { /* ignore */ }
        }
      });
      if (addSourceCol && srcRowNum === 1) {
        destRow.getCell(1).value = sourceLabel;
        destRow.getCell(1).style = sourceCellStyle;
      }
    });
  }
  await writeWorkbookToFile(workbook, outputFilePath);
}

// ─────────────────────────────────────────────────────────────────────────────
// Modus E: Konsolidierungs-Sheet + Einzelne Sheets (Streaming)
// ─────────────────────────────────────────────────────────────────────────────

/** Stream-Worksheet-Typ für ExcelJS WorkbookWriter. */
type StreamWs = ExcelJS.Worksheet & { commit: () => Promise<void> };

/**
 * Kopiert ein in-memory Worksheet zeilenweise in ein Stream-Worksheet (mit commit).
 */
async function writeSheetToStream(
  destStreamWs: StreamWs,
  srcWs: ExcelJS.Worksheet,
): Promise<void> {
  type WsInternal = ExcelJS.Worksheet & { _merges?: Record<string, { top: number; left: number; bottom: number; right: number }> };
  const maxCol = srcWs.columnCount || 0;
  for (let c = 1; c <= maxCol; c++) {
    try {
      const srcCol = srcWs.getColumn(c);
      const destCol = destStreamWs.getColumn(c);
      if (srcCol.width !== undefined && srcCol.width > 0) destCol.width = srcCol.width;
      if (srcCol.hidden) destCol.hidden = true;
    } catch { /* ignorieren */ }
  }
  const srcInternal = srcWs as unknown as WsInternal;
  if (srcInternal._merges) {
    for (const dims of Object.values(srcInternal._merges)) {
      if (!dims || typeof dims.top !== 'number') continue;
      if (dims.top === dims.bottom && dims.left === dims.right) continue;
      try { destStreamWs.mergeCells(dims.top, dims.left, dims.bottom, dims.right); } catch { /* ignorieren */ }
    }
  }
  srcWs.eachRow({ includeEmpty: true }, (srcRow, rowNum) => {
    const destRow = destStreamWs.getRow(rowNum);
    if (srcRow.height && srcRow.height > 0) destRow.height = srcRow.height;
    if (srcRow.hidden) destRow.hidden = true;
    srcRow.eachCell({ includeEmpty: true }, (srcCell, colNum) => {
      if (srcCell.isMerged && srcCell.address !== srcCell.master.address) return;
      const destCell = destRow.getCell(colNum);
      destCell.value = prepareValue(srcCell);
      const style = srcCell.style;
      if (style && Object.keys(style).length > 0) {
        try { destCell.style = JSON.parse(JSON.stringify(style)) as ExcelJS.Style; } catch { /* ignorieren */ }
      }
    });
    destRow.commit();
  });
  // Worksheet nicht manuell commit() – Aufrufer (streamWb.commit()) wartet auf zipped
}

/** Sammelt numerische Werte aus einem Sheet in runningSum; gibt aktualisierte maxRow/maxCol zurück. */
function collectNumericSum(
  ws: ExcelJS.Worksheet,
  runningSum: Map<string, number>,
  max: { row: number; col: number },
): void {
  ws.eachRow({ includeEmpty: true }, (row, rowNum) => {
    max.row = Math.max(max.row, rowNum);
    row.eachCell({ includeEmpty: true }, (cell, colNum) => {
      max.col = Math.max(max.col, colNum);
      const n = getNumericValue(cell);
      if (n !== null) {
        const key = `${rowNum},${colNum}`;
        runningSum.set(key, (runningSum.get(key) ?? 0) + n);
      }
    });
  });
}

/** Übernimmt Stile für Zellen, die in der Vorlage leer sind (für spätere buildConsolidatedSheetFromSums). */
function collectStyleFallback(
  ws: ExcelJS.Worksheet,
  templateEmptyCells: Set<string>,
  styleFallback: Map<string, ExcelJS.Style>,
): void {
  ws.eachRow({ includeEmpty: true }, (row, rowNum) => {
    row.eachCell({ includeEmpty: true }, (cell, colNum) => {
      const key = `${rowNum},${colNum}`;
      if (!templateEmptyCells.has(key)) return;
      if (styleFallback.has(key)) return;
      const style = cell.style;
      if (!style || Object.keys(style).length === 0) return;
      try {
        styleFallback.set(key, JSON.parse(JSON.stringify(style)) as ExcelJS.Style);
      } catch { /* ignorieren */ }
    });
  });
}

/**
 * Baut das Konsolidierungs-Sheet aus Vorlage + vorher gesammelten Summen (ohne alle Workbooks im RAM).
 */
function buildConsolidatedSheetFromSums(
  templateWs: ExcelJS.Worksheet,
  runningSum: Map<string, number>,
  _templateEmptyCells: Set<string>,
  styleFallback: Map<string, ExcelJS.Style>,
  maxRow: number,
  maxCol: number,
  dest: ExcelJS.Worksheet,
): void {
  copyWorksheet(templateWs, dest);

  for (let row = 1; row <= maxRow; row++) {
    for (let col = 1; col <= maxCol; col++) {
      const templateCell = templateWs.getCell(row, col);
      if (templateCell.isMerged && templateCell.address !== templateCell.master.address) continue;

      const templateVal = templateCell.value;
      const destCell = dest.getCell(row, col);
      const key = `${row},${col}`;
      const sum = runningSum.get(key) ?? 0;

      if (typeof templateVal === 'string') continue;

      const isFormula = templateVal !== null && typeof templateVal === 'object' &&
        ('formula' in templateVal || 'sharedFormula' in templateVal);

      if (isFormula) {
        const fv = templateVal as ExcelJS.CellFormulaValue;
        destCell.value = { formula: fv.formula ?? '', result: sum, date1904: fv.date1904 } satisfies ExcelJS.CellFormulaValue;
        continue;
      }

      if (sum === 0 && !runningSum.has(key)) continue;
      destCell.value = sum;

      if (!templateVal && styleFallback.has(key)) {
        try { destCell.style = styleFallback.get(key)!; } catch { /* ignorieren */ }
      }
    }
  }
}

async function copyFilesToSheetsWithSummary(
  sources: SheetSourceRef[],
  outputFilePath: string,
  warnings: string[],
  onProgress?: (pct: number, msg: string) => void,
): Promise<void> {
  if (sources.length === 0) throw new Error('Keine Sheet-Quellen für die Konsolidierung gefunden.');

  const runningSum = new Map<string, number>();
  const templateEmptyCells = new Set<string>();
  const styleFallback = new Map<string, ExcelJS.Style>();
  let maxRow = 0;
  let maxCol = 0;

  let templateWs: ExcelJS.Worksheet;
  try {
    const { ws } = await loadSheet(sources[0]!);
    templateWs = ws;
  } catch (err) {
    warnings.push(`${sources[0]!.filename} (${sources[0]!.sheetName}): ${err instanceof Error ? err.message : String(err)}`);
    throw new Error('Template-Sheet konnte nicht geladen werden.');
  }

  const maxRef = { row: 0, col: 0 };
  collectNumericSum(templateWs, runningSum, maxRef);
  maxRow = maxRef.row;
  maxCol = maxRef.col;
  templateWs.eachRow({ includeEmpty: true }, (row, rowNum) => {
    row.eachCell({ includeEmpty: true }, (_, colNum) => {
      const cell = templateWs.getCell(rowNum, colNum);
      if (cell.value == null || (typeof cell.value === 'string' && cell.value.trim() === '')) {
        templateEmptyCells.add(`${rowNum},${colNum}`);
      }
    });
  });

  for (let si = 1; si < sources.length; si++) {
    const source = sources[si]!;
    onProgress?.(Math.round((si / sources.length) * 45), `Summe ${si + 1}/${sources.length}: ${source.filename}`);
    let ws: ExcelJS.Worksheet;
    try {
      const loaded = await loadSheet(source);
      ws = loaded.ws;
    } catch (err) {
      warnings.push(`${source.filename} (${source.sheetName}): ${err instanceof Error ? err.message : String(err)}`);
      continue;
    }
    collectNumericSum(ws, runningSum, maxRef);
    collectStyleFallback(ws, templateEmptyCells, styleFallback);
    maxRow = Math.max(maxRow, maxRef.row);
    maxCol = Math.max(maxCol, maxRef.col);
  }

  const tempWb = new ExcelJS.Workbook();
  const summaryWs = tempWb.addWorksheet('Zusammenfassung');
  buildConsolidatedSheetFromSums(templateWs, runningSum, templateEmptyCells, styleFallback, maxRow, maxCol, summaryWs);

  const usedNames = new Set<string>();
  const summaryName = makeSheetNameUnique('Zusammenfassung', usedNames);

  if (process.env.EXCEL_STREAM === 'true') {
    type StreamWbType = { addWorksheet: (name: string) => StreamWs; commit: () => Promise<void> };
    const StreamWb = (ExcelJS as unknown as { stream?: { xlsx?: { WorkbookWriter: new (opts: { useStyles: boolean; useSharedStrings: boolean }) => StreamWbType } } }).stream?.xlsx?.WorkbookWriter;
    if (!StreamWb) throw new Error('ExcelJS streaming writer nicht verfügbar.');
    const streamWb = new StreamWb({ useStyles: false, useSharedStrings: false } as any);
    const destSummaryWs = streamWb.addWorksheet(summaryName) as StreamWs;
    await writeSheetToStream(destSummaryWs, summaryWs);
    onProgress?.(50, 'Schreibe Einzel-Sheets…');
    const baseNameCount = new Map<string, number>();
    for (let i = 0; i < sources.length; i++) {
      const source = sources[i]!;
      onProgress?.(50 + Math.round((i / sources.length) * 45), `Sheet ${i + 1}/${sources.length}: ${source.filename}`);
      let ws: ExcelJS.Worksheet;
      try {
        const loaded = await loadSheet(source);
        ws = loaded.ws;
      } catch {
        continue;
      }
      const baseName = source.filename.replace(/\.[^.]+$/, '');
      const countFromSameFile = (baseNameCount.get(baseName) ?? 0) + 1;
      baseNameCount.set(baseName, countFromSameFile);
      const rawName = countFromSameFile === 1 ? baseName : source.sheetName;
      const destName = makeSheetNameUnique(rawName, usedNames);
      const destWs = streamWb.addWorksheet(destName) as StreamWs;
      await writeSheetToStream(destWs, ws);
    }
    await flushStreamWorkbookToFile(streamWb as unknown as { commit: () => Promise<void>; stream: { toBuffer(): Buffer } }, outputFilePath);
    return;
  }

  // In-Memory (Standard)
  const workbook = new ExcelJS.Workbook();
  const destSummary = workbook.addWorksheet(summaryName);
  copyWorksheet(summaryWs, destSummary);
  onProgress?.(50, 'Schreibe Einzel-Sheets…');
  const baseNameCount = new Map<string, number>();
  for (let i = 0; i < sources.length; i++) {
    const source = sources[i]!;
    onProgress?.(50 + Math.round((i / sources.length) * 45), `Sheet ${i + 1}/${sources.length}: ${source.filename}`);
    let ws: ExcelJS.Worksheet;
    try {
      const loaded = await loadSheet(source);
      ws = loaded.ws;
    } catch {
      continue;
    }
    const baseName = source.filename.replace(/\.[^.]+$/, '');
    const countFromSameFile = (baseNameCount.get(baseName) ?? 0) + 1;
    baseNameCount.set(baseName, countFromSameFile);
    const rawName = countFromSameFile === 1 ? baseName : source.sheetName;
    const destName = makeSheetNameUnique(rawName, usedNames);
    const destWs = workbook.addWorksheet(destName);
    copyWorksheet(ws, destWs);
  }
  await writeWorkbookToFile(workbook, outputFilePath);
}

// ─────────────────────────────────────────────────────────────────────────────
// Modus F: Zeilenmatrix – jede Datei = eine Zeile, jede Quellzelle = eine Spalte
// ─────────────────────────────────────────────────────────────────────────────

/** Extrahiert ein lesbares Datum aus dem Dateinamen (DD.MM.YYYY), sonst Basename. */
function extractDateLabel(filename: string): string {
  const base = filename.replace(/\.[^.]+$/, '');
  const m = base.match(/(\d{1,2})[._\-/](\d{1,2})[._\-/](\d{2,4})/);
  if (m) {
    const day   = m[1]!.padStart(2, '0');
    const month = m[2]!.padStart(2, '0');
    const year  = m[3]!.length === 2 ? '20' + m[3] : m[3]!;
    return `${day}.${month}.${year}`;
  }
  return base;
}

type RawCell = number | string | null;

/** Liest einen einzelnen Zellwert aus einem ExcelJS-Cell-Objekt. */
function extractCellValue(cell: ExcelJS.Cell): RawCell {
  const v = cell.value;
  if (typeof v === 'number') return v;
  if (typeof v === 'string') return v;
  if (v !== null && v !== undefined && typeof v === 'object') {
    if ('formula' in v || 'sharedFormula' in v) {
      const r = (v as ExcelJS.CellFormulaValue).result;
      return typeof r === 'number' ? r : typeof r === 'string' ? r : null;
    }
    if ('text' in v) return String((v as { text: string }).text);
    if ('richText' in v) {
      const rt = (v as { richText: Array<{ text: string }> }).richText;
      return rt.map((p) => p.text).join('');
    }
  }
  return null;
}

/**
 * Liest das vollständige Zellraster eines Worksheets.
 * Gibt ein 2D-Array [row][col] mit 0-basierten Indizes zurück.
 * Leere Zellen werden als null gespeichert.
 * Gibt auch die tatsächlich belegten Dimensionen zurück.
 */
function readFullGrid(ws: ExcelJS.Worksheet): { grid: RawCell[][]; rows: number; cols: number } {
  const grid: RawCell[][] = [];
  let maxCol = 0;

  ws.eachRow({ includeEmpty: true }, (row, rowNumber) => {
    const rowArr: RawCell[] = [];
    let lastNonNull = -1;

    // row.values ist ein sparse Array mit 1-basiertem Index
    const vals = row.values as (ExcelJS.CellValue | null | undefined)[];
    const cellCount = vals.length; // length = lastCol + 1

    for (let c = 1; c < cellCount; c++) {
      // Direkt über getCell für korrekte Werte (inkl. merged cells)
      const cell = row.getCell(c);
      const v = extractCellValue(cell);
      rowArr[c - 1] = v;
      if (v !== null) lastNonNull = c - 1;
    }

    // Auf lastNonNull trimmen (trailing nulls entfernen macht Grid kompakter)
    // ABER: wir merken uns das Maximum für die Gesamtbreite
    maxCol = Math.max(maxCol, lastNonNull + 1);

    // Zeile ins Grid schreiben (1-basiert → 0-basiert)
    while (grid.length < rowNumber) grid.push([]);
    grid[rowNumber - 1] = rowArr;
  });

  // Letzte wirklich nicht-leere Zeile finden
  let maxRow = 0;
  for (let r = grid.length - 1; r >= 0; r--) {
    if ((grid[r] ?? []).some((v) => v !== null)) { maxRow = r + 1; break; }
  }

  return { grid, rows: maxRow, cols: maxCol };
}

/** Konvertiert 0-basierten Spaltenindex in Excel-Spaltenbuchstaben (A, B, ..., Z, AA, AB, ...) */
function colIndexToLetter(idx: number): string {
  let s = '';
  let n = idx + 1;
  while (n > 0) {
    const rem = (n - 1) % 26;
    s = String.fromCharCode(65 + rem) + s;
    n = Math.floor((n - 1) / 26);
  }
  return s;
}

/**
 * Modus F – Zeilenmatrix.
 * Standard: In-Memory für in Excel öffnbare XLSX. Optional: EXCEL_STREAM=true für Streaming.
 * addSumRow = true: letzte Zeile „Gesamt“ mit Spaltensummen.
 */
async function mergeRowPerFile(
  sources: SheetSourceRef[],
  addSumRow: boolean,
  outputFilePath: string,
  warnings: string[],
  onProgress?: (pct: number, msg: string) => void,
): Promise<void> {
  const C = {
    hdrBg: 'FF1E293B', odd: 'FF0A1628', even: 'FF0F1F35',
    totalBg: 'FF064E3B', border: 'FF1E3A5F', hdrFg: 'FFE2E8F0',
    dataFg: 'FFCBD5E1', totalFg: 'FF34D399', numFg: 'FF7DD3FC',
  };
  const bThin: Partial<ExcelJS.Border> = { style: 'thin', color: { argb: C.border } };
  const bMid: Partial<ExcelJS.Border> = { style: 'medium', color: { argb: C.border } };

  const validSources: SheetSourceRef[] = [];
  const activeColsSet = new Set<string>();
  let globalRows = 0;
  let globalCols = 0;
  // ── Pass 1: Metadaten + aktive Zellen ────────────────────────────────────
  for (let si = 0; si < sources.length; si++) {
    const source = sources[si]!;
    onProgress?.(Math.round((si / sources.length) * 45), `Metadaten ${si + 1}/${sources.length}: ${source.filename}`);
    let srcWs: ExcelJS.Worksheet;
    try {
      const { ws } = await loadSheet(source);
      srcWs = ws;
    } catch (err) {
      warnings.push(`${source.filename} (${source.sheetName}): ${err instanceof Error ? err.message : String(err)}`);
      continue;
    }

    const { grid, rows, cols } = readFullGrid(srcWs);
    globalRows = Math.max(globalRows, rows);
    globalCols = Math.max(globalCols, cols);
    for (let r = 0; r < rows; r++) {
      for (let c = 0; c < cols; c++) {
        if ((grid[r]?.[c] ?? null) !== null) activeColsSet.add(`${r},${c}`);
      }
    }
    validSources.push(source);
  }

  if (validSources.length === 0) {
    const empty = new ExcelJS.Workbook();
    empty.addWorksheet('Übersicht');
    await writeWorkbookToFile(empty, outputFilePath);
    return;
  }

  const activeCols: [number, number][] = [];
  for (let r = 0; r < globalRows; r++) {
    for (let c = 0; c < globalCols; c++) {
      if (activeColsSet.has(`${r},${c}`)) activeCols.push([r, c]);
    }
  }

  const grandTotals: number[] = addSumRow ? new Array(activeCols.length).fill(0) : [];
  const FILL = [C.odd, C.even];

  if (process.env.EXCEL_STREAM === 'true') {
    const StreamWb = (ExcelJS as unknown as { stream?: { xlsx?: { WorkbookWriter: new (opts: { useStyles: boolean; useSharedStrings: boolean }) => { addWorksheet: (n: string) => StreamWs; commit: () => Promise<void> } } } }).stream?.xlsx?.WorkbookWriter;
    if (!StreamWb) throw new Error('ExcelJS streaming writer nicht verfügbar.');
    const streamWb = new StreamWb({ useStyles: false, useSharedStrings: false } as any);
    const ws = streamWb.addWorksheet('Übersicht');
  ws.getColumn(1).width = 14;
  for (let i = 2; i <= activeCols.length + 1; i++) ws.getColumn(i).width = 11;
  try {
    (ws as unknown as { views?: unknown[] }).views = [{ state: 'frozen', xSplit: 1, ySplit: 1, activeCell: 'B2' }];
  } catch { /* ignore */ }
  const hdr1: string[] = ['Datei / Datum'];
  for (const [r, c] of activeCols) hdr1.push(`${colIndexToLetter(c)}${r + 1}`);
  const hdrRow1 = ws.getRow(1);
  hdrRow1.height = 20;
  hdrRow1.values = hdr1;
  hdrRow1.font = { bold: true, size: 9, color: { argb: C.hdrFg } };
  hdrRow1.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: C.hdrBg } };
  hdrRow1.eachCell((cell, col) => {
    cell.alignment = { vertical: 'middle', horizontal: col === 1 ? 'left' : 'center' };
    cell.border = { bottom: bMid, top: bThin, left: bThin, right: bThin };
  });
  hdrRow1.commit();
  onProgress?.(50, 'Schreibe Zeilen…');
  const fileSourceCount = new Map<string, number>();
  for (let si = 0; si < validSources.length; si++) {
    const source = validSources[si]!;
    onProgress?.(50 + Math.round((si / validSources.length) * 45), `Sheet ${si + 1}/${validSources.length}: ${source.filename}`);
    let srcWs: ExcelJS.Worksheet;
    try {
      const { ws: w } = await loadSheet(source);
      srcWs = w;
    } catch {
      continue;
    }
    const { grid } = readFullGrid(srcWs);
    const baseLabel = extractDateLabel(source.filename);
    const countFromSameFile = (fileSourceCount.get(source.filename) ?? 0) + 1;
    fileSourceCount.set(source.filename, countFromSameFile);
    const label = countFromSameFile === 1 ? baseLabel : `${baseLabel} • ${source.sheetName}`;
    const rowData: RawCell[] = [label];
    for (let i = 0; i < activeCols.length; i++) {
      const [r, c] = activeCols[i]!;
      const v = grid[r]?.[c] ?? null;
      rowData.push(v);
      if (addSumRow && typeof v === 'number') grandTotals[i] += v;
    }
    const destRowNum = 2 + si;
    const row = ws.getRow(destRowNum);
    row.height = 16;
    row.values = rowData;
    row.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: FILL[si % 2]! } };
    const dateCell = row.getCell(1);
    dateCell.font = { bold: true, size: 9, color: { argb: C.hdrFg } };
    dateCell.alignment = { vertical: 'middle', horizontal: 'left' };
    dateCell.border = { bottom: bThin, top: bThin, left: bThin, right: bMid };
    for (let i = 0; i < activeCols.length; i++) {
      const cell = row.getCell(i + 2);
      const v = rowData[i + 1];
      if (typeof v === 'number') {
        cell.numFmt = '#,##0.00';
        cell.font = { size: 9, color: { argb: C.numFg } };
        cell.alignment = { vertical: 'middle', horizontal: 'right' };
      } else {
        cell.font = { size: 9, color: { argb: C.dataFg } };
        cell.alignment = { vertical: 'middle', horizontal: 'left' };
      }
      cell.border = { bottom: bThin, top: bThin, left: bThin, right: bThin };
    }
    row.commit();
  }
  if (addSumRow && validSources.length > 0) {
    const totalData: RawCell[] = ['Gesamt', ...grandTotals.map((v) => v)];
    const totalRowNum = 2 + validSources.length;
    const totalRow = ws.getRow(totalRowNum);
    totalRow.height = 20;
    totalRow.values = totalData;
    totalRow.font = { bold: true, size: 9, color: { argb: C.totalFg } };
    totalRow.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: C.totalBg } };
    totalRow.getCell(1).alignment = { vertical: 'middle', horizontal: 'left' };
    totalRow.getCell(1).border = { top: bMid, bottom: bMid, left: bThin, right: bMid };
    for (let i = 0; i < activeCols.length; i++) {
      const cell = totalRow.getCell(i + 2);
      const v = grandTotals[i];
      if (typeof v === 'number') cell.numFmt = '#,##0.00';
      cell.alignment = { vertical: 'middle', horizontal: 'right' };
      cell.border = { top: bMid, bottom: bMid, left: bThin, right: bThin };
    }
    totalRow.commit();
  }
  await flushStreamWorkbookToFile(streamWb as unknown as { commit: () => Promise<void>; stream: { toBuffer(): Buffer } }, outputFilePath);
  return;
  }

  // In-Memory (Standard)
  const workbook = new ExcelJS.Workbook();
  const ws = workbook.addWorksheet('Übersicht');
  ws.getColumn(1).width = 14;
  for (let i = 2; i <= activeCols.length + 1; i++) ws.getColumn(i).width = 11;
  try {
    (ws as unknown as { views?: unknown[] }).views = [{ state: 'frozen', xSplit: 1, ySplit: 1, activeCell: 'B2' }];
  } catch { /* ignore */ }
  const hdr1: string[] = ['Datei / Datum'];
  for (const [r, c] of activeCols) hdr1.push(`${colIndexToLetter(c)}${r + 1}`);
  const hdrRow1 = ws.getRow(1);
  hdrRow1.height = 20;
  hdrRow1.values = hdr1;
  hdrRow1.font = { bold: true, size: 9, color: { argb: C.hdrFg } };
  hdrRow1.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: C.hdrBg } };
  hdrRow1.eachCell((cell, col) => {
    cell.alignment = { vertical: 'middle', horizontal: col === 1 ? 'left' : 'center' };
    cell.border = { bottom: bMid, top: bThin, left: bThin, right: bThin };
  });
  onProgress?.(50, 'Schreibe Zeilen…');
  const fileSourceCount = new Map<string, number>();
  for (let si = 0; si < validSources.length; si++) {
    const source = validSources[si]!;
    onProgress?.(50 + Math.round((si / validSources.length) * 45), `Sheet ${si + 1}/${validSources.length}: ${source.filename}`);
    let srcWs: ExcelJS.Worksheet;
    try {
      const { ws: w } = await loadSheet(source);
      srcWs = w;
    } catch {
      continue;
    }
    const { grid } = readFullGrid(srcWs);
    const baseLabel = extractDateLabel(source.filename);
    const countFromSameFile = (fileSourceCount.get(source.filename) ?? 0) + 1;
    fileSourceCount.set(source.filename, countFromSameFile);
    const label = countFromSameFile === 1 ? baseLabel : `${baseLabel} • ${source.sheetName}`;
    const rowData: RawCell[] = [label];
    for (let i = 0; i < activeCols.length; i++) {
      const [r, c] = activeCols[i]!;
      const v = grid[r]?.[c] ?? null;
      rowData.push(v);
      if (addSumRow && typeof v === 'number') grandTotals[i] += v;
    }
    const destRowNum = 2 + si;
    const row = ws.getRow(destRowNum);
    row.height = 16;
    row.values = rowData;
    row.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: FILL[si % 2]! } };
    const dateCell = row.getCell(1);
    dateCell.font = { bold: true, size: 9, color: { argb: C.hdrFg } };
    dateCell.alignment = { vertical: 'middle', horizontal: 'left' };
    dateCell.border = { bottom: bThin, top: bThin, left: bThin, right: bMid };
    for (let i = 0; i < activeCols.length; i++) {
      const cell = row.getCell(i + 2);
      const v = rowData[i + 1];
      if (typeof v === 'number') {
        cell.numFmt = '#,##0.00';
        cell.font = { size: 9, color: { argb: C.numFg } };
        cell.alignment = { vertical: 'middle', horizontal: 'right' };
      } else {
        cell.font = { size: 9, color: { argb: C.dataFg } };
        cell.alignment = { vertical: 'middle', horizontal: 'left' };
      }
      cell.border = { bottom: bThin, top: bThin, left: bThin, right: bThin };
    }
  }
  if (addSumRow && validSources.length > 0) {
    const totalData: RawCell[] = ['Gesamt', ...grandTotals.map((v) => v)];
    const totalRowNum = 2 + validSources.length;
    const totalRow = ws.getRow(totalRowNum);
    totalRow.height = 20;
    totalRow.values = totalData;
    totalRow.font = { bold: true, size: 9, color: { argb: C.totalFg } };
    totalRow.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: C.totalBg } };
    totalRow.getCell(1).alignment = { vertical: 'middle', horizontal: 'left' };
    totalRow.getCell(1).border = { top: bMid, bottom: bMid, left: bThin, right: bMid };
    for (let i = 0; i < activeCols.length; i++) {
      const cell = totalRow.getCell(i + 2);
      const v = grandTotals[i];
      if (typeof v === 'number') cell.numFmt = '#,##0.00';
      cell.alignment = { vertical: 'middle', horizontal: 'right' };
      cell.border = { top: bMid, bottom: bMid, left: bThin, right: bThin };
    }
  }
  await writeWorkbookToFile(workbook, outputFilePath);
}
