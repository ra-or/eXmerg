import path from 'path';
import { fileURLToPath } from 'url';
import type { ServerConfig } from 'shared';
import { DEFAULT_FILE_LIMITS as SHARED_DEFAULTS } from 'shared';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

function getEnvNumber(key: string, fallback: number): number {
  const v = process.env[key];
  if (v === undefined) return fallback;
  const n = parseInt(v, 10);
  return Number.isNaN(n) ? fallback : n;
}

export function loadConfig(): ServerConfig {
  const port = getEnvNumber('PORT', 3003);
  const rawUploadDir = process.env.UPLOAD_DIR ?? path.join(path.dirname(__dirname), '..', '..', 'uploads');
  const uploadDir = path.resolve(path.normalize(rawUploadDir));
  console.log('[config] uploadDir (resolved):', uploadDir);
  const maxFileSizeBytes = getEnvNumber('MAX_FILE_SIZE_BYTES', SHARED_DEFAULTS.maxFileSizeBytes);
  const maxFilesPerRequest = getEnvNumber('MAX_FILES_PER_REQUEST', SHARED_DEFAULTS.maxFilesPerRequest);
  const maxTotalSizeBytes = getEnvNumber('MAX_TOTAL_SIZE_BYTES', SHARED_DEFAULTS.maxTotalSizeBytes);
  const tempFileTtlSeconds = getEnvNumber('TEMP_FILE_TTL_SECONDS', 3600);

  return {
    port,
    uploadDir,
    fileLimits: {
      maxFileSizeBytes,
      maxFilesPerRequest,
      maxTotalSizeBytes,
    },
    tempFileTtlSeconds,
  };
}

export const config = loadConfig();
