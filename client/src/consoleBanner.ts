/**
 * Beim App-Start: Banner + Tagline in der Browser-Konsole.
 * Leicht animiert (Titel erscheint, dann Tagline).
 */

const TAGLINE = 'Excel · ODS merge — no cloud, no track.';

const STYLE_TITLE = [
  'color: #10b981;',
  'font-family: ui-monospace, monospace;',
  'font-size: 28px;',
  'font-weight: bold;',
  'letter-spacing: 0.15em;',
].join(' ');

const STYLE_TAGLINE = [
  'color: #6b7280;',
  'font-family: ui-monospace, monospace;',
  'font-size: 11px;',
].join(' ');

const TITLE_DELAY_MS = 0;
const TAGLINE_DELAY_MS = 350;

function logBannerAnimated(): void {
  if (typeof window === 'undefined' || !window.console) return;

  setTimeout(() => {
    console.log('%c eXmerg ', STYLE_TITLE);
  }, TITLE_DELAY_MS);

  setTimeout(() => {
    console.log('%c' + TAGLINE, STYLE_TAGLINE);
  }, TITLE_DELAY_MS + TAGLINE_DELAY_MS);
}

export function initConsoleBanner(): void {
  try {
    logBannerAnimated();
  } catch {
    // Konsole nicht verfügbar oder unterdrückt – ignorieren
  }
}
