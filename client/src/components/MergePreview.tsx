import { useMemo, useState } from 'react';
import { useStore } from '../store/useStore';
import { useT } from '../i18n';
import type { MergeMode } from 'shared';

interface PreviewData {
  headers: string[];
  rows: string[][];
  info: string;
}

const MAX_PREVIEW_ROWS = 10;
const MAX_PREVIEW_COLS = 12;

interface SourceData {
  filename: string;
  sheetName: string;
  previewRows: string[][];
}

function colLetter(idx: number): string {
  let s = '';
  let n = idx + 1;
  while (n > 0) {
    const rem = (n - 1) % 26;
    s = String.fromCharCode(65 + rem) + s;
    n = Math.floor((n - 1) / 26);
  }
  return s;
}

function extractDateLabel(filename: string): string {
  const base = filename.replace(/\.[^.]+$/, '');
  const m = base.match(/(\d{1,2})[._\-/](\d{1,2})[._\-/](\d{2,4})/);
  if (m) {
    const day = m[1]!.padStart(2, '0');
    const month = m[2]!.padStart(2, '0');
    const year = m[3]!.length === 2 ? '20' + m[3] : m[3]!;
    return `${day}.${month}.${year}`;
  }
  return base;
}

function buildPreview(sources: SourceData[], mode: MergeMode): PreviewData | null {
  if (sources.length === 0) return null;

  switch (mode) {
    case 'all_to_one_sheet':
      return previewAllToOne(sources);
    case 'all_with_source_column':
      return previewWithSource(sources);
    case 'one_file_per_sheet':
      return previewOnePerSheet(sources);
    case 'consolidated_sheets':
      return previewConsolidated(sources);
    case 'row_per_file':
      return previewRowMatrix(sources, true);
    case 'row_per_file_no_sum':
      return previewRowMatrix(sources, false);
    default:
      return previewAllToOne(sources);
  }
}

function previewAllToOne(sources: SourceData[]): PreviewData {
  const allHeaders = new Set<string>();
  for (const s of sources) {
    const h = s.previewRows[0];
    if (h) for (const col of h) if (col) allHeaders.add(col);
  }
  const headers = Array.from(allHeaders);
  const headerIdx = new Map(headers.map((h, i) => [h, i]));
  const rows: string[][] = [];

  for (const s of sources) {
    const srcHeaders = s.previewRows[0] ?? [];
    for (let i = 1; i < s.previewRows.length; i++) {
      const row = s.previewRows[i] ?? [];
      const outRow = new Array(headers.length).fill('');
      srcHeaders.forEach((h, j) => {
        const idx = headerIdx.get(h);
        if (idx !== undefined) outRow[idx] = row[j] ?? '';
      });
      rows.push(outRow);
    }
  }

  return { headers, rows, info: `${rows.length}+` };
}

function previewWithSource(sources: SourceData[]): PreviewData {
  const allHeaders = new Set<string>();
  for (const s of sources) {
    const h = s.previewRows[0];
    if (h) for (const col of h) if (col) allHeaders.add(col);
  }
  const headers = ['source_file', ...Array.from(allHeaders)];
  const headerIdx = new Map(headers.map((h, i) => [h, i]));
  const rows: string[][] = [];

  for (const s of sources) {
    const srcHeaders = s.previewRows[0] ?? [];
    for (let i = 1; i < s.previewRows.length; i++) {
      const row = s.previewRows[i] ?? [];
      const outRow = new Array(headers.length).fill('');
      outRow[0] = s.filename;
      srcHeaders.forEach((h, j) => {
        const idx = headerIdx.get(h);
        if (idx !== undefined) outRow[idx] = row[j] ?? '';
      });
      rows.push(outRow);
    }
  }

  return { headers, rows, info: `${rows.length}+` };
}

function previewOnePerSheet(sources: SourceData[]): PreviewData {
  const first = sources[0];
  if (!first || !first.previewRows.length) return { headers: [], rows: [], info: '' };

  const headers = first.previewRows[0] ?? [];
  const rows = first.previewRows.slice(1);

  return {
    headers: [...headers],
    rows,
    info: `${sources.length} sheets · ${first.filename.replace(/\.[^.]+$/, '')}`,
  };
}

function previewConsolidated(sources: SourceData[]): PreviewData {
  const allHeaders = new Set<string>();
  for (const s of sources) {
    const h = s.previewRows[0];
    if (h) for (const col of h) if (col) allHeaders.add(col);
  }
  const headers = Array.from(allHeaders);
  const headerIdx = new Map(headers.map((h, i) => [h, i]));
  const sums = new Array(headers.length).fill(0);
  const hasValues = new Array(headers.length).fill(false);

  for (const s of sources) {
    const srcHeaders = s.previewRows[0] ?? [];
    for (let i = 1; i < s.previewRows.length; i++) {
      const row = s.previewRows[i] ?? [];
      srcHeaders.forEach((h, j) => {
        const idx = headerIdx.get(h);
        if (idx !== undefined) {
          const val = row[j] ?? '';
          const num = Number(val);
          if (val !== '' && !isNaN(num)) {
            sums[idx] += num;
            hasValues[idx] = true;
          }
        }
      });
    }
  }

  const summaryRow = headers.map((_, i) => (hasValues[i] ? String(sums[i]) : ''));
  const rows: string[][] = [['Σ Zusammenfassung', ...summaryRow]];

  for (const s of sources) {
    const srcHeaders = s.previewRows[0] ?? [];
    for (let i = 1; i < Math.min(s.previewRows.length, 3); i++) {
      const row = s.previewRows[i] ?? [];
      const outRow = new Array(headers.length).fill('');
      srcHeaders.forEach((h, j) => {
        const idx = headerIdx.get(h);
        if (idx !== undefined) outRow[idx] = row[j] ?? '';
      });
      rows.push([`  ${s.filename}`, ...outRow]);
    }
  }

  return {
    headers: ['', ...headers],
    rows,
    info: `${sources.length} sources`,
  };
}

/**
 * Zeilenmatrix: each file becomes ONE row. ALL cells from the file are flattened
 * into columns with cell-reference headers (A1, B1, ..., A2, B2, ...).
 */
function previewRowMatrix(sources: SourceData[], withSum: boolean): PreviewData {
  const activeCols: Array<{ row: number; col: number; ref: string }> = [];
  let maxRow = 0;
  let maxCol = 0;

  for (const s of sources) {
    for (let r = 0; r < s.previewRows.length; r++) {
      const row = s.previewRows[r] ?? [];
      for (let c = 0; c < row.length; c++) {
        if (row[c] && row[c] !== '') {
          maxRow = Math.max(maxRow, r + 1);
          maxCol = Math.max(maxCol, c + 1);
        }
      }
    }
  }

  const activeSet = new Set<string>();
  for (const s of sources) {
    for (let r = 0; r < maxRow; r++) {
      const row = s.previewRows[r] ?? [];
      for (let c = 0; c < maxCol; c++) {
        const key = `${r},${c}`;
        if (!activeSet.has(key) && row[c] && row[c] !== '') {
          activeSet.add(key);
          activeCols.push({ row: r, col: c, ref: `${colLetter(c)}${r + 1}` });
        }
      }
    }
  }

  activeCols.sort((a, b) => (a.row !== b.row ? a.row - b.row : a.col - b.col));

  const limitedCols = activeCols.slice(0, MAX_PREVIEW_COLS);
  const headers = ['Datei / Datum', ...limitedCols.map((c) => c.ref)];
  if (activeCols.length > MAX_PREVIEW_COLS) {
    headers.push(`… +${activeCols.length - MAX_PREVIEW_COLS}`);
  }

  const rows: string[][] = [];
  for (const s of sources) {
    const label = extractDateLabel(s.filename);
    const outRow = [label];
    for (const ac of limitedCols) {
      const val = s.previewRows[ac.row]?.[ac.col] ?? '';
      outRow.push(val);
    }
    if (activeCols.length > MAX_PREVIEW_COLS) outRow.push('…');
    rows.push(outRow);
  }

  if (withSum) {
    const sumRow = ['Σ Gesamt'];
    for (const ac of limitedCols) {
      let sum = 0;
      let hasNum = false;
      for (const s of sources) {
        const val = s.previewRows[ac.row]?.[ac.col] ?? '';
        const num = Number(val);
        if (val !== '' && !isNaN(num)) {
          sum += num;
          hasNum = true;
        }
      }
      sumRow.push(hasNum ? String(sum) : '');
    }
    if (activeCols.length > MAX_PREVIEW_COLS) sumRow.push('');
    rows.push(sumRow);
  }

  return {
    headers,
    rows,
    info: `${sources.length} × ${activeCols.length} cells`,
  };
}

export function MergePreview() {
  const t = useT();
  const files = useStore((s) => s.files);
  const sheetInfo = useStore((s) => s.sheetInfo);
  const mode = useStore((s) => s.mergeOptions.mode);
  const [collapsed, setCollapsed] = useState(false);

  const sources = useMemo(() => {
    const result: SourceData[] = [];
    for (const f of files) {
      const info = sheetInfo[f.id];
      if (!info?.sheets?.length) continue;
      for (const sheet of info.sheets) {
        if (sheet.previewRows?.length) {
          result.push({ filename: f.filename, sheetName: sheet.name, previewRows: sheet.previewRows });
        }
      }
    }
    return result;
  }, [files, sheetInfo]);

  const preview = useMemo(() => (mode ? buildPreview(sources, mode) : null), [sources, mode]);

  if (files.length < 2 || !preview || preview.headers.length === 0) return null;

  if (collapsed) {
    return (
      <button
        type="button"
        onClick={() => setCollapsed(false)}
        className="flex items-center gap-2 text-xs text-zinc-500 hover:text-zinc-300 transition-colors px-1 py-1"
      >
        <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M9 5l7 7-7 7" />
        </svg>
        {t('preview.title')}
      </button>
    );
  }

  return (
    <div className="rounded-lg border border-zinc-200 dark:border-surface-600 bg-zinc-100 dark:bg-surface-800 overflow-hidden">
      <div className="flex items-center justify-between px-3 py-2 border-b border-zinc-200 dark:border-surface-600">
        <div className="flex items-center gap-2">
          <svg
            className="w-3.5 h-3.5 text-emerald-500"
            fill="none"
            viewBox="0 0 24 24"
            stroke="currentColor"
            strokeWidth={2}
          >
            <path strokeLinecap="round" strokeLinejoin="round" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z"
            />
          </svg>
          <span className="text-xs font-medium text-zinc-700 dark:text-zinc-300">{t('preview.title')}</span>
          <span className="text-xs text-zinc-500">
            ({preview.info} {t('preview.rows')})
          </span>
        </div>
        <button
          type="button"
          onClick={() => setCollapsed(true)}
          className="text-zinc-500 hover:text-zinc-300 p-0.5 rounded transition-colors"
        >
          <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7" />
          </svg>
        </button>
      </div>

      <div className="overflow-x-auto max-h-72">
        <table className="w-full text-xs border-collapse">
          <thead>
            <tr className="bg-zinc-200 dark:bg-surface-700 sticky top-0">
              {preview.headers.map((h, i) => (
                <th
                  key={i}
                  className="px-2 py-1.5 text-left font-semibold text-zinc-700 dark:text-zinc-300 border-b border-zinc-300 dark:border-surface-500 whitespace-nowrap"
                >
                  {h || '—'}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {preview.rows.slice(0, MAX_PREVIEW_ROWS).map((row, ri) => {
              const isSumRow = row[0]?.startsWith('Σ');
              return (
                <tr
                  key={ri}
                  className={
                    isSumRow
                      ? 'bg-emerald-500/10 font-semibold text-emerald-400'
                      : 'hover:bg-zinc-200/50 dark:hover:bg-surface-700/50'
                  }
                >
                  {preview.headers.map((_, ci) => (
                    <td
                      key={ci}
                      className={[
                        'px-2 py-1 border-b border-zinc-200 dark:border-surface-600 whitespace-nowrap max-w-[180px] truncate',
                        isSumRow ? 'text-emerald-400' : 'text-zinc-600 dark:text-zinc-400',
                      ].join(' ')}
                    >
                      {row[ci] ?? ''}
                    </td>
                  ))}
                </tr>
              );
            })}
          </tbody>
        </table>
        {preview.rows.length > MAX_PREVIEW_ROWS && (
          <p className="text-xs text-zinc-500 px-3 py-1.5 text-center">
            … {t('preview.moreRows', { n: preview.rows.length - MAX_PREVIEW_ROWS })}
          </p>
        )}
      </div>
    </div>
  );
}
