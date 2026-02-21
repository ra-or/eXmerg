import type { Request, Response, NextFunction } from 'express';

export interface AppError extends Error {
  statusCode?: number;
  code?: string;
}

function getErrorMessage(err: unknown): string {
  if (err instanceof Error) return err.message;
  if (typeof err === 'string') return err;
  return 'Ein unerwarteter Fehler ist aufgetreten.';
}

function getErrorStatus(err: unknown): number {
  if (err && typeof err === 'object') {
    const statusCode = (err as AppError).statusCode;
    if (typeof statusCode === 'number') return statusCode;
  }
  return 500;
}

function getErrorCode(err: unknown): string | undefined {
  if (err && typeof err === 'object' && typeof (err as AppError).code === 'string') {
    return (err as AppError).code;
  }
  return undefined;
}

function getErrorStack(err: unknown): string | undefined {
  if (err instanceof Error) return err.stack;
  return undefined;
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
 * err wird als unknown behandelt, damit next('string') / next(123) nicht crashen.
 */
export function errorHandler(
  err: unknown,
  req: Request,
  res: Response,
  _next: NextFunction
): void {
  let statusCode = getErrorStatus(err);
  let message = getErrorMessage(err) || 'Ein unerwarteter Fehler ist aufgetreten.';
  const code = getErrorCode(err);

  if (code && (code.startsWith('LIMIT_') || code === 'MULTER_ERROR')) {
    const mapped = mapMulterError(code, message);
    statusCode = mapped.statusCode;
    message = mapped.message;
  }

  const isProd = process.env.NODE_ENV === 'production';

  console.error(`[${statusCode}] ${req.method} ${req.path} – ${message}`);

  res.status(statusCode).json({
    success: false,
    error: message,
    ...(isProd ? {} : { stack: getErrorStack(err), code }),
  });
}
