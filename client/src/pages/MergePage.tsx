import { UploadArea } from '../components/UploadArea';
import { FileList } from '../components/FileList';
import { MergeOptionsPanel } from '../components/MergeOptionsPanel';
import { DownloadHistory } from '../components/DownloadHistory';
import { ActionBar } from '../components/ActionBar';
import { ThemeToggle } from '../components/ThemeToggle';
import { LanguageToggle } from '../components/LanguageToggle';
import { useT } from '../i18n';

export function MergePage() {
  const t = useT();
  return (
    <div className="min-h-screen bg-zinc-50 dark:bg-surface-950 flex flex-col">

      {/* ── Sticky Top Header ─────────────────────────────────────────── */}
      <header className="sticky top-0 z-20 border-b border-zinc-200 dark:border-surface-600 bg-white/90 dark:bg-surface-900/90 backdrop-blur-md">
        <div className="max-w-5xl mx-auto px-4 md:px-6 py-3 flex items-center gap-3">
          <div className="flex items-center justify-center w-8 h-8 rounded-lg bg-emerald-500/20 border border-emerald-500/30 shrink-0">
            <svg className="w-4 h-4 text-emerald-500 dark:text-emerald-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M8 7h12m0 0l-4-4m4 4l-4 4m0 6H4m0 0l4 4m-4-4l4-4" />
            </svg>
          </div>
          <div className="flex-1 min-w-0">
            <h1 className="text-base font-bold text-zinc-900 dark:text-zinc-100 leading-none">eXmerg</h1>
            <p className="text-[11px] text-zinc-500 mt-0.5 leading-none">{t('app.subtitle')}</p>
          </div>
          <div className="flex items-center gap-2">
            <LanguageToggle />
            <ThemeToggle />
          </div>
        </div>
      </header>

      {/* ── Main scrollable content ────────────────────────────────────── */}
      {/* pb-24 = Platz für die sticky Footer-Leiste */}
      <main className="flex-1 max-w-5xl w-full mx-auto px-4 md:px-6 pt-5 pb-28 space-y-4">

        {/* Upload-Zone (kompakt) – id für Fokus nach „Nochmal mergen“ */}
        <div id="upload-area">
          <UploadArea />
        </div>

        {/* Datei-Liste */}
        <FileList />

        {/* Merge-Optionen (volle Breite) */}
        <MergeOptionsPanel />

        {/* Download-Verlauf */}
        <DownloadHistory />

      </main>

      {/* ── Sticky Bottom Action Bar ───────────────────────────────────── */}
      <ActionBar />
    </div>
  );
}
