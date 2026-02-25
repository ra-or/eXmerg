import type { MergeMode } from 'shared';
import { readSpreadsheetToSources } from '../processing/readSpreadsheet.js';
import { readFile } from 'fs/promises';

const PREVIEW_MAX_ROWS_PER_SOURCE = 5;

export interface PreviewResult {
  headers: string[];
  rows: string[][];
  totalSourceRows: number;
  mode: MergeMode;
}

interface PreviewSource {
  filename: string;
  sheetName: string;
  headers: string[];
  rows: string[][];
}

async function loadPreviewSources(files: Array<{ path: string; filename: string }>): Promise<PreviewSource[]> {
  const sources: PreviewSource[] = [];
  for (const f of files) {
    try {
      const buffer = await readFile(f.path);
      const sheetSources = await readSpreadsheetToSources(buffer, f.filename);
      for (const s of sheetSources) {
        sources.push({
          filename: s.filename,
          sheetName: s.sheetName,
          headers: s.headers,
          rows: s.rows.slice(0, PREVIEW_MAX_ROWS_PER_SOURCE + 1),
        });
      }
    } catch {
      // skip unreadable files
    }
  }
  return sources;
}

function previewAllToOneSheet(sources: PreviewSource[]): PreviewResult {
  const allHeaders = new Set<string>();
  for (const s of sources) for (const h of s.headers) allHeaders.add(h);
  const headers = Array.from(allHeaders);
  const headerIndex = new Map(headers.map((h, i) => [h, i]));

  const rows: string[][] = [];
  let totalSourceRows = 0;

  for (const s of sources) {
    const startRow = s.headers.length ? 1 : 0;
    totalSourceRows += Math.max(0, s.rows.length - startRow);
    for (let i = startRow; i < s.rows.length; i++) {
      const row = s.rows[i] ?? [];
      const outRow: string[] = new Array(headers.length).fill('');
      s.headers.forEach((h, j) => {
        const idx = headerIndex.get(h);
        if (idx !== undefined && row[j] !== undefined) outRow[idx] = row[j] ?? '';
      });
      rows.push(outRow);
    }
  }

  return { headers, rows, totalSourceRows, mode: 'all_to_one_sheet' };
}

function previewOneFilePerSheet(sources: PreviewSource[]): PreviewResult {
  const firstSource = sources[0];
  if (!firstSource) return { headers: [], rows: [], totalSourceRows: 0, mode: 'one_file_per_sheet' };

  const headers = firstSource.headers;
  const rows = firstSource.rows.slice(firstSource.headers.length ? 1 : 0);
  const totalSourceRows = rows.length;

  return {
    headers: [...headers, '(Sheet)'],
    rows: rows.map((r) => [...r, firstSource.filename.replace(/\.[^.]+$/, '')]),
    totalSourceRows,
    mode: 'one_file_per_sheet',
  };
}

function previewWithSourceColumn(sources: PreviewSource[]): PreviewResult {
  const allHeaders = new Set<string>();
  for (const s of sources) for (const h of s.headers) allHeaders.add(h);
  const headers = ['source_file', ...Array.from(allHeaders)];
  const headerIndex = new Map(headers.map((h, i) => [h, i]));

  const rows: string[][] = [];
  let totalSourceRows = 0;

  for (const s of sources) {
    const startRow = s.headers.length ? 1 : 0;
    totalSourceRows += Math.max(0, s.rows.length - startRow);
    for (let i = startRow; i < s.rows.length; i++) {
      const row = s.rows[i] ?? [];
      const outRow: string[] = new Array(headers.length).fill('');
      outRow[0] = s.filename;
      s.headers.forEach((h, j) => {
        const idx = headerIndex.get(h);
        if (idx !== undefined && row[j] !== undefined) outRow[idx] = row[j] ?? '';
      });
      rows.push(outRow);
    }
  }

  return { headers, rows, totalSourceRows, mode: 'all_with_source_column' };
}

function previewConsolidated(sources: PreviewSource[]): PreviewResult {
  const allHeaders = new Set<string>();
  for (const s of sources) for (const h of s.headers) allHeaders.add(h);
  const headers = Array.from(allHeaders);
  const headerIndex = new Map(headers.map((h, i) => [h, i]));

  const sumRow: number[] = new Array(headers.length).fill(0);
  let totalSourceRows = 0;

  for (const s of sources) {
    const startRow = s.headers.length ? 1 : 0;
    totalSourceRows += Math.max(0, s.rows.length - startRow);
    for (let i = startRow; i < s.rows.length; i++) {
      const row = s.rows[i] ?? [];
      s.headers.forEach((h, j) => {
        const idx = headerIndex.get(h);
        if (idx !== undefined) {
          const num = Number(row[j]);
          if (!isNaN(num)) sumRow[idx] += num;
        }
      });
    }
  }

  return {
    headers: ['(Zusammenfassung)', ...headers],
    rows: [['Σ Summe', ...sumRow.map(String)]],
    totalSourceRows,
    mode: 'consolidated_sheets',
  };
}

function previewRowPerFile(sources: PreviewSource[], withSum: boolean): PreviewResult {
  if (sources.length === 0)
    return { headers: [], rows: [], totalSourceRows: 0, mode: withSum ? 'row_per_file' : 'row_per_file_no_sum' };

  const maxCols = Math.max(...sources.map((s) => Math.max(...s.rows.map((r) => r.length), 0)));
  const colHeaders = Array.from({ length: maxCols }, (_, i) => {
    const col = String.fromCharCode(65 + (i % 26));
    return i < 26 ? `${col}1` : `${String.fromCharCode(65 + Math.floor(i / 26) - 1)}${col}1`;
  });
  const headers = ['Datei', ...colHeaders];

  const rows: string[][] = [];
  for (const s of sources) {
    const firstDataRow = s.rows[s.headers.length ? 1 : 0] ?? [];
    rows.push([s.filename, ...firstDataRow]);
  }

  if (withSum) {
    const sumRow: string[] = ['Σ Summe'];
    for (let c = 0; c < maxCols; c++) {
      let sum = 0;
      let hasNum = false;
      for (const s of sources) {
        const dataRow = s.rows[s.headers.length ? 1 : 0] ?? [];
        const num = Number(dataRow[c]);
        if (!isNaN(num) && dataRow[c] !== '') {
          sum += num;
          hasNum = true;
        }
      }
      sumRow.push(hasNum ? String(sum) : '');
    }
    rows.push(sumRow);
  }

  return {
    headers,
    rows,
    totalSourceRows: sources.length,
    mode: withSum ? 'row_per_file' : 'row_per_file_no_sum',
  };
}

export async function generateMergePreview(
  files: Array<{ path: string; filename: string }>,
  mode: MergeMode,
): Promise<PreviewResult> {
  const sources = await loadPreviewSources(files);
  if (sources.length === 0) {
    return { headers: [], rows: [], totalSourceRows: 0, mode };
  }

  switch (mode) {
    case 'all_to_one_sheet':
      return previewAllToOneSheet(sources);
    case 'one_file_per_sheet':
      return previewOneFilePerSheet(sources);
    case 'all_with_source_column':
      return previewWithSourceColumn(sources);
    case 'consolidated_sheets':
      return previewConsolidated(sources);
    case 'row_per_file':
      return previewRowPerFile(sources, true);
    case 'row_per_file_no_sum':
      return previewRowPerFile(sources, false);
    default:
      return previewAllToOneSheet(sources);
  }
}
