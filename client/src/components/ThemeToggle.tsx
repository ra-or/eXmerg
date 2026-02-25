import { useState, useEffect } from 'react';
import { getStoredTheme, applyTheme, type Theme } from '../useTheme';

export function ThemeToggle() {
  const [theme, setThemeState] = useState<Theme>(() => getStoredTheme());

  useEffect(() => {
    applyTheme(theme);
  }, [theme]);

  const toggle = () => {
    const next = theme === 'dark' ? 'light' : 'dark';
    setThemeState(next);
    applyTheme(next);
  };

  const isDark = theme === 'dark';

  return (
    <button
      type="button"
      onClick={toggle}
      className="flex items-center justify-center w-9 h-9 rounded-lg bg-zinc-200 dark:bg-surface-700 border border-zinc-300 dark:border-surface-500 text-zinc-700 dark:text-zinc-300 hover:bg-zinc-300 dark:hover:bg-surface-600 transition-colors"
      title={isDark ? 'Hell modus' : 'Dunkel modus'}
      aria-label={isDark ? 'Zu hellem Design wechseln' : 'Zu dunklem Design wechseln'}
    >
      {isDark ? (
        <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            d="M12 3v1m0 16v1m9-9h-1M4 12H3m15.364 6.364l-.707-.707M6.343 6.343l-.707-.707m12.728 0l-.707.707M6.343 17.657l-.707.707M16 12a4 4 0 11-8 0 4 4 0 018 0z"
          />
        </svg>
      ) : (
        <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            d="M20.354 15.354A9 9 0 018.646 3.646 9.003 9.003 0 0012 21a9.003 9.003 0 008.354-5.646z"
          />
        </svg>
      )}
    </button>
  );
}
