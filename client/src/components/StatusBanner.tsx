import type { ReactNode } from 'react';
import { useState, useEffect, useRef } from 'react';

export type StatusBannerVariant = 'error' | 'warning' | 'success';

const VARIANT_STYLES: Record<
  StatusBannerVariant,
  { container: string; icon: string; title: string; item: string; close: string }
> = {
  error: {
    container:
      'rounded-lg bg-red-500/10 border border-red-500/25 text-xs text-red-400 animate-slide-up overflow-hidden',
    icon: 'text-red-400',
    title: 'text-red-700 dark:text-red-300',
    item: 'text-red-300/95',
    close: 'hover:bg-red-500/20 text-red-200',
  },
  warning: {
    container:
      'rounded-lg bg-amber-500/10 border border-amber-500/25 text-xs text-amber-400 animate-slide-up overflow-hidden',
    icon: 'text-amber-400',
    title: 'text-amber-700 dark:text-amber-300',
    item: 'text-amber-300/95',
    close: 'hover:bg-amber-500/20 text-amber-200',
  },
  success: {
    container:
      'rounded-lg bg-emerald-500/10 border border-emerald-500/25 text-xs text-emerald-400 animate-slide-up overflow-hidden',
    icon: 'text-emerald-400',
    title: 'text-emerald-700 dark:text-emerald-300',
    item: 'text-emerald-300/95',
    close: 'hover:bg-emerald-500/20 text-emerald-200',
  },
};

/** AlertTriangle (Warning/Error) – gleicher Stil wie Konflikt-Banner. */
function IconAlertTriangle({ className }: { className?: string }) {
  return (
    <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
      <path
        strokeLinecap="round"
        strokeLinejoin="round"
        d="M12 9v4m0 4h.01M10.29 3.86L1.82 18a2 2 0 001.71 3h16.94a2 2 0 001.71-3L13.71 3.86a2 2 0 00-3.42 0z"
      />
    </svg>
  );
}

function IconCheck({ className }: { className?: string }) {
  return (
    <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
    </svg>
  );
}

export interface StatusBannerProps {
  variant: StatusBannerVariant;
  title: string;
  items?: string[];
  /** Optionales benutzerdefiniertes Markup (z. B. Checkbox-Liste) statt items. */
  children?: ReactNode;
  /** Bei collapsible: Anzahl Einträge (items.length oder z. B. duplicateFiles.length). Default collapsed wenn > 3. */
  itemCount?: number;
  /** Collapsed-Ansicht: nur Titel + Toggle. Expanded: Liste mit max-h-48 overflow-y-auto. */
  collapsible?: boolean;
  /** Wenn true: children werden nicht in ein scrollbares max-h-48 div gepackt (z. B. für eigenes Layout mit fixen Buttons + scrollbarer Liste). */
  noScrollWrapper?: boolean;
  onClose: () => void;
  /** Nach dieser Zeit (ms) Fade-Out, danach onClose. Nur bei variant="success". */
  fadeAfterMs?: number;
  closable?: boolean;
  /** Titel/Aria-Label für Schließen-Button (z. B. aus i18n). */
  closeLabel?: string;
  /** Aria-Label für Toggle (z. B. aus i18n). */
  expandLabel?: string;
  collapseLabel?: string;
}

export function StatusBanner({
  variant,
  title,
  items = [],
  children,
  itemCount,
  collapsible = false,
  noScrollWrapper = false,
  onClose,
  fadeAfterMs,
  closable = true,
  closeLabel,
  expandLabel,
  collapseLabel,
}: StatusBannerProps) {
  const [fading, setFading] = useState(false);
  const [expanded, setExpanded] = useState(() => {
    const count = itemCount ?? items.length;
    return count <= 3;
  });
  const timeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const count = itemCount ?? items.length;
  const isCollapsible = collapsible && count > 3;
  const showExpanded = !isCollapsible || expanded;

  useEffect(() => {
    if (variant === 'error' || variant === 'warning') return;
    if (fadeAfterMs == null || fadeAfterMs <= 0) return;
    timeoutRef.current = setTimeout(() => setFading(true), fadeAfterMs);
    return () => {
      if (timeoutRef.current) clearTimeout(timeoutRef.current);
      timeoutRef.current = null;
    };
  }, [variant, fadeAfterMs]);

  const handleTransitionEnd = () => {
    if (fading) onClose();
  };

  const styles = VARIANT_STYLES[variant];
  const Icon = variant === 'success' ? IconCheck : IconAlertTriangle;

  return (
    <div
      className={[
        styles.container,
        'transition-opacity duration-500 ease-out',
        fading ? 'opacity-0' : 'opacity-100',
      ].join(' ')}
      onTransitionEnd={handleTransitionEnd}
      role="alert"
    >
      <div className="flex items-start gap-2 px-3 py-2">
        <Icon className={`w-3.5 h-3.5 shrink-0 mt-0.5 ${styles.icon}`} />
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <p className={`font-medium min-w-0 ${styles.title}`}>{title}</p>
            {isCollapsible && (
              <button
                type="button"
                onClick={() => setExpanded((e) => !e)}
                className={`shrink-0 px-2 py-0.5 rounded text-xs ${styles.close}`}
                aria-expanded={expanded}
                title={expanded ? collapseLabel : expandLabel}
                aria-label={expanded ? collapseLabel : expandLabel}
              >
                {expanded ? collapseLabel : expandLabel}
                <svg
                  className={[
                    'inline-block w-3.5 h-3.5 ml-0.5 align-middle transition-transform',
                    expanded ? 'rotate-180' : '',
                  ].join(' ')}
                  fill="none"
                  viewBox="0 0 24 24"
                  stroke="currentColor"
                  strokeWidth={2}
                >
                  <path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7" />
                </svg>
              </button>
            )}
          </div>
          {showExpanded &&
            (children != null ? (
              noScrollWrapper ? (
                <div className="mt-1.5 pr-2">{children}</div>
              ) : (
                <div className="mt-1.5 max-h-48 overflow-y-auto pr-2 space-y-1">{children}</div>
              )
            ) : items.length > 0 ? (
              <ul className="mt-1.5 space-y-1 list-none pl-0 max-h-48 overflow-y-auto pr-2">
                {items.map((item, i) => (
                  <li key={i} className={`break-all ${styles.item}`}>
                    {item}
                  </li>
                ))}
              </ul>
            ) : null)}
        </div>
        {closable && (
          <button
            type="button"
            onClick={onClose}
            className={`shrink-0 p-0.5 rounded ${styles.close}`}
            title={closeLabel}
            aria-label={closeLabel}
          >
            <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        )}
      </div>
    </div>
  );
}
