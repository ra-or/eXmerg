import { useState } from 'react';
import { useStore } from '../store/useStore';
import { useLocalMergeHistory } from '../hooks/useLocalMergeHistory';

export function DownloadArea() {
  const downloadUrl = useStore((s) => s.downloadUrl);
  const downloadFilename = useStore((s) => s.downloadFilename);
  const lastMergeHistoryMeta = useStore((s) => s.lastMergeHistoryMeta);
  const reset = useStore((s) => s.reset);
  const { saveMerge, downloadMerge, hasLocalBlob, actionLoading } = useLocalMergeHistory();
  const [downloading, setDownloading] = useState(false);

  const handleDownload = async () => {
    if (!downloadFilename) return;
    setDownloading(true);
    try {
      // Zuerst aus dem Browser (IndexedDB), falls schon nach Merge gespeichert
      if (lastMergeHistoryMeta && hasLocalBlob(lastMergeHistoryMeta.id)) {
        await downloadMerge(lastMergeHistoryMeta.id);
        setDownloading(false);
        return;
      }
      // Sonst einmalig vom Server holen und anzeigen
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
      setDownloading(false);
    }
  };

  if (!downloadUrl || !downloadFilename) return null;

  return (
    <div className="animate-slide-up rounded-xl border border-emerald-500/30 bg-emerald-500/5 p-5">
      <div className="flex items-start gap-4">
        {/* Icon */}
        <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-emerald-500/15 border border-emerald-500/25">
          <svg className="w-5 h-5 text-emerald-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
          </svg>
        </div>

        {/* Text + buttons */}
        <div className="flex-1 min-w-0">
          <p className="text-sm font-semibold text-emerald-300">Merge abgeschlossen!</p>
          <p className="text-xs text-zinc-500 mt-0.5 truncate">{downloadFilename}</p>

          <div className="flex flex-wrap items-center gap-2 mt-3">
            <button
              type="button"
              onClick={handleDownload}
              disabled={downloading || actionLoading}
              className="btn-primary"
            >
              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
              </svg>
              {downloading || actionLoading ? '…' : 'Herunterladen'}
            </button>

            <button
              type="button"
              onClick={reset}
              className="btn-secondary"
            >
              <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
              </svg>
              Neu starten
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
