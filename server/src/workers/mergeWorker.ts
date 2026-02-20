/**
 * Merge-Worker – isolierter Kind-Prozess.
 * – Führt den eigentlichen Merge durch (ggf. OOM-sicher)
 * – Konvertiert XLSX→ODS falls outputFormat === 'ods'
 * – Gibt Warnungen via stdout aus (Prefix WARNINGS:<json>)
 */

import { readFile, writeFile, unlink } from 'fs/promises';
import type { FileRef } from '../services/mergeService.js';
import type { SpreadsheetMergeOptions } from 'shared';

export interface WorkerPayload {
  files: FileRef[];
  options: SpreadsheetMergeOptions;
  selectedSheets?: Record<string, string[]>;
  outputFilePath: string;
}

const inputPath = process.argv[2];

if (!inputPath) {
  process.stderr.write('mergeWorker: Kein Input-Pfad angegeben.\n');
  process.exit(2);
}

try {
  const raw = await readFile(inputPath, 'utf-8');
  const payload: WorkerPayload = JSON.parse(raw) as WorkerPayload;

  const { mergeSpreadsheets, warningsPath } = await import('../services/mergeService.js');

  // Fortschritt an Elternprozess via stdout (PROGRESS:<json>\n)
  const onProgress = (pct: number, msg: string): void => {
    process.stdout.write('PROGRESS:' + JSON.stringify({ pct, msg }) + '\n');
  };

  await mergeSpreadsheets({
    files: payload.files,
    options: payload.options,
    selectedSheets: payload.selectedSheets,
    outputFilePath: payload.outputFilePath,
    onProgress,
  });

  // ── ODS-Konvertierung ────────────────────────────────────────────────────
  if (payload.options.outputFormat === 'ods') {
    const XLSX = await import('xlsx');
    const xlsxBuf = await readFile(payload.outputFilePath);
    const wb = XLSX.read(xlsxBuf, { type: 'buffer' });
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const odsBuf = XLSX.write(wb, { bookType: 'ods', type: 'buffer' }) as unknown as Uint8Array;
    const odsPath = payload.outputFilePath.replace(/\.xlsx$/i, '.ods');
    await writeFile(odsPath, odsBuf);
    await unlink(payload.outputFilePath);
  }

  // ── Warnungen an Haupt-Prozess (stdout) ──────────────────────────────────
  try {
    const warnRaw = await readFile(warningsPath(payload.outputFilePath), 'utf-8');
    process.stdout.write('WARNINGS:' + warnRaw + '\n');
    await unlink(warningsPath(payload.outputFilePath));
  } catch { /* keine Warnings-Datei = alles OK */ }

  process.exit(0);
} catch (err: unknown) {
  const msg = err instanceof Error ? err.message : String(err);
  process.stderr.write(msg + '\n');
  process.exit(1);
}
