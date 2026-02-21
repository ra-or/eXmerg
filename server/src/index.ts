import path from 'path';
import { fileURLToPath } from 'url';
import fs from 'fs';
import express from 'express';
import cors from 'cors';
import { config } from './config/index.js';
import { errorHandler } from './middleware/errorHandler.js';
import mergeRoutes from './routes/mergeRoutes.js';
import { startTempCleanup } from './processing/tempCleanup.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const clientDistPath = path.resolve(__dirname, '../../client/dist');

// ── Globale Fehler-Handler: Server bleibt auch bei Heap-OOM stabil ───────────
process.on('uncaughtException', (err) => {
  console.error('[uncaughtException]', err.message);
  // Nur bei echtem OOM neu starten (tsx watch erkennt den Exit-Code)
  if ((err as NodeJS.ErrnoException).code === 'ERR_WORKER_OUT_OF_MEMORY' ||
      err.message.includes('out of memory')) {
    console.error('Heap-Limit erreicht – Prozess wird sauber beendet.');
    process.exit(1);
  }
  // Andere Fehler loggen aber weiterlaufen lassen
});

process.on('unhandledRejection', (reason) => {
  console.error('[unhandledRejection]', reason);
  // Nicht abstürzen – asyncHandler fängt Route-Fehler bereits ab
});

const app = express();

app.use(cors({ origin: true }));
app.use(express.json({ limit: '1mb' }));
app.use('/api', mergeRoutes);

// Production: gebaute Client-App ausliefern (Docker / gesetzter client/dist)
if (fs.existsSync(clientDistPath)) {
  // Startseite explizit mit no-store ausliefern (vor static), damit nach Deploy sofort die neue App kommt
  app.get(['/', ''], (_req, res) => {
    res.setHeader('Cache-Control', 'no-store, no-cache, must-revalidate');
    res.sendFile(path.join(clientDistPath, 'index.html'));
  });
  app.use(express.static(clientDistPath));
  app.get('*', (_req, res) => {
    res.setHeader('Cache-Control', 'no-store, no-cache, must-revalidate');
    res.sendFile(path.join(clientDistPath, 'index.html'));
  });
}

app.use(errorHandler);

app.listen(config.port, () => {
  console.log('Server läuft auf Port', config.port);
  const usedMB = Math.round(process.memoryUsage().heapUsed / 1024 / 1024);
  console.log(`Heap-Limit: ${process.env.NODE_OPTIONS ?? 'Standard'} | Aktuell: ${usedMB} MB`);
  startTempCleanup(config.uploadDir, config.tempFileTtlSeconds);
});
