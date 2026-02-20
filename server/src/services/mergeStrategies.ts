import ExcelJS from 'exceljs';
import type { MergeMode, SpreadsheetMergeOptions } from 'shared';

export type SheetSource = {
  filename: string;
  sheetName: string;
  sheetIndex: number;
  rows: string[][];
  headers: string[];
};

/**
 * Strategie-Interface: erweiterbar für neue Merge-Modi.
 */
export interface MergeStrategy {
  mode: MergeMode;
  execute(
    sources: SheetSource[],
    options: SpreadsheetMergeOptions
  ): Promise<{ workbook: ExcelJS.Workbook }>;
}

/** A: Alle Dateien → eine Tabelle, Spalten-Union, fehlende Werte leer. */
export const allToOneSheet: MergeStrategy = {
  mode: 'all_to_one_sheet',
  async execute(sources, _options) {
    const workbook = new ExcelJS.Workbook();
    const ws = workbook.addWorksheet('Merged', { views: [{ state: 'frozen', ySplit: 1 }] });

    const allHeaders = new Set<string>();
    for (const s of sources) {
      for (const h of s.headers) allHeaders.add(h);
    }
    const headerRow = Array.from(allHeaders);
    ws.addRow(headerRow);
    const headerIndex = new Map(headerRow.map((h, i) => [h, i]));

    for (const s of sources) {
      const startRow = s.headers.length ? 1 : 0;
      for (let i = startRow; i < s.rows.length; i++) {
        const row = s.rows[i] ?? [];
        const outRow: string[] = new Array(headerRow.length).fill('');
        s.headers.forEach((h, j) => {
          const idx = headerIndex.get(h);
          if (idx !== undefined && row[j] !== undefined) outRow[idx] = row[j] ?? '';
        });
        ws.addRow(outRow);
      }
    }
    return { workbook };
  },
};

/** B: Eine Datei = ein Sheet, Sheetname = Dateiname (ohne Extension). */
export const oneFilePerSheet: MergeStrategy = {
  mode: 'one_file_per_sheet',
  async execute(sources, _options) {
    const workbook = new ExcelJS.Workbook();
    const baseName = (f: string) => f.replace(/\.[^.]+$/, '').slice(0, 31);

    for (const s of sources) {
      const name = baseName(s.filename);
      const ws = workbook.addWorksheet(name, { views: [{ state: 'frozen', ySplit: 1 }] });
      if (s.rows.length) ws.addRow(s.rows[0]);
      for (let i = 1; i < s.rows.length; i++) {
        ws.addRow(s.rows[i] ?? []);
      }
    }
    return { workbook };
  },
};

/** C: Alle in ein Sheet + Spalte source_file. */
export const allWithSourceColumn: MergeStrategy = {
  mode: 'all_with_source_column',
  async execute(sources, _options) {
    const workbook = new ExcelJS.Workbook();
    const ws = workbook.addWorksheet('Merged', { views: [{ state: 'frozen', ySplit: 1 }] });

    const allHeaders = new Set<string>();
    for (const s of sources) {
      for (const h of s.headers) allHeaders.add(h);
    }
    const headerRow = ['source_file', ...Array.from(allHeaders)];
    ws.addRow(headerRow);
    const headerIndex = new Map(headerRow.map((h, i) => [h, i]));
    const srcIdx = 0;

    for (const s of sources) {
      const startRow = s.headers.length ? 1 : 0;
      for (let i = startRow; i < s.rows.length; i++) {
        const row = s.rows[i] ?? [];
        const outRow: string[] = new Array(headerRow.length).fill('');
        outRow[srcIdx] = s.filename;
        s.headers.forEach((h, j) => {
          const idx = headerIndex.get(h);
          if (idx !== undefined && row[j] !== undefined) outRow[idx] = row[j] ?? '';
        });
        ws.addRow(outRow);
      }
    }
    return { workbook };
  },
};

const registry: Map<MergeMode, MergeStrategy> = new Map([
  [allToOneSheet.mode, allToOneSheet],
  [oneFilePerSheet.mode, oneFilePerSheet],
  [allWithSourceColumn.mode, allWithSourceColumn],
]);

export function getMergeStrategy(mode: MergeMode): MergeStrategy {
  const s = registry.get(mode);
  if (!s) throw new Error(`Unbekannter Merge-Modus: ${mode}`);
  return s;
}
