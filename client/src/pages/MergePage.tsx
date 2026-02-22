import { UploadArea } from '../components/UploadArea';
import { FileList } from '../components/FileList';
import { MergeOptionsPanel } from '../components/MergeOptionsPanel';
import { DownloadHistory } from '../components/DownloadHistory';
import { ActionBar } from '../components/ActionBar';
import { StatusBanner } from '../components/StatusBanner';
import { DuplicateFilesBanner } from '../components/DuplicateFilesBanner';
import { ThemeToggle } from '../components/ThemeToggle';
import { LanguageToggle } from '../components/LanguageToggle';
import { useT } from '../i18n';
import { useStore, type RejectedFile, type UploadErrorReason } from '../store/useStore';
import { Z_INDEX } from '../constants/zIndex';
import { DEFAULT_FILE_LIMITS } from 'shared';

const MAX_SIZE_MB = Math.round(DEFAULT_FILE_LIMITS.maxFileSizeBytes / (1024 * 1024));
const MAX_TOTAL_MB = Math.round(DEFAULT_FILE_LIMITS.maxTotalSizeBytes / (1024 * 1024));

function formatRejectionReasons(
  reasons: UploadErrorReason[],
  t: (key: string, vars?: Record<string, string | number>) => string,
): string {
  return reasons
    .map((r) => {
      if (r === 'invalidType') return t('upload.errors.invalidType');
      if (r === 'fileTooLarge') return t('upload.errors.fileTooLarge', { maxSize: `${MAX_SIZE_MB} MB` });
      return t('upload.errors.totalSizeExceeded', { maxTotalSize: `${MAX_TOTAL_MB} MB` });
    })
    .join(', ');
}

function buildUploadErrorBannerContent(
  rejected: RejectedFile[],
  t: (key: string, vars?: Record<string, string | number>) => string,
): { title: string; items: string[] } {
  const formatReasons = (reasons: UploadErrorReason[]) => formatRejectionReasons(reasons, t);
  if (rejected.length === 1) {
    const r = rejected[0]!;
    const reasonText = formatReasons(r.reasons);
    return {
      title: `${t('upload.errors.single', { filename: r.name })} – ${reasonText}`,
      items: [],
    };
  }
  return {
    title: t('upload.errors.title', { count: rejected.length }),
    items: rejected.map((r) => `${r.name} – ${formatReasons(r.reasons)}`),
  };
}

export function MergePage() {
  const t = useT();
  const rejectedFiles = useStore((s) => s.rejectedFiles);
  const clearRejectedFiles = useStore((s) => s.clearRejectedFiles);

  const uploadErrorBanner =
    rejectedFiles.length > 0 ? (() => {
      const { title, items } = buildUploadErrorBannerContent(rejectedFiles, t);
      return (
        <StatusBanner
          variant="error"
          title={title}
          items={items}
          itemCount={rejectedFiles.length}
          collapsible
          onClose={clearRejectedFiles}
          closable
          closeLabel={t('duplicates.dismiss')}
          expandLabel={t('duplicates.expand')}
          collapseLabel={t('duplicates.collapse')}
        />
      );
    })() : null;

  return (
    <div className="min-h-screen bg-zinc-50 dark:bg-surface-950 flex flex-col">

      {/* ── Sticky Top Header ─────────────────────────────────────────── */}
      <header className="sticky top-0 z-20 border-b border-zinc-200 dark:border-surface-600 bg-white/90 dark:bg-surface-900/90 backdrop-blur-md">
        <div className="max-w-5xl mx-auto px-4 md:px-6 py-3 flex items-center gap-3 lg:max-w-none">
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

      {/* ── Main: eine Spalte – pb-24 damit Inhalt nicht hinter Sticky-Bar verschwindet ─ */}
      <main className="flex-1 w-full px-4 md:px-6 pt-5 pb-24 max-w-5xl mx-auto flex flex-col gap-4">
        <div id="upload-area">
          <UploadArea />
        </div>
        {uploadErrorBanner}
        <DuplicateFilesBanner />
        <FileList />
        <MergeOptionsPanel />
        <DownloadHistory />
      </main>

      {/* ── Sticky Bottom Action Bar (Viewport, immer sichtbar) ───────────── */}
      <div
        className="sticky bottom-0 w-full border-t border-zinc-200 dark:border-surface-800 bg-white/95 dark:bg-surface-950/80 backdrop-blur-md"
        style={{ zIndex: Z_INDEX.STICKY_FOOTER }}
      >
        <div className="max-w-7xl mx-auto px-4 py-3">
          <ActionBar />
        </div>
      </div>
    </div>
  );
}
