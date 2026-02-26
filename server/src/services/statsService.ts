import fs from 'fs/promises';
import path from 'path';

export interface DailyStats {
  date: string;
  pageViews: number;
  uploads: number;
  uploadBytes: number;
  uploadsByType: Record<string, number>;
  merges: number;
  mergesByMode: Record<string, number>;
  mergeFiles: number;
  mergeDurationMs: number;
  mergeErrors: number;
  downloads: number;
}

export interface StatsData {
  totalPageViews: number;
  totalUploads: number;
  totalMerges: number;
  totalDownloads: number;
  totalErrors: number;
  firstSeen: string;
  days: DailyStats[];
}

const EMPTY_STATS: StatsData = {
  totalPageViews: 0,
  totalUploads: 0,
  totalMerges: 0,
  totalDownloads: 0,
  totalErrors: 0,
  firstSeen: new Date().toISOString().slice(0, 10),
  days: [],
};

let statsFilePath = '';
let stats: StatsData = { ...EMPTY_STATS };
let dirty = false;

function today(): string {
  return new Date().toISOString().slice(0, 10);
}

function getOrCreateDay(date: string): DailyStats {
  let day = stats.days.find((d) => d.date === date);
  if (!day) {
    day = {
      date,
      pageViews: 0,
      uploads: 0,
      uploadBytes: 0,
      uploadsByType: {},
      merges: 0,
      mergesByMode: {},
      mergeFiles: 0,
      mergeDurationMs: 0,
      mergeErrors: 0,
      downloads: 0,
    };
    stats.days.push(day);
    if (stats.days.length > 90) stats.days.shift();
  }
  return day;
}

export async function initStats(uploadDir: string): Promise<void> {
  statsFilePath = path.join(uploadDir, '..', 'stats.json');
  try {
    const raw = await fs.readFile(statsFilePath, 'utf-8');
    stats = JSON.parse(raw) as StatsData;
  } catch {
    stats = { ...EMPTY_STATS, firstSeen: today() };
  }
  setInterval(flushStats, 30_000);
}

async function flushStats(): Promise<void> {
  if (!dirty || !statsFilePath) return;
  dirty = false;
  try {
    await fs.writeFile(statsFilePath, JSON.stringify(stats, null, 2), 'utf-8');
  } catch {
    dirty = true;
  }
}

export function recordPageView(): void {
  stats.totalPageViews++;
  getOrCreateDay(today()).pageViews++;
  dirty = true;
}

export function recordUpload(fileExtension: string, sizeBytes: number): void {
  stats.totalUploads++;
  const day = getOrCreateDay(today());
  day.uploads++;
  day.uploadBytes += sizeBytes;
  const ext = fileExtension.toLowerCase();
  day.uploadsByType[ext] = (day.uploadsByType[ext] ?? 0) + 1;
  dirty = true;
}

export function recordMerge(mode: string, fileCount: number, durationMs: number): void {
  stats.totalMerges++;
  const day = getOrCreateDay(today());
  day.merges++;
  day.mergesByMode[mode] = (day.mergesByMode[mode] ?? 0) + 1;
  day.mergeFiles += fileCount;
  day.mergeDurationMs += durationMs;
  dirty = true;
}

export function recordMergeError(): void {
  stats.totalErrors++;
  getOrCreateDay(today()).mergeErrors++;
  dirty = true;
}

export function recordDownload(): void {
  stats.totalDownloads++;
  getOrCreateDay(today()).downloads++;
  dirty = true;
}

export function getStats(): StatsData {
  return stats;
}

export function renderDashboardHtml(data: StatsData): string {
  const last7 = data.days.slice(-7);
  const last30 = data.days.slice(-30);

  const sum = (arr: DailyStats[], fn: (d: DailyStats) => number) => arr.reduce((s, d) => s + fn(d), 0);
  const avgMergeDuration = (arr: DailyStats[]) => {
    const total = sum(arr, (d) => d.mergeDurationMs);
    const count = sum(arr, (d) => d.merges);
    return count > 0 ? Math.round(total / count) : 0;
  };

  const modeStats: Record<string, number> = {};
  for (const d of data.days) {
    for (const [mode, count] of Object.entries(d.mergesByMode)) {
      modeStats[mode] = (modeStats[mode] ?? 0) + count;
    }
  }
  const typeStats: Record<string, number> = {};
  for (const d of data.days) {
    for (const [ext, count] of Object.entries(d.uploadsByType)) {
      typeStats[ext] = (typeStats[ext] ?? 0) + count;
    }
  }

  const formatBytes = (b: number) =>
    b < 1024 * 1024 ? `${(b / 1024).toFixed(1)} KB` : `${(b / 1024 / 1024).toFixed(1)} MB`;

  const dayRows = [...data.days]
    .reverse()
    .slice(0, 30)
    .map(
      (d) =>
        `<tr><td>${d.date}</td><td>${d.pageViews}</td><td>${d.uploads}</td><td>${d.merges}</td><td>${d.downloads}</td><td>${d.mergeErrors}</td><td>${avgMergeDuration([d])}ms</td></tr>`,
    )
    .join('');

  const modeRows = Object.entries(modeStats)
    .sort((a, b) => b[1] - a[1])
    .map(([mode, count]) => `<tr><td>${mode}</td><td>${count}</td></tr>`)
    .join('');

  const typeRows = Object.entries(typeStats)
    .sort((a, b) => b[1] - a[1])
    .map(([ext, count]) => `<tr><td>${ext}</td><td>${count}</td></tr>`)
    .join('');

  return `<!DOCTYPE html>
<html lang="de">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>eXmerg – Statistiken</title>
  <style>
    * { margin: 0; padding: 0; box-sizing: border-box; }
    body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif; background: #0a0a0a; color: #e4e4e7; padding: 24px; max-width: 900px; margin: 0 auto; }
    h1 { font-size: 1.5rem; margin-bottom: 4px; color: #10b981; }
    .subtitle { color: #71717a; font-size: 0.85rem; margin-bottom: 24px; }
    .cards { display: grid; grid-template-columns: repeat(auto-fit, minmax(140px, 1fr)); gap: 12px; margin-bottom: 24px; }
    .card { background: #18181b; border: 1px solid #27272a; border-radius: 8px; padding: 16px; }
    .card .label { font-size: 0.75rem; color: #71717a; text-transform: uppercase; letter-spacing: 0.05em; }
    .card .value { font-size: 1.75rem; font-weight: 700; color: #f4f4f5; margin-top: 4px; }
    .card .sub { font-size: 0.7rem; color: #52525b; margin-top: 2px; }
    h2 { font-size: 1rem; margin: 20px 0 8px; color: #a1a1aa; }
    table { width: 100%; border-collapse: collapse; font-size: 0.8rem; margin-bottom: 20px; }
    th { text-align: left; padding: 6px 8px; border-bottom: 1px solid #27272a; color: #71717a; font-weight: 600; }
    td { padding: 5px 8px; border-bottom: 1px solid #1c1c1f; }
    tr:hover td { background: #1c1c1f; }
    .grid2 { display: grid; grid-template-columns: 1fr 1fr; gap: 16px; }
    @media (max-width: 600px) { .grid2 { grid-template-columns: 1fr; } .cards { grid-template-columns: repeat(2, 1fr); } }
  </style>
</head>
<body>
  <h1>eXmerg Statistiken</h1>
  <p class="subtitle">Seit ${data.firstSeen} · Stand ${new Date().toLocaleString('de-DE')}</p>

  <div class="cards">
    <div class="card">
      <div class="label">Seitenaufrufe</div>
      <div class="value">${data.totalPageViews}</div>
      <div class="sub">Letzte 7 Tage: ${sum(last7, (d) => d.pageViews)}</div>
    </div>
    <div class="card">
      <div class="label">Uploads</div>
      <div class="value">${data.totalUploads}</div>
      <div class="sub">Letzte 7 Tage: ${sum(last7, (d) => d.uploads)}</div>
    </div>
    <div class="card">
      <div class="label">Merges</div>
      <div class="value">${data.totalMerges}</div>
      <div class="sub">Letzte 7 Tage: ${sum(last7, (d) => d.merges)}</div>
    </div>
    <div class="card">
      <div class="label">Downloads</div>
      <div class="value">${data.totalDownloads}</div>
      <div class="sub">Letzte 7 Tage: ${sum(last7, (d) => d.downloads)}</div>
    </div>
    <div class="card">
      <div class="label">Fehler</div>
      <div class="value">${data.totalErrors}</div>
      <div class="sub">Letzte 7 Tage: ${sum(last7, (d) => d.mergeErrors)}</div>
    </div>
    <div class="card">
      <div class="label">⌀ Merge-Dauer</div>
      <div class="value">${avgMergeDuration(last30)}ms</div>
      <div class="sub">Upload-Volumen: ${formatBytes(sum(last30, (d) => d.uploadBytes))}</div>
    </div>
  </div>

  <div class="grid2">
    <div>
      <h2>Merge-Modi</h2>
      <table><tr><th>Modus</th><th>Anzahl</th></tr>${modeRows || '<tr><td colspan="2">–</td></tr>'}</table>
    </div>
    <div>
      <h2>Dateitypen</h2>
      <table><tr><th>Format</th><th>Uploads</th></tr>${typeRows || '<tr><td colspan="2">–</td></tr>'}</table>
    </div>
  </div>

  <h2>Tagesverlauf (letzte 30 Tage)</h2>
  <table>
    <tr><th>Datum</th><th>Views</th><th>Uploads</th><th>Merges</th><th>Downloads</th><th>Fehler</th><th>⌀ Dauer</th></tr>
    ${dayRows || '<tr><td colspan="7">Noch keine Daten</td></tr>'}
  </table>
</body>
</html>`;
}
