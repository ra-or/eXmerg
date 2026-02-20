import { useStore, type Locale } from '../store/useStore';

const LOCALES: { value: Locale; label: string; aria: string }[] = [
  { value: 'de', label: 'Deutsch', aria: 'Deutsch' },
  { value: 'en', label: 'English', aria: 'English' },
];

/** Deutsche Flagge (Schwarz-Rot-Gold, 3 Streifen) */
function FlagDE({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 30 20" className={className} aria-hidden>
      <rect width="30" height="20" fill="#000" />
      <rect y="6.67" width="30" height="6.66" fill="#D00" />
      <rect y="13.33" width="30" height="6.67" fill="#FFCE00" />
    </svg>
  );
}

/** Vereinigtes Königreich (Union Jack mit diagonalen Streifen) */
function FlagGB({ className }: { className?: string }) {
  const cx = 30;
  const cy = 15;
  return (
    <svg viewBox="0 0 60 30" className={className} aria-hidden>
      <rect width="60" height="30" fill="#012169" />
      {/* Weißer diagonaler Saltire (St Andrew) – das typische X */}
      <rect x={cx - 3} y="-20" width="6" height="70" transform={`rotate(45 ${cx} ${cy})`} fill="#fff" />
      <rect x={cx - 3} y="-20" width="6" height="70" transform={`rotate(-45 ${cx} ${cy})`} fill="#fff" />
      {/* Roter diagonaler Saltire (St Patrick) */}
      <rect x={cx - 1} y="-20" width="2" height="70" transform={`rotate(45 ${cx} ${cy})`} fill="#C8102E" />
      <rect x={cx - 1} y="-20" width="2" height="70" transform={`rotate(-45 ${cx} ${cy})`} fill="#C8102E" />
      {/* Rotes Kreuz (St George) mit weißer Kontur */}
      <rect x="0" y="12" width="60" height="6" fill="#fff" />
      <rect x="27" y="0" width="6" height="30" fill="#fff" />
      <rect x="0" y="13.5" width="60" height="3" fill="#C8102E" />
      <rect x="28.5" y="0" width="3" height="30" fill="#C8102E" />
    </svg>
  );
}

export function LanguageToggle() {
  const locale = useStore((s) => s.locale);
  const setLocale = useStore((s) => s.setLocale);

  return (
    <div className="flex items-center rounded-lg border border-zinc-300 dark:border-surface-500 bg-zinc-100 dark:bg-surface-700 p-0.5">
      {LOCALES.map(({ value, label, aria }) => (
        <button
          key={value}
          type="button"
          onClick={() => setLocale(value)}
          aria-label={aria}
          title={label}
          className={[
            'flex items-center justify-center min-w-[2.25rem] h-8 rounded-md overflow-hidden transition-colors border-2',
            locale === value
              ? 'bg-white dark:bg-surface-600 border-zinc-400 dark:border-zinc-500 shadow-sm ring-1 ring-zinc-300 dark:ring-zinc-500'
              : 'border-transparent opacity-70 hover:opacity-100',
          ].join(' ')}
        >
          {value === 'de' ? (
            <FlagDE className="w-7 h-[0.95rem] object-cover" />
          ) : (
            <FlagGB className="w-7 h-[0.95rem] object-cover" />
          )}
        </button>
      ))}
    </div>
  );
}
