/**
 * Merge-Worker – isolierter Kind-Prozess.
 * – Führt den eigentlichen Merge durch (ggf. OOM-sicher)
 * – Konvertiert XLSX→ODS falls outputFormat === 'ods'
 *   (primär via LibreOffice für volles Styling; Fallback: SheetJS)
 * – Gibt Warnungen via stdout aus (Prefix WARNINGS:<json>)
 */

import { readFile, writeFile, unlink, stat } from 'fs/promises';
import { spawnSync } from 'child_process';
import { dirname } from 'path';
import type { FileRef } from '../services/mergeService.js';
import type { SpreadsheetMergeOptions } from 'shared';

export interface WorkerPayload {
  files: FileRef[];
  options: SpreadsheetMergeOptions;
  selectedSheets?: Record<string, string[]>;
  outputFilePath: string;
}

/** Versucht XLSX→ODS mit LibreOffice (volles Styling, öffnbare Datei). Gibt true zurück wenn erfolgreich. */
async function tryLibreOfficeConvert(xlsxPath: string, outDir: string): Promise<boolean> {
  const cmds = ['soffice', 'libreoffice'];
  for (const cmd of cmds) {
    const r = spawnSync(cmd, ['--headless', '--convert-to', 'ods', '--outdir', outDir, xlsxPath], {
      encoding: 'utf8',
      timeout: 120_000,
    });
    if (r.status === 0) {
      const odsPath = xlsxPath.replace(/\.xlsx$/i, '.ods');
      try {
        await stat(odsPath);
        return true;
      } catch {
        return false;
      }
    }
  }
  return false;
}

const inputPath = process.argv[2];

if (!inputPath) {
  process.stderr.write('mergeWorker: Kein Input-Pfad angegeben.\n');
  process.exit(2);
}

try {
  const raw = await readFile(inputPath, 'utf-8');
  const payload: WorkerPayload = JSON.parse(raw) as WorkerPayload;

  console.log('OUTPUT PATH:', payload.outputFilePath);

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

  // ── ODS-Konvertierung (Styling wie XLSX, öffnbare Datei) ──────────────────
  const finalOutputPath =
    payload.options.outputFormat === 'ods'
      ? payload.outputFilePath.replace(/\.xlsx$/i, '.ods')
      : payload.outputFilePath;

  if (payload.options.outputFormat === 'ods') {
    const odsPath = payload.outputFilePath.replace(/\.xlsx$/i, '.ods');
    const outDir = dirname(payload.outputFilePath);
    const triedLibreOffice = await tryLibreOfficeConvert(payload.outputFilePath, outDir);
    if (triedLibreOffice) {
      await unlink(payload.outputFilePath);
    } else {
      // Fallback: SheetJS (ODS kann bei manchen Viewern Probleme machen; Styling eingeschränkt)
      const XLSX = await import('xlsx');
      const xlsxBuf = await readFile(payload.outputFilePath);
      const wb = XLSX.read(xlsxBuf, { type: 'buffer', cellStyles: true });
      const odsBuf = XLSX.write(wb, { bookType: 'ods', type: 'buffer' });
      let buf: Buffer;
      if (Buffer.isBuffer(odsBuf)) {
        buf = odsBuf;
      } else if (odsBuf instanceof ArrayBuffer) {
        buf = Buffer.from(odsBuf);
      } else {
        const view = odsBuf as ArrayBufferView;
        buf = Buffer.from(view.buffer, view.byteOffset, view.byteLength);
      }
      await writeFile(odsPath, buf);
      await unlink(payload.outputFilePath);
    }
  }

  try {
    const st = await stat(finalOutputPath);
    console.log('[merge] output exists:', finalOutputPath);
    console.log('[merge] size:', st.size);
    if (payload.options.outputFormat !== 'ods') {
      console.log('[merge] XLSX final size:', st.size);
      const unzipResult = spawnSync('unzip', ['-t', finalOutputPath], { encoding: 'utf8', timeout: 30_000 });
      if (unzipResult.status === 0) {
        console.log('[merge] unzip -t OK');
      } else {
        console.error('[merge] unzip -t FAILED (exit', unzipResult.status + '):', (unzipResult.stderr || unzipResult.stdout || '').slice(0, 500));
      }
    }
  } catch (e) {
    console.error('OUTPUT FILE MISSING OR UNREADABLE:', finalOutputPath, e);
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
