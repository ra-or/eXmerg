import { useState, useRef, useCallback, useEffect } from 'react';
import { useStore, generateOutputFilename, sortFileList } from '../store/useStore';
import { uploadFilesParallel, startMerge, subscribeToMergeProgress, cancelMerge } from '../api/client';
import { addToLocalHistory, updateLocalHistoryEntry } from './DownloadHistory';
import { useLocalMergeHistory } from '../hooks/useLocalMergeHistory';
import { useT } from '../i18n';
import { Portal } from './ui/Portal';
import { Z_INDEX, STICKY_FOOTER_HEIGHT_PX } from '../constants/zIndex';

const UPLOAD_CONCURRENCY = 3;

export interface ActionBarProps {
  /** Legacy: wird nicht mehr verwendet; Sticky-Wrapper liegt in MergePage. */
  embedded?: boolean;
}

export function ActionBar({ embedded: _embedded }: ActionBarProps = {}) {
  const t = useT();
  const files            = useStore((s) => s.files);
  const selectedFileIds  = useStore((s) => s.selectedFileIds);
  const fileSortOrder    = useStore((s) => s.fileSortOrder);
  const mergeOptions     = useStore((s) => s.mergeOptions);
  const outputFormat     = useStore((s) => s.outputFormat);
  const outputFilename   = useStore((s) => s.outputFilename);
  const isCustomFilename = useStore((s) => s.isCustomFilename);
  const setOutputFilename = useStore((s) => s.setOutputFilename);
  const setProcessing    = useStore((s) => s.setProcessing);
  const setMergeError    = useStore((s) => s.setMergeError);
  const setMergeWarnings = useStore((s) => s.setMergeWarnings);
  const setDownload      = useStore((s) => s.setDownload);
  const setLastMergeHistoryMeta = useStore((s) => s.setLastMergeHistoryMeta);
  const setUploadProgress = useStore((s) => s.setUploadProgress);
  const clearResult      = useStore((s) => s.clearResult);
  const isProcessing     = useStore((s) => s.isProcessing);
  const mergeError       = useStore((s) => s.mergeError);
  const mergeWarnings    = useStore((s) => s.mergeWarnings);
  const downloadUrl      = useStore((s) => s.downloadUrl);
  const downloadFilename = useStore((s) => s.downloadFilename);
  const lastMergeHistoryMeta = useStore((s) => s.lastMergeHistoryMeta);
  const bumpHistory      = useStore((s) => s.bumpHistory);
  const bumpLocalMergeVersion = useStore((s) => s.bumpLocalMergeVersion);
  const reset            = useStore((s) => s.reset);
  const { saveMerge, downloadMerge, hasLocalBlob, actionLoading } = useLocalMergeHistory();
  const [downloadBarLoading, setDownloadBarLoading] = useState(false);
  const [downloadButtonUsed, setDownloadButtonUsed] = useState(false);
  const [successBannerPhase, setSuccessBannerPhase] = useState<'ready' | 'downloading' | 'fading'>('ready');
  const [successBannerFaded, setSuccessBannerFaded] = useState(false);
  const successBannerTimeoutsRef = useRef<ReturnType<typeof setTimeout>[]>([]);

  const [editingName, setEditingName] = useState(false);
  const [nameInput, setNameInput]     = useState('');
  const inputRef = useRef<HTMLInputElement>(null);

  // ── Upload-Fortschritt ────────────────────────────────────────────────────
  const [uploadPhase, setUploadPhase] = useState<'idle' | 'uploading' | 'processing'>('idle');
  const [uploadedCount, setUploadedCount] = useState(0);
  const [uploadAggregate, setUploadAggregate] = useState(0);
  const fileProgressesRef = useRef<number[]>([]);

  // ── SSE-Fortschritt ───────────────────────────────────────────────────────
  const [sseProgress, setSseProgress] = useState(0);
  const [sseMsg, setSseMsg]           = useState('');
  const [queuePos, setQueuePos]       = useState<number | null>(null);
  const [longRunning, setLongRunning] = useState(false);
  const longRunTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const sseCleanupRef   = useRef<(() => void) | null>(null);
  const mergeIdRef      = useRef<string | null>(null);

  // ── Estimations-Timer (Fallback wenn SSE keine pct liefert) ─────────────
  const estTimerRef  = useRef<ReturnType<typeof setInterval> | null>(null);
  const estStartRef  = useRef(0);
  const estTotalRef  = useRef(0);

  const startEstimation = useCallback(() => {
    const totalMB = files.reduce((s, f) => s + (f.size ?? 0), 0) / 1024 / 1024;
    estTotalRef.current = Math.max(5000, totalMB * 2500);
    estStartRef.current = Date.now();
    setSseProgress(0);
    estTimerRef.current = setInterval(() => {
      const elapsed = Date.now() - estStartRef.current;
      const pct = 97 * (1 - Math.exp(-elapsed / estTotalRef.current));
      setSseProgress((prev) => Math.max(prev, Math.min(97, Math.round(pct))));
    }, 250);
  }, [files]);

  const stopEstimation = useCallback(() => {
    if (estTimerRef.current) { clearInterval(estTimerRef.current); estTimerRef.current = null; }
  }, []);

  const clearLongRunTimer = () => {
    if (longRunTimerRef.current) { clearTimeout(longRunTimerRef.current); longRunTimerRef.current = null; }
  };

  // Cleanup bei Unmount
  useEffect(() => () => {
    sseCleanupRef.current?.();
    clearLongRunTimer();
    stopEstimation();
  }, [stopEstimation]);

  useEffect(() => {
    if (editingName && inputRef.current) {
      inputRef.current.focus();
      const dotIdx = nameInput.lastIndexOf('.');
      inputRef.current.setSelectionRange(0, dotIdx >= 0 ? dotIdx : nameInput.length);
    }
  }, [editingName]);

  // Leuchteffekt und Erfolgs-Banner zurücksetzen bei neuem Ergebnis
  useEffect(() => {
    if (downloadUrl && downloadFilename) {
      setDownloadButtonUsed(false);
      setSuccessBannerFaded(false);
      setSuccessBannerPhase('ready');
    }
  }, [downloadUrl, downloadFilename]);

  // Timeouts für Erfolgs-Banner-Fade aufräumen
  useEffect(() => () => {
    successBannerTimeoutsRef.current.forEach((id) => clearTimeout(id));
    successBannerTimeoutsRef.current = [];
  }, []);

  const startEditing = () => { setNameInput(outputFilename); setEditingName(true); };
  const commitName   = () => {
    const t = nameInput.trim();
    if (t) setOutputFilename(t, true);
    setEditingName(false);
  };
  const resetName = () => {
    setOutputFilename(generateOutputFilename(files, outputFormat), false);
    setEditingName(false);
  };

  const getEffectiveOptions = useCallback(
    () => ({ ...mergeOptions, outputFormat }),
    [mergeOptions, outputFormat]
  );

  const handleCancelMerge = useCallback(async () => {
    const id = mergeIdRef.current;
    if (!id) return;
    try {
      await cancelMerge(id);
      sseCleanupRef.current?.();
    } catch (e) {
      setMergeError(e instanceof Error ? e.message : 'Abbrechen fehlgeschlagen.');
    }
  }, []);

  const handleMerge = async () => {
    if (!mergeCount || isProcessing) return;

    setProcessing(true);
    setMergeError(null);
    setMergeWarnings([]);
    clearResult();
    setQueuePos(null);
    setLongRunning(false);
    clearLongRunTimer();
    setSseProgress(0);
    setSseMsg('');

    // Fortschritts-Arrays zurücksetzen (nach Anzahl der zu mergenden Dateien)
    fileProgressesRef.current = new Array(mergeCount).fill(0);
    setUploadedCount(0);
    setUploadAggregate(0);

    try {
      const effectiveOptions = getEffectiveOptions();

      // ── Phase 1: Dateien hochladen (parallel, max. UPLOAD_CONCURRENCY) ──
      setUploadPhase('uploading');
      setUploadProgress(0);

      const toUpload  = filesToMerge
        .map((f, i) => ({ item: f, i }))
        .filter(({ item }) => !item.preUploadedId && item.file);

      let completedCount = 0;

      const uploadResults = await uploadFilesParallel(
        toUpload.map(({ item, i }) => ({ file: item.file!, idx: i })),
        UPLOAD_CONCURRENCY,
        (fileIdx, pct) => {
          fileProgressesRef.current[fileIdx] = pct;
          if (pct >= 100) completedCount++;
          setUploadedCount(completedCount);
          const total = mergeCount;
          const agg = fileProgressesRef.current.reduce((s, p) => s + p, 0) / total;
          setUploadAggregate(Math.round(agg));
          setUploadProgress(Math.round(agg));
        },
      );

      // fileId-Map: Upload-Index (Reihenfolge in filesToMerge) → fileId
      const fileIdMap = new Map(uploadResults.map(({ idx, fileId }) => [idx, fileId]));

      const fileIds:   string[] = [];
      const fileNames: string[] = [];
      for (const item of filesToMerge) {
        if (item.preUploadedId) {
          fileIds.push(item.preUploadedId);
        } else {
          const rawIndex = filesToMerge.findIndex((f) => f.id === item.id);
          const id = rawIndex >= 0 ? fileIdMap.get(rawIndex) : undefined;
          if (!id) throw new Error(`Upload für Datei ${item.filename} fehlgeschlagen.`);
          fileIds.push(id);
        }
        fileNames.push(item.filename);
      }

      // ── Phase 2: Merge starten → mergeId ─────────────────────────────
      setUploadPhase('processing');
      setUploadProgress('processing');
      startEstimation();
      longRunTimerRef.current = setTimeout(() => setLongRunning(true), 2 * 60 * 1000);

      const mergeId = await startMerge(fileIds, fileNames, effectiveOptions, outputFilename);
      mergeIdRef.current = mergeId;

      // ── Phase 3: SSE-Fortschritt verfolgen ────────────────────────────
      await new Promise<void>((resolve, reject) => {
        sseCleanupRef.current = subscribeToMergeProgress(mergeId, {
          onQueued: (pos) => setQueuePos(pos),
          onProgress: (pct, msg) => {
            setQueuePos(null);
            const next = Math.min(100, Math.round(pct));
            setSseProgress((prev) => Math.max(prev, next));
            setSseMsg(msg);
          },
          onComplete: (dlUrl, _dlFilename, warnings) => {
            stopEstimation();
            clearLongRunTimer();
            setLongRunning(false);

            // Dateinamen-Extension korrekt setzen
            const nameWithExt = outputFormat === 'ods'
              ? outputFilename.replace(/\.xlsx$/i, '.ods')
              : outputFilename.replace(/\.ods$/i, '.xlsx');
            const url = new URL(dlUrl, window.location.origin);
            url.searchParams.set('name', nameWithExt);
            setDownload(url.pathname + url.search, nameWithExt);
            if (warnings.length) setMergeWarnings(warnings);

            // ── Verlauf lokal (nur für diesen Browser) speichern ────────
            const fileIdParam = url.searchParams.get('id') ?? nameWithExt;
            const historyId = Math.random().toString(36).slice(2);
            addToLocalHistory({
              id: historyId,
              fileId: fileIdParam,
              filename: nameWithExt,
              mode: effectiveOptions.mode,
              fileCount: mergeCount,
              timestamp: Date.now(),
              isOds: outputFormat === 'ods',
            });
            setLastMergeHistoryMeta({
              id: historyId,
              filename: nameWithExt,
              mergeOptions: effectiveOptions,
            });

            // ── Sofort im Browser (IndexedDB) speichern, damit nichts dauerhaft auf dem Server bleibt ──
            const urlToFetch = url.pathname + url.search;
            void (async () => {
              try {
                const r = await fetch(urlToFetch);
                if (!r.ok) return;
                const blob = await r.blob();
                updateLocalHistoryEntry(historyId, { size: blob.size });
                bumpHistory(); // Verlauf neu laden, damit Dateigröße erscheint
                await saveMerge(blob, {
                  id: historyId,
                  filename: nameWithExt,
                  mergeOptions: effectiveOptions,
                  createdAt: Date.now(),
                });
                bumpLocalMergeVersion(); // Verlauf aktualisieren, damit „Erneut herunterladen“ sofort erscheint
              } catch {
                // z. B. IndexedDB nicht verfügbar oder Netzwerkfehler – kein Abbruch
              }
            })();

            bumpHistory();
            setSseProgress(100);
            resolve();
          },
          onError: (msg) => {
            stopEstimation();
            clearLongRunTimer();
            setLongRunning(false);
            reject(new Error(msg));
          },
        });
      });
    } catch (err) {
      setMergeError(err instanceof Error ? err.message : 'Merge fehlgeschlagen.');
    } finally {
      mergeIdRef.current = null;
      sseCleanupRef.current?.();
      sseCleanupRef.current = null;
      setUploadPhase('idle');
      setProcessing(false);
      setUploadProgress(null);
      stopEstimation();
      clearLongRunTimer();
      setLongRunning(false);
    }
  };

  // ── Fehlerreport-Download ─────────────────────────────────────────────────
  const downloadErrorReport = () => {
    const lines = [
      `eXmerg Fehlerreport – ${new Date().toLocaleString('de-DE')}`,
      `Datei: ${downloadFilename ?? 'unbekannt'}`,
      '',
      ...mergeWarnings.map((w, i) => `${i + 1}. ${w}`),
    ];
    const blob = new Blob([lines.join('\n')], { type: 'text/plain;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url; a.download = 'merge-fehlerreport.txt'; a.click();
    URL.revokeObjectURL(url);
  };

  const filesToMerge = selectedFileIds.length > 0
    ? sortFileList(files, fileSortOrder).filter((f) => selectedFileIds.includes(f.id))
    : sortFileList(files, fileSortOrder);
  const noFiles   = files.length === 0;
  const hasResult = !!downloadUrl && !!downloadFilename;
  const mergeCount = filesToMerge.length;
  const ext       = outputFormat === 'ods' ? '.ods' : '.xlsx';
  const displayBasename = outputFilename.replace(/\.(xlsx|ods)$/i, '');

  const handleDownloadWithSave = useCallback(async () => {
    if (!downloadFilename) return;
    setDownloadBarLoading(true);
    try {
      // Zuerst aus dem Browser (IndexedDB), falls schon nach Merge gespeichert
      if (lastMergeHistoryMeta && hasLocalBlob(lastMergeHistoryMeta.id)) {
        await downloadMerge(lastMergeHistoryMeta.id);
        setDownloadBarLoading(false);
        return;
      }
      if (!downloadUrl) return;
      const res = await fetch(downloadUrl);
      const blob = await res.blob();
      if (lastMergeHistoryMeta) {
        await saveMerge(blob, {
          id: lastMergeHistoryMeta.id,
          filename: downloadFilename,
          mergeOptions: lastMergeHistoryMeta.mergeOptions,
          createdAt: Date.now(),
        });
      }
      const url = URL.createObjectURL(blob);
      try {
        const a = document.createElement('a');
        a.href = url;
        a.download = downloadFilename;
        a.click();
      } finally {
        URL.revokeObjectURL(url);
      }
    } catch {
      if (downloadUrl) window.open(downloadUrl, '_blank');
    } finally {
      setDownloadBarLoading(false);
    }
  }, [downloadUrl, downloadFilename, lastMergeHistoryMeta, saveMerge, downloadMerge, hasLocalBlob]);

  // Button-Text abhängig von Phase
  const buttonLabel = (() => {
    if (!isProcessing) return hasResult ? t('action.mergeAgain') : t('action.merge');
    if (uploadPhase === 'uploading') {
      const done = uploadedCount;
      const total = filesToMerge.filter(f => !f.preUploadedId && f.file).length;
      return `${t('action.uploadProgress')} (${done}/${total}) – ${Math.round(uploadAggregate)}%`;
    }
    if (queuePos !== null) return t('action.queue', { n: queuePos });
    return sseProgress > 0 ? `${t('action.processing')} ${Math.round(sseProgress)}%` : t('action.processing');
  })();

  return (
    <div className="w-full">

      {/* ── Long-Running-Banner ──────────────────────────────────────── */}
      {longRunning && isProcessing && (
        <div className="max-w-5xl mx-auto px-4 md:px-6 pb-1">
          <div className="flex items-center gap-2 px-3 py-2 rounded-lg bg-amber-500/10 border border-amber-500/25 text-xs text-amber-400 animate-slide-up">
            <svg className="w-3.5 h-3.5 shrink-0 animate-spin-slow" viewBox="0 0 24 24" fill="none">
              <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="3" />
              <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
            </svg>
            <span className="flex-1">{t('action.longRunning')} {sseMsg && `[${sseMsg}]`}</span>
          </div>
        </div>
      )}

      {/* ── Fehleranzeige (mit Tipp bei OOM/Timeout) ────────────────────── */}
      {mergeError && (
        <div className="max-w-5xl mx-auto px-4 md:px-6 pb-1">
          <div className="flex items-start gap-2 px-3 py-2 rounded-lg bg-red-500/10 border border-red-500/20 text-xs text-red-400 animate-slide-up">
            <svg className="w-3.5 h-3.5 shrink-0 mt-0.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v4m0 4h.01M10.29 3.86L1.82 18a2 2 0 001.71 3h16.94a2 2 0 001.71-3L13.71 3.86a2 2 0 00-3.42 0z" />
            </svg>
            <div className="flex-1 min-w-0">
              <p className="truncate">{mergeError}</p>
              {(mergeError.includes('Arbeitsspeicher') || mergeError.includes('Nicht genug')) && (
                <p className="mt-1 text-amber-400/90">{t('error.hintOom')}</p>
              )}
              {mergeError.includes('Timeout') && (
                <p className="mt-1 text-amber-400/90">{t('error.hintTimeout')}</p>
              )}
            </div>
            <button onClick={() => setMergeError(null)} className="text-red-500 hover:text-red-300 shrink-0">
              <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          </div>
        </div>
      )}

      {/* ── Warnungen + Fehlerreport ──────────────────────────────────── */}
      {mergeWarnings.length > 0 && (
        <div className="max-w-5xl mx-auto px-4 md:px-6 pb-1">
          <div className="flex items-start gap-2 px-3 py-2 rounded-lg bg-amber-500/10 border border-amber-500/25 text-xs text-amber-400 animate-slide-up">
            <svg className="w-3.5 h-3.5 mt-0.5 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v4m0 4h.01M10.29 3.86L1.82 18a2 2 0 001.71 3h16.94a2 2 0 001.71-3L13.71 3.86a2 2 0 00-3.42 0z" />
            </svg>
            <div className="flex-1 min-w-0">
              <p className="font-medium mb-0.5">{t('warnings.filesFailed', { n: mergeWarnings.length })}</p>
              <ul className="space-y-0.5">
                {mergeWarnings.map((w, i) => <li key={i} className="truncate opacity-80">{w}</li>)}
              </ul>
            </div>
            <button
              type="button"
              onClick={downloadErrorReport}
              className="shrink-0 flex items-center gap-1 px-2 py-0.5 rounded text-amber-500 hover:text-amber-300 border border-amber-500/30 hover:border-amber-500/50 transition-colors"
              title="Fehlerreport als .txt herunterladen"
            >
              <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
              </svg>
              <span className="hidden sm:inline text-xs">{t('common.report')}</span>
            </button>
            <button type="button" onClick={() => setMergeWarnings([])} className="hover:text-amber-200 shrink-0">
              <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          </div>
        </div>
      )}

      {/* ── Ergebnis-Banner: per Portal über der Sticky-Bar (vergrößert die Bar nicht) ─ */}
      {hasResult && !successBannerFaded && (
        <Portal>
          <div
            className="fixed left-0 right-0 px-4 md:px-6 flex justify-center pointer-events-none"
            style={{ bottom: STICKY_FOOTER_HEIGHT_PX, zIndex: Z_INDEX.STICKY_FOOTER }}
          >
            <div
              className={[
                'pointer-events-auto flex flex-wrap items-center gap-2.5 px-3 py-2.5 rounded-lg bg-emerald-500/10 border border-emerald-500/25 shadow-lg animate-slide-up transition-opacity duration-[1500ms] ease-out max-w-5xl w-full',
                successBannerPhase === 'fading' ? 'opacity-0' : 'opacity-100',
              ].join(' ')}
            >
              <div className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-emerald-500/20">
                <svg className="w-3.5 h-3.5 text-emerald-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                </svg>
              </div>
              <span className="text-sm text-emerald-700 dark:text-emerald-300 font-medium min-w-0">
                {successBannerPhase === 'ready'
                  ? t('action.mergeSuccessMessage', { filename: downloadFilename ?? '' })
                  : t('action.mergeSuccessDownloading', { filename: downloadFilename ?? '' })}
              </span>
              <div className="flex items-center gap-2 w-full sm:w-auto sm:ml-auto shrink-0">
                <button
                  type="button"
                  onClick={clearResult}
                  className="text-zinc-500 dark:text-zinc-600 hover:text-zinc-700 dark:hover:text-zinc-400 p-1.5 rounded hover:bg-zinc-200 dark:hover:bg-surface-700 shrink-0"
                  title={t('action.closeResult')}
                >
                  <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                  </svg>
                </button>
              </div>
            </div>
          </div>
        </Portal>
      )}

      {/* ── Haupt-Leiste (Hintergrund/Border kommt vom MergePage-Sticky-Wrapper) ─ */}
      <div>
        <div className="max-w-5xl mx-auto">

          {/* Mobile: 2-Zeilen-Layout */}
          <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:gap-3">

            {/* Zeile 1 (mobile) / Links (desktop): Dateiname */}
            <div className="flex items-center gap-1.5 min-w-0 flex-1 order-2 sm:order-1">
              {editingName ? (
                <div className="flex items-center gap-1 flex-1 min-w-0">
                  <input
                    ref={inputRef}
                    type="text"
                    value={nameInput}
                    onChange={(e) => setNameInput(e.target.value)}
                    onKeyDown={(e) => { if (e.key === 'Enter') commitName(); if (e.key === 'Escape') setEditingName(false); }}
                    onBlur={commitName}
                    className="flex-1 min-w-0 bg-zinc-200 dark:bg-surface-700 border border-emerald-500/40 rounded px-2 py-1 text-xs text-zinc-800 dark:text-zinc-200 outline-none focus:border-emerald-500/70"
                    placeholder={t('action.filenamePlaceholder', { ext })}
                  />
                  {isCustomFilename && (
                    <button type="button" onClick={resetName} className="text-zinc-500 dark:text-zinc-600 hover:text-zinc-600 dark:hover:text-zinc-400 shrink-0" title="Auto-Namen wiederherstellen">
                      <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                        <path strokeLinecap="round" strokeLinejoin="round" d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
                      </svg>
                    </button>
                  )}
                </div>
              ) : (
                <button
                  type="button"
                  onClick={startEditing}
                  disabled={noFiles}
                  className="flex items-center gap-1.5 min-w-0 group disabled:opacity-40"
                  title="Dateinamen bearbeiten"
                >
                  <svg className="w-3.5 h-3.5 text-zinc-500 dark:text-zinc-600 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                  </svg>
                  <span className="text-xs text-zinc-600 dark:text-zinc-400 truncate max-w-[160px] sm:max-w-xs group-hover:text-zinc-800 dark:group-hover:text-zinc-200 transition-colors">
                    {displayBasename}<span className="text-zinc-500 dark:text-zinc-600">{ext}</span>
                  </span>
                  {!isCustomFilename && <span className="text-xs text-zinc-500 dark:text-zinc-700 shrink-0 hidden sm:inline">{t('action.auto')}</span>}
                  <svg className="w-3 h-3 text-zinc-500 dark:text-zinc-700 group-hover:text-zinc-600 dark:group-hover:text-zinc-400 shrink-0 transition-colors" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.572L16.732 3.732z" />
                  </svg>
                </button>
              )}
            </div>

            <div className="hidden sm:block h-6 w-px bg-zinc-300 dark:bg-surface-600 shrink-0" />

            {/* Zeile 0 (mobile) / Rechts (desktop): Buttons – Download links, damit Neu mergen nicht springt */}
            <div className="flex items-center gap-2 order-1 sm:order-2">

              {/* Herunterladen (nur bei Ergebnis – links vom Neu-mergen-Button) */}
              {hasResult ? (
                <button
                  type="button"
                  onClick={() => {
                    setDownloadButtonUsed(true);
                    setSuccessBannerPhase('downloading');
                    handleDownloadWithSave();
                    successBannerTimeoutsRef.current.forEach((id) => clearTimeout(id));
                    successBannerTimeoutsRef.current = [];
                    const t1 = setTimeout(() => setSuccessBannerPhase('fading'), 1200);
                    const t2 = setTimeout(() => {
                      setSuccessBannerFaded(true);
                      setSuccessBannerPhase('ready');
                    }, 2700);
                    successBannerTimeoutsRef.current = [t1, t2];
                  }}
                  disabled={downloadBarLoading || actionLoading}
                  className={[
                    'btn-primary py-2.5 px-4 sm:px-5 text-sm font-bold tracking-wide shrink-0 ring-2 ring-emerald-400 ring-offset-2 ring-offset-white dark:ring-offset-surface-900 shadow-lg shadow-emerald-500/25',
                    !downloadButtonUsed ? 'btn-download-glow' : '',
                  ].filter(Boolean).join(' ')}
                >
                  <svg className="w-4 h-4 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
                  </svg>
                  <span>{downloadBarLoading || actionLoading ? '…' : t('action.download')}</span>
                </button>
              ) : (
                /* Platzhalter in gleicher Breite wie Herunterladen-Button, damit „Neu mergen“ nicht springt */
                <div className="w-[8.5rem] shrink-0" aria-hidden />
              )}

              {/* Merge-Button */}
              <button
                type="button"
                onClick={handleMerge}
                disabled={noFiles || isProcessing}
                className={['btn-primary py-2.5 px-4 sm:px-6 text-sm font-bold tracking-wide shrink-0 flex-1 sm:flex-none', hasResult ? 'ring-2 ring-emerald-500/20' : ''].join(' ')}
              >
                {isProcessing ? (
                  <>
                    <svg className="w-4 h-4 animate-spin-slow shrink-0" viewBox="0 0 24 24" fill="none">
                      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="3" />
                      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                    </svg>
                    <span className="truncate max-w-[200px]">{buttonLabel}</span>
                  </>
                ) : (
                  <>
                    <svg className="w-4 h-4 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                      <path strokeLinecap="round" strokeLinejoin="round" d="M8 7h12m0 0l-4-4m4 4l-4 4m0 6H4m0 0l4 4m-4-4l4-4" />
                    </svg>
                    <span>
                      {hasResult
                        ? t('action.mergeAgain')
                        : selectedFileIds.length > 0
                          ? t('action.mergeSelection', { n: mergeCount })
                          : t('action.mergeAll', { totalCount: mergeCount })}
                    </span>
                  </>
                )}
              </button>

              {/* Abbrechen (nur während Verarbeitung nach Upload) */}
              {isProcessing && uploadPhase === 'processing' && (
                <button
                  type="button"
                  onClick={handleCancelMerge}
                  className="btn-secondary py-2.5 px-3 text-sm font-medium shrink-0 border-red-500/30 text-red-400 hover:bg-red-500/10 hover:border-red-500/50"
                >
                  {t('action.cancel')}
                </button>
              )}

              {/* Reset */}
              <button type="button" onClick={reset} className="btn-secondary py-2 shrink-0" title={t('common.reset')}>
                <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
                </svg>
              </button>
            </div>
          </div>

          {/* SSE-Fortschrittsleiste (nur während Verarbeitung) */}
          {isProcessing && uploadPhase === 'processing' && (
            <div className="mt-2 h-1 rounded-full bg-zinc-200 dark:bg-surface-700 overflow-hidden">
              <div
                className="h-full bg-emerald-500 transition-all duration-500 ease-out"
                style={{ width: `${Math.min(100, Math.round(sseProgress))}%` }}
              />
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
