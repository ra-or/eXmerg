import { Router, type Request, type Response } from 'express';
import multer from 'multer';
import path from 'path';
import fs from 'fs/promises';
import { createReadStream } from 'fs';
import { spawn } from 'child_process';
import { fileURLToPath } from 'url';
import { v4 as uuidv4 } from 'uuid';
import { asyncHandler } from '../middleware/asyncHandler.js';
import { config } from '../config/index.js';
import { getSheetInfo } from '../services/mergeService.js';
import type {
  MergeOptions, MergeErrorResponse, SheetsResponse,
  MergeJobResponse, MergeProgressEvent,
} from 'shared';
import { isSpreadsheetFile } from 'shared';
import { validateExtension, validateFileSize, validateTotalSize, getValidationErrorMessage } from 'shared';
import { mergeOptionsSchema, downloadQuerySchema } from '../validation/schemas.js';
import type { WorkerPayload } from '../workers/mergeWorker.js';

// Verlauf wird client-seitig (localStorage) verwaltet, kein Server-State nötig.

// ── SSE Job-System ────────────────────────────────────────────────────────────
interface MergeJob {
  status: 'queued' | 'running' | 'done' | 'error';
  events: string[];
  clients: Set<Response>;
  createdAt: number;
  kill?: () => void;
  /** true = Client hat Abbrechen gewünscht (noch vor Worker-Start). */
  cancelled?: boolean;
}
const activeJobs = new Map<string, MergeJob>();

/** Sendet ein Event an alle SSE-Clients des Jobs und puffert es. */
function emitJobEvent(jobId: string, event: MergeProgressEvent): void {
  const job = activeJobs.get(jobId);
  if (!job) return;
  const payload = 'data: ' + JSON.stringify(event) + '\n\n';
  job.events.push(payload);
  for (const client of job.clients) {
    try { client.write(payload); } catch { /* client disconnected */ }
  }
}

// Fertige Jobs nach 5 Min. aufräumen
setInterval(() => {
  const cutoff = Date.now() - 5 * 60 * 1000;
  for (const [id, job] of activeJobs) {
    if ((job.status === 'done' || job.status === 'error') && job.createdAt < cutoff) {
      activeJobs.delete(id);
    }
  }
}, 30_000);

// ── Worker-Queue (max. MAX_WORKERS parallel) ──────────────────────────────────
let runningWorkers = 0;
const MAX_WORKERS  = 2;
const workerQueue: Array<() => void> = [];

function releaseWorkerSlot(): void {
  const next = workerQueue.shift();
  if (next) { runningWorkers--; next(); }
  else { runningWorkers--; }
}

// Slot holen + bei Bedarf queued-Event emittieren
async function waitForWorkerSlot(jobId: string): Promise<void> {
  if (runningWorkers < MAX_WORKERS) {
    runningWorkers++;
    return;
  }
  const position = workerQueue.length + 1;
  emitJobEvent(jobId, { type: 'queued', position });
  await new Promise<void>((resolve) => {
    workerQueue.push(() => { runningWorkers++; resolve(); });
  });
}

const __routesDir = path.dirname(fileURLToPath(import.meta.url));
const __serverRoot = path.join(__routesDir, '..', '..');

/** Dev = TypeScript via tsx loader; Prod = kompiliertes JS aus dist. */
function getWorkerExecArgs(
  workerScript: string,
  inputJsonPath: string,
  isDev: boolean
): { execPath: string; args: string[] } {
  const execPath = process.execPath;
  if (isDev) {
    return { execPath, args: ['--import', 'tsx', workerScript, inputJsonPath] };
  }
  return { execPath, args: [workerScript, inputJsonPath] };
}

/**
 * Führt den Merge in einem isolierten Kind-Prozess aus.
 * Gibt einen Fehler zurück (statt zu crashen) wenn der Prozess OOM hat.
 */
/** Rückgabe des Workers: erfolgreich, ggf. mit Warnungen. */
interface WorkerResult {
  warnings: string[];
}

/** Rückgabe: Promise + kill-Funktion zum Abbrechen des Workers. */
function runMergeWorker(
  payload: WorkerPayload,
  workerDir: string,
  onProgress?: (pct: number, msg: string) => void,
): { promise: Promise<WorkerResult>; kill: () => void } {
  const isDev = process.env.NODE_ENV !== 'production';
  const workerScript = isDev
    ? path.join(__routesDir, '..', 'workers', 'mergeWorker.ts')
    : path.join(__serverRoot, 'dist', 'workers', 'mergeWorker.js');
  const inputJsonPath = path.join(workerDir, `${uuidv4()}_input.json`);
  const { execPath, args } = getWorkerExecArgs(workerScript, inputJsonPath, isDev);

  let child: ReturnType<typeof spawn> | null = null;
  let timer: ReturnType<typeof setTimeout> | null = null;
  let settled = false;

  const promise = (async () => {
    await fs.writeFile(inputJsonPath, JSON.stringify(payload));

    return new Promise<WorkerResult>((resolve, reject) => {
      const TIMEOUT_MS = 5 * 60 * 1000; // 5 Minuten

      child = spawn(execPath, args, {
        env: { ...process.env, NODE_OPTIONS: '--max-old-space-size=2048' },
        cwd: __serverRoot,
        stdio: ['ignore', 'pipe', 'pipe'],
      });

      timer = setTimeout(() => {
        if (settled) return;
        settled = true;
        child?.kill('SIGKILL');
        cleanup();
        reject(new Error('Merge-Timeout: Verarbeitung dauerte zu lange (>5 Min). Bitte weniger Dateien gleichzeitig mergen.'));
      }, TIMEOUT_MS);

      let stderrBuf = '';
      let warningsBuf = '';
      let partialLine = '';

      child.stderr?.on('data', (chunk: Buffer) => {
        stderrBuf += chunk.toString().slice(0, 2000);
      });

      child.stdout?.on('data', (chunk: Buffer) => {
        const text = partialLine + chunk.toString();
        const lines = text.split('\n');
        partialLine = lines.pop() ?? '';
        for (const line of lines) {
          if (line.startsWith('PROGRESS:')) {
            try {
              const { pct, msg } = JSON.parse(line.slice(9)) as { pct: number; msg: string };
              onProgress?.(pct, msg);
            } catch { /* ignorieren */ }
          } else if (line.startsWith('WARNINGS:')) {
            warningsBuf = line.slice(9);
          }
        }
      });

      function cleanup() {
        if (timer) { clearTimeout(timer); timer = null; }
        fs.unlink(inputJsonPath).catch(() => {});
      }

      child.on('exit', (code, signal) => {
        if (settled) return;
        settled = true;
        cleanup();
        if (partialLine.startsWith('WARNINGS:')) warningsBuf = partialLine.slice(9);

        if (signal === 'SIGKILL' && code === null) {
          reject(new Error('Merge abgebrochen.'));
          return;
        }
        if (code === 0) {
          const warnings: string[] = [];
          if (warningsBuf) {
            try { warnings.push(...(JSON.parse(warningsBuf) as string[])); } catch { /* ignorieren */ }
          }
          resolve({ warnings });
        } else {
          const isOom = stderrBuf.includes('heap out of memory') || stderrBuf.includes('Allocation failed');
          const msg = isOom
            ? 'Nicht genug Arbeitsspeicher für diesen Merge. Bitte weniger oder kleinere Dateien wählen.'
            : stderrBuf.trim() || `Merge-Prozess fehlgeschlagen (Exit-Code ${code}).`;
          reject(new Error(msg));
        }
      });

      child.on('error', (err) => {
        if (settled) return;
        settled = true;
        cleanup();
        reject(new Error(`Worker-Prozess konnte nicht gestartet werden: ${err.message}`));
      });
    });
  })();

  const kill = () => {
    if (settled || !child) return;
    settled = true;
    if (timer) { clearTimeout(timer); timer = null; }
    child.kill('SIGKILL');
    fs.unlink(inputJsonPath).catch(() => {});
  };

  return { promise, kill };
}

const router = Router();
const uploadDir = config.uploadDir;

// ── Disk-Storage: Dateien nie im RAM, direkt auf Platte ──────────────────────
const storage = multer.diskStorage({
  destination: (_req, _file, cb) => cb(null, uploadDir),
  filename: (_req, file, cb) =>
    cb(null, uuidv4() + path.extname(file.originalname).toLowerCase()),
});

const upload = multer({
  storage,
  limits: {
    fileSize: config.fileLimits.maxFileSizeBytes,
    files: config.fileLimits.maxFilesPerRequest,
  },
});

async function ensureUploadDir(): Promise<void> {
  try {
    await fs.mkdir(uploadDir, { recursive: true });
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    throw new Error(`Upload-Verzeichnis nicht verfügbar: ${msg}`);
  }
}

/** Löscht eine Liste von Temp-Dateien (ignoriert Fehler). */
async function cleanupFiles(paths: string[]): Promise<void> {
  await Promise.allSettled(paths.map((p) => fs.unlink(p)));
}

/** GET /api/health – für Docker/Load-Balancer Healthchecks. */
router.get('/health', (_req: Request, res: Response) => {
  res.status(200).send('ok');
});

/** POST /api/sheets – Sheet-Namen + Vorschau-Zeilen einer Datei zurückgeben. */
router.post(
  '/sheets',
  asyncHandler(async (req: Request, res: Response) => {
    await ensureUploadDir();
    const multerSingle = upload.single('file');
    await new Promise<void>((resolve, reject) => {
      multerSingle(req, res, (err: unknown) => { if (err) reject(err); else resolve(); });
    });

    const file = (req as Request & { file?: Express.Multer.File }).file;
    if (!file) {
      res.status(400).json({ sheets: [], error: 'Keine Datei.' } as SheetsResponse);
      return;
    }

    try {
      const { sheets } = await getSheetInfo({ filePath: file.path, filename: file.originalname });
      res.json({ sheets } as SheetsResponse);
    } catch (err) {
      res.status(500).json({ sheets: [], error: err instanceof Error ? err.message : 'Fehler' } as SheetsResponse);
    } finally {
      await cleanupFiles([file.path]);
    }
  })
);

/** GET /api/progress/:mergeId – SSE-Stream für Merge-Fortschritt. */
router.get('/progress/:mergeId', (req: Request, res: Response) => {
  const { mergeId } = req.params as { mergeId: string };
  const job = activeJobs.get(mergeId);
  if (!job) { res.status(404).json({ error: 'Job nicht gefunden.' }); return; }

  res.setHeader('Content-Type',  'text/event-stream');
  res.setHeader('Cache-Control', 'no-cache');
  res.setHeader('Connection',    'keep-alive');
  res.setHeader('X-Accel-Buffering', 'no');
  res.flushHeaders();

  // Gepufferte Events nachholen
  for (const payload of job.events) {
    try { res.write(payload); } catch { break; }
  }

  if (job.status === 'done' || job.status === 'error') { res.end(); return; }

  // Live-Abo
  job.clients.add(res);
  req.on('close', () => { job.clients.delete(res); });
});

/**
 * POST /api/upload-file – Einzelne Datei vorab hochladen (für schrittweisen Upload).
 * Gibt { fileId, filename } zurück; fileId kann anschließend an /api/merge als fileIds-Eintrag übergeben werden.
 */
router.post(
  '/upload-file',
  asyncHandler(async (req: Request, res: Response) => {
    await ensureUploadDir();
    const multerSingle = upload.single('file');
    await new Promise<void>((resolve, reject) => {
      multerSingle(req, res, (err: unknown) => { if (err) reject(err); else resolve(); });
    });

    const file = (req as Request & { file?: Express.Multer.File }).file;
    if (!file) {
      console.error('[400] POST /upload-file – Keine Datei.');
      res.status(400).json({ error: 'Keine Datei.' });
      return;
    }

    if (!validateExtension(file.originalname)) {
      await cleanupFiles([file.path]);
      const msg = getValidationErrorMessage('extension');
      console.error('[400] POST /upload-file –', msg);
      res.status(400).json({ error: msg });
      return;
    }
    if (!validateFileSize(file.size, config.fileLimits.maxFileSizeBytes)) {
      await cleanupFiles([file.path]);
      const msg = getValidationErrorMessage('size', config.fileLimits);
      console.error('[400] POST /upload-file –', msg);
      res.status(400).json({ error: msg });
      return;
    }

    res.json({ fileId: path.basename(file.path), filename: file.originalname });
  })
);

/** POST /api/merge – Merge ausführen, Download-URL zurückgeben. */
router.post(
  '/merge',
  asyncHandler(async (req: Request, res: Response) => {
    await ensureUploadDir();

    const multerUpload = upload.fields([
      { name: 'files', maxCount: config.fileLimits.maxFilesPerRequest },
      { name: 'options', maxCount: 1 },
    ]);
    await new Promise<void>((resolve, reject) => {
      multerUpload(req, res, (err: unknown) => {
        if (err) reject(err);
        else resolve();
      });
    });

    const r = req as Request & {
      files?: { files?: Express.Multer.File[] };
      body?: { options?: string; filename?: string; fileIds?: string; fileNames?: string };
    };

    const optionsStr = r.body?.options;
    if (!optionsStr) {
      res.status(400).json({ success: false, error: 'Merge-Optionen fehlen.' } as MergeErrorResponse);
      return;
    }

    let options: MergeOptions;
    try {
      const parsed = JSON.parse(optionsStr) as unknown;
      const result = mergeOptionsSchema.safeParse(parsed);
      if (!result.success) {
        const first = result.error.flatten().fieldErrors;
        const msg = typeof first.mode?.[0] === 'string' ? first.mode[0]
          : typeof first.outputType?.[0] === 'string' ? first.outputType[0]
          : result.error.errors[0]?.message ?? 'Ungültige Merge-Optionen.';
        res.status(400).json({ success: false, error: msg } as MergeErrorResponse);
        return;
      }
      options = result.data as MergeOptions;
    } catch {
      res.status(400).json({ success: false, error: 'Ungültige Merge-Optionen (kein gültiges JSON).' } as MergeErrorResponse);
      return;
    }

    // ── Dateiquellen auflösen: entweder vorab hochgeladen (fileIds) oder direkt ──
    interface ResolvedFile { path: string; originalname: string; size: number; }
    let resolvedFiles: ResolvedFile[] = [];
    let uploadedPaths: string[] = [];     // werden am Ende immer gelöscht

    const fileIdsStr = r.body?.fileIds;
    if (fileIdsStr) {
      // ── Modus: Vorab-Upload (ein File-per-Request) ──────────────────────
      let fileIds: string[];
      let fileNames: string[];
      try {
        fileIds  = JSON.parse(fileIdsStr) as string[];
        fileNames = JSON.parse(r.body?.fileNames ?? '[]') as string[];
      } catch {
        res.status(400).json({ success: false, error: 'Ungültige fileIds.' } as MergeErrorResponse);
        return;
      }
      if (!fileIds.length) {
        res.status(400).json({ success: false, error: 'Keine Dateien angegeben.' } as MergeErrorResponse);
        return;
      }
      if (fileIds.length > config.fileLimits.maxFilesPerRequest) {
        res.status(400).json({
          success: false,
          error: getValidationErrorMessage('count', config.fileLimits),
        } as MergeErrorResponse);
        return;
      }
      for (let i = 0; i < fileIds.length; i++) {
        const id = fileIds[i]!;
        if (id.includes('..') || path.isAbsolute(id)) {
          res.status(400).json({ success: false, error: 'Ungültige fileId.' } as MergeErrorResponse);
          return;
        }
        const p = path.join(uploadDir, path.basename(id));
        try {
          const stat = await fs.stat(p);
          resolvedFiles.push({ path: p, originalname: fileNames[i] ?? id, size: stat.size });
          uploadedPaths.push(p);
        } catch {
          res.status(400).json({ success: false, error: `Datei nicht gefunden: ${id}` } as MergeErrorResponse);
          return;
        }
      }
    } else {
      // ── Modus: Direkter Upload (alles in einem Request) ────────────────
      const files = r.files?.files;
      if (!files?.length) {
        res.status(400).json({ success: false, error: 'Keine Dateien angegeben.' } as MergeErrorResponse);
        return;
      }
      uploadedPaths = files.map((f) => f.path);
      for (const f of files) {
        if (!validateExtension(f.originalname)) {
          await cleanupFiles(uploadedPaths);
          res.status(400).json({ success: false, error: getValidationErrorMessage('extension') });
          return;
        }
        if (!validateFileSize(f.size, config.fileLimits.maxFileSizeBytes)) {
          await cleanupFiles(uploadedPaths);
          res.status(400).json({ success: false, error: getValidationErrorMessage('size', config.fileLimits) });
          return;
        }
        resolvedFiles.push({ path: f.path, originalname: f.originalname, size: f.size });
      }
    }

    const clientFilename = typeof r.body?.filename === 'string' ? r.body.filename : null;

    const totalBytes = resolvedFiles.reduce((s, f) => s + f.size, 0);
    if (!validateTotalSize(totalBytes, config.fileLimits.maxTotalSizeBytes)) {
      await cleanupFiles(uploadedPaths);
      res.status(400).json({ success: false, error: getValidationErrorMessage('totalSize', config.fileLimits) });
      return;
    }

    // ── Spreadsheet-Merge: asynchron via SSE-Job ──────────────────────────
    const spreadsheetFiles = resolvedFiles.filter((f) => isSpreadsheetFile(f.originalname));
    if (spreadsheetFiles.length === 0) {
      await cleanupFiles(uploadedPaths);
      res.status(400).json({ success: false, error: 'Keine Tabellendateien zum Mergen.' });
      return;
    }

    const mergeId = uuidv4();
    const job: MergeJob = { status: 'queued', events: [], clients: new Set(), createdAt: Date.now() };
    activeJobs.set(mergeId, job);

    // Sofort mergeId zurückgeben; Merge läuft im Hintergrund
    res.json({ success: true, mergeId } as MergeJobResponse);

    // ── Hintergrund-Verarbeitung ──────────────────────────────────────────
    void (async () => {
      try {
        await waitForWorkerSlot(mergeId);
        if (job.cancelled) {
          job.status = 'error';
          emitJobEvent(mergeId, { type: 'error', message: 'Merge abgebrochen.' });
          for (const c of job.clients) { try { c.end(); } catch { /* ignore */ } }
          job.clients.clear();
          releaseWorkerSlot();
          await cleanupFiles(uploadedPaths);
          return;
        }
        job.status = 'running';
        emitJobEvent(mergeId, { type: 'progress', pct: 0, msg: 'Merge gestartet…' });

        const isOds = options.outputType === 'xlsx' && options.outputFormat === 'ods';
        const xlsxFileId = uuidv4() + '.xlsx';
        const outPath = path.join(uploadDir, xlsxFileId);

        const { promise, kill } = runMergeWorker(
          {
            files: spreadsheetFiles.map((f) => ({ filePath: f.path, filename: f.originalname })),
            options,
            selectedSheets: options.selectedSheets,
            outputFilePath: outPath,
          },
          uploadDir,
          (pct, msg) => emitJobEvent(mergeId, { type: 'progress', pct, msg }),
        );
        job.kill = kill;

        // Download-URL erst nach Worker-Ende → writeFile ist abgeschlossen, Datei vollständig
        const { warnings } = await promise;

        const finalFileId = isOds ? xlsxFileId.replace('.xlsx', '.ods') : xlsxFileId;
        const ext  = isOds ? '.ods' : '.xlsx';
        const outFilename = clientFilename || ('merged' + ext);
        const downloadUrl =
          '/api/download?id=' + encodeURIComponent(finalFileId) +
          '&name=' + encodeURIComponent(outFilename) +
          (isOds ? '&fmt=ods' : '');

        job.status = 'done';
        emitJobEvent(mergeId, { type: 'complete', downloadUrl, filename: outFilename, warnings });
        // SSE-Clients schließen
        for (const c of job.clients) { try { c.end(); } catch { /* ignore */ } }
        job.clients.clear();
      } catch (err) {
        job.status = 'error';
        const msg = err instanceof Error ? err.message : 'Merge fehlgeschlagen.';
        emitJobEvent(mergeId, { type: 'error', message: msg });
        for (const c of job.clients) { try { c.end(); } catch { /* ignore */ } }
        job.clients.clear();
      } finally {
        releaseWorkerSlot();
        await cleanupFiles(uploadedPaths);
      }
    })();
  })
);

/** DELETE /api/merge/:mergeId/cancel – laufenden Merge abbrechen. */
router.delete(
  '/merge/:mergeId/cancel',
  (req: Request, res: Response) => {
    const { mergeId } = req.params;
    const job = activeJobs.get(mergeId);
    if (!job) {
      res.status(404).json({ success: false, error: 'Job nicht gefunden oder bereits beendet.' });
      return;
    }
    if (job.status !== 'running' && job.status !== 'queued') {
      res.status(400).json({ success: false, error: 'Merge kann nur während der Verarbeitung abgebrochen werden.' });
      return;
    }
    if (job.status === 'queued') {
      job.cancelled = true;
      res.json({ success: true });
      return;
    }
    if (job.kill) {
      job.kill();
      job.status = 'error';
      job.kill = undefined;
      emitJobEvent(mergeId, { type: 'error', message: 'Merge abgebrochen.' });
      for (const c of job.clients) { try { c.end(); } catch { /* ignore */ } }
      job.clients.clear();
    }
    res.json({ success: true });
  }
);

/** GET /api/download – Temp-Datei per ID ausliefern. */
router.get(
  '/download',
  asyncHandler(async (req: Request, res: Response) => {
    const raw = req.query as Record<string, string | string[] | undefined>;
    const query = {
      id: typeof raw.id === 'string' ? raw.id : Array.isArray(raw.id) ? raw.id[0] : undefined,
      name: typeof raw.name === 'string' ? raw.name : Array.isArray(raw.name) ? raw.name[0] : undefined,
      subdir: typeof raw.subdir === 'string' ? raw.subdir : Array.isArray(raw.subdir) ? raw.subdir[0] : undefined,
      fmt: typeof raw.fmt === 'string' ? raw.fmt : Array.isArray(raw.fmt) ? raw.fmt[0] : undefined,
    };
    const result = downloadQuerySchema.safeParse(query);
    if (!result.success) {
      const msg = result.error.errors[0]?.message ?? 'Parameter id fehlt oder ungültig.';
      res.status(400).json({ success: false, error: msg });
      return;
    }
    const { id, name: nameParam, subdir } = result.data;
    const name = nameParam ?? 'download';
    const baseDir = subdir ? path.join(uploadDir, subdir) : uploadDir;
    const fullPath = path.join(baseDir, path.basename(id));
    const resolvedUpload = path.resolve(uploadDir) + path.sep;
    const resolvedFull = path.resolve(fullPath);
    if (resolvedFull !== path.resolve(uploadDir) && !resolvedFull.startsWith(resolvedUpload)) {
      res.status(403).json({ success: false, error: 'Ungültiger Pfad.' });
      return;
    }
    let stat: Awaited<ReturnType<typeof fs.stat>>;
    try {
      stat = await fs.stat(fullPath);
    } catch {
      res.status(404).json({ success: false, error: 'Datei nicht gefunden.' });
      return;
    }
    if (!stat.isFile()) {
      res.status(404).json({ success: false, error: 'Datei nicht gefunden.' });
      return;
    }
    console.log('[download] path:', fullPath);
    console.log('[download] size:', stat.size);

    const isOdsFmt = result.data.fmt === 'ods' || name.endsWith('.ods');
    const contentType = isOdsFmt
      ? 'application/vnd.oasis.opendocument.spreadsheet'
      : 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet';

    res.setHeader('Content-Disposition', `attachment; filename="${encodeURIComponent(name)}"`);
    res.setHeader('Content-Type', contentType);
    res.setHeader('Content-Length', String(stat.size));

    let sendSucceeded = true;
    let sentBytes = 0;
    const stream = createReadStream(fullPath);
    stream.on('data', (chunk: Buffer | string) => {
      sentBytes += typeof chunk === 'string' ? Buffer.byteLength(chunk, 'utf8') : chunk.length;
    });
    stream.on('error', (err) => {
      sendSucceeded = false;
      console.error('DOWNLOAD STREAM ERROR:', fullPath, err.message);
      if (!res.headersSent) res.status(500).json({ success: false, error: 'Download fehlgeschlagen.' });
      else res.destroy();
    });

    res.on('finish', () => {
      console.log('[download] sent bytes:', sentBytes);
      if (sentBytes < stat.size) {
        console.warn('[download] WARNING: sent bytes < file size, file may be truncated');
      }
      if (!sendSucceeded) return;
      fs.unlink(fullPath)
        .then(() => {
          console.log('[download] file sent and removed:', fullPath);
        })
        .catch((err) => {
          console.warn('[download] failed to remove temp file:', err);
        });
    });

    stream.pipe(res);
  })
);

export default router;
