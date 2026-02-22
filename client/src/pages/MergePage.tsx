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
import { useFileDrop } from '../hooks/useFileDrop';
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
  const { onDrop, onDragOver, onDragLeave, isDragOver, validateAndAdd, full } = useFileDrop();
  const fileCount = useStore((s) => s.files.length);

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
    <div
      className="min-h-screen bg-zinc-50 dark:bg-surface-950 flex flex-col relative"
      onDrop={onDrop}
      onDragOver={onDragOver}
      onDragLeave={onDragLeave}
    >
      {/* ── Full-Page Drop-Overlay (wenn Dateien über die Seite gezogen werden) ─ */}
      {isDragOver && (
        <div
          className="fixed inset-0 z-30 flex items-center justify-center bg-emerald-500/10 dark:bg-emerald-500/15 border-4 border-dashed border-emerald-500/50 rounded-none pointer-events-none"
          aria-hidden
        >
          <div className="flex flex-col items-center gap-2 px-6 py-4 rounded-2xl bg-white/90 dark:bg-surface-900/95 backdrop-blur-md border border-emerald-500/30 shadow-xl">
            <svg className="w-12 h-12 text-emerald-500 dark:text-emerald-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M12 16.5V9.75m0 0l3 3m-3-3l-3 3M6.75 19.5a4.5 4.5 0 01-1.41-8.775 5.25 5.25 0 0110.338-2.32 5.75 5.75 0 011.987 4.595A4.5 4.5 0 0117.25 19.5H6.75z" />
            </svg>
            <span className="text-lg font-semibold text-emerald-700 dark:text-emerald-300">{t('upload.dropToAdd')}</span>
          </div>
        </div>
      )}

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
          <UploadArea validateAndAdd={validateAndAdd} full={full} fileCount={fileCount} />
        </div>
        {uploadErrorBanner}
        <DuplicateFilesBanner />
        <FileList />
        <MergeOptionsPanel />
        <DownloadHistory />
      </main>

      {/* ── Sticky Bottom Action Bar (gleiche Optik wie Header oben) ──────── */}
      <div
        className="sticky bottom-0 z-20 w-full border-t border-zinc-200 dark:border-surface-600 bg-white/90 dark:bg-surface-900/90 backdrop-blur-md"
        style={{ zIndex: Z_INDEX.STICKY_FOOTER }}
      >
        <div className="max-w-5xl mx-auto px-4 md:px-6 py-3 lg:max-w-none">
          <ActionBar />
        </div>
      </div>
    </div>
  );
}
