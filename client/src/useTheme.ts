const STORAGE_KEY = 'eXmerg-theme';

export type Theme = 'dark' | 'light';

export function getStoredTheme(): Theme {
  if (typeof window === 'undefined') return 'dark';
  const v = localStorage.getItem(STORAGE_KEY);
  return v === 'light' ? 'light' : 'dark';
}

export function applyTheme(theme: Theme): void {
  if (typeof document === 'undefined') return;
  if (theme === 'dark') document.documentElement.classList.add('dark');
  else document.documentElement.classList.remove('dark');
  localStorage.setItem(STORAGE_KEY, theme);
}
