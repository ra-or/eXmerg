export interface FileLimitConfig {
  maxFileSizeBytes: number;
  maxFilesPerRequest: number;
  /** Maximale Gesamtgröße aller Dateien eines Merges (Bytes). */
  maxTotalSizeBytes: number;
}

export interface ServerConfig {
  port: number;
  uploadDir: string;
  fileLimits: FileLimitConfig;
  tempFileTtlSeconds: number;
}

export const DEFAULT_FILE_LIMITS: FileLimitConfig = {
  maxFileSizeBytes: 6 * 1024 * 1024,
  maxFilesPerRequest: 400,
  maxTotalSizeBytes: 100 * 1024 * 1024,
};
