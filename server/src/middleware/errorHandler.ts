import type { Request, Response, NextFunction } from 'express';

export interface AppError extends Error {
  statusCode?: number;
  code?: string;
}

/**
 * Zentrale Error-Middleware: typisierte Fehlerantworten, keine Stack-Traces in Production.
 */
export function errorHandler(
  err: AppError,
  req: Request,
  res: Response,
  _next: NextFunction
): void {
  const statusCode = err.statusCode ?? 500;
  const message =
    err.message || 'Ein unerwarteter Fehler ist aufgetreten.';
  const isProd = process.env.NODE_ENV === 'production';

  // Damit Fehler auf dem Server (journalctl) sichtbar sind
  console.error(`[${statusCode}] ${req.method} ${req.path} – ${message}`);

  res.status(statusCode).json({
    success: false,
    error: message,
    ...(isProd ? {} : { stack: err.stack, code: err.code }),
  });
}
