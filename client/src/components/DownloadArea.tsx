import { useStore } from '../store/useStore';

export function DownloadArea() {
  const downloadUrl = useStore((s) => s.downloadUrl);
  const downloadFilename = useStore((s) => s.downloadFilename);
  const reset = useStore((s) => s.reset);

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
            <a
              href={downloadUrl}
              download={downloadFilename}
              className="btn-primary"
            >
              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
              </svg>
              Herunterladen
            </a>

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
