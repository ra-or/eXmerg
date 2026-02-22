/**
 * Räumt periodisch alte temporäre Dateien im Upload-Verzeichnis auf.
 * Löscht alle Dateien, die älter als `ttlSeconds` Sekunden sind.
 */

import fs from 'fs/promises';
import path from 'path';

export function startTempCleanup(uploadDir: string, ttlSeconds: number): void {
  const intervalMs = Math.max(ttlSeconds * 1000, 30_000); // mind. 30 s

  const cleanup = async () => {
    const cutoff = Date.now() - ttlSeconds * 1000;
    try {
      await cleanDir(uploadDir, cutoff);
      // Unterordner (z. B. merge-output/)
      const entries = await fs.readdir(uploadDir, { withFileTypes: true });
      for (const e of entries) {
        if (e.isDirectory()) {
          await cleanDir(path.join(uploadDir, e.name), cutoff);
        }
      }
    } catch {
      // Verzeichnis existiert noch nicht – kein Fehler
    }
  };

  // Beim Start einmal ausführen, dann periodisch
  void cleanup();
  setInterval(() => void cleanup(), intervalMs);
}

async function cleanDir(dir: string, cutoffMs: number): Promise<void> {
  let entries: string[];
  try {
    entries = await fs.readdir(dir);
  } catch {
    return;
  }
  for (const name of entries) {
    const full = path.join(dir, name);
    try {
      const stat = await fs.stat(full);
      if (stat.isFile() && stat.mtimeMs < cutoffMs) {
        await fs.unlink(full);
      }
    } catch {
      // Datei bereits gelöscht oder nicht zugänglich
    }
  }
}
