import type { Request, Response, NextFunction } from 'express';

export interface AppError extends Error {
  statusCode?: number;
  code?: string;
}

/** Multer-Fehler-Codes → deutsche Meldung + HTTP-Status (Windows/Linux-kompatibel). */
function mapMulterError(code: string | undefined, defaultMessage: string): { statusCode: number; message: string } {
  switch (code) {
    case 'LIMIT_FILE_SIZE':
      return { statusCode: 413, message: 'Datei ist zu groß. Bitte maximale Dateigröße beachten.' };
    case 'LIMIT_FILE_COUNT':
      return { statusCode: 400, message: 'Zu viele Dateien in einer Anfrage.' };
    case 'LIMIT_UNEXPECTED_FILE':
      return { statusCode: 400, message: 'Unerwartetes Dateifeld. Bitte Feldname "file" verwenden.' };
    default:
      return { statusCode: 400, message: defaultMessage };
  }
}

/**
 * Zentrale Error-Middleware: typisierte Fehlerantworten, keine Stack-Traces in Production.
 * Multer-Fehler werden in deutsche Meldungen übersetzt.
 */
export function errorHandler(
  err: AppError,
  req: Request,
  res: Response,
  _next: NextFunction
): void {
  let statusCode = err.statusCode ?? 500;
  let message = err.message || 'Ein unerwarteter Fehler ist aufgetreten.';

  if (err.code && (err.code.startsWith('LIMIT_') || err.code === 'MULTER_ERROR')) {
    const mapped = mapMulterError(err.code, message);
    statusCode = mapped.statusCode;
    message = mapped.message;
  }

  const isProd = process.env.NODE_ENV === 'production';

  console.error(`[${statusCode}] ${req.method} ${req.path} – ${message}`);

  res.status(statusCode).json({
    success: false,
    error: message,
    ...(isProd ? {} : { stack: err.stack, code: err.code }),
  });
}
