import path from 'path';
import { fileURLToPath } from 'url';
import type { ServerConfig, FileLimitConfig } from 'shared';
import { DEFAULT_FILE_LIMITS as SHARED_DEFAULTS } from 'shared';

const DEFAULT_FILE_LIMITS: FileLimitConfig = {
  maxFileSizeBytes: SHARED_DEFAULTS.maxFileSizeBytes,
  maxFilesPerRequest: SHARED_DEFAULTS.maxFilesPerRequest,
  maxTotalSizeBytes: SHARED_DEFAULTS.maxTotalSizeBytes,
};

const __dirname = path.dirname(fileURLToPath(import.meta.url));

function getEnvNumber(key: string, fallback: number): number {
  const v = process.env[key];
  if (v === undefined) return fallback;
  const n = parseInt(v, 10);
  return Number.isNaN(n) ? fallback : n;
}

export function loadConfig(): ServerConfig {
  const port = getEnvNumber('PORT', 3003);
  const rawUploadDir =
    process.env.UPLOAD_DIR ??
    path.join(path.dirname(__dirname), '..', '..', 'uploads');
  const uploadDir = path.resolve(path.normalize(rawUploadDir));
  console.log('[config] uploadDir (resolved):', uploadDir);
  const maxFileSizeBytes = getEnvNumber(
    'MAX_FILE_SIZE_BYTES',
    DEFAULT_FILE_LIMITS.maxFileSizeBytes
  );
  const maxFilesPerRequest = getEnvNumber(
    'MAX_FILES_PER_REQUEST',
    DEFAULT_FILE_LIMITS.maxFilesPerRequest
  );
  const maxTotalSizeBytes = getEnvNumber(
    'MAX_TOTAL_SIZE_BYTES',
    DEFAULT_FILE_LIMITS.maxTotalSizeBytes
  );
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
