import type { Request, Response, NextFunction } from 'express';

export interface AppError extends Error {
  statusCode?: number;
  code?: string;
}

function getErrorMessage(err: unknown): string {
  if (err instanceof Error) return err.message;
  if (typeof err === 'string') return err;
  return 'An unexpected error occurred.';
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

/** Multer error codes → user-friendly message + HTTP status. */
function mapMulterError(code: string | undefined, defaultMessage: string): { statusCode: number; message: string } {
  switch (code) {
    case 'LIMIT_FILE_SIZE':
      return { statusCode: 413, message: 'File too large. Please check the maximum file size.' };
    case 'LIMIT_FILE_COUNT':
      return { statusCode: 400, message: 'Too many files in one request.' };
    case 'LIMIT_UNEXPECTED_FILE':
      return { statusCode: 400, message: 'Unexpected file field.' };
    default:
      return { statusCode: 400, message: defaultMessage };
  }
}

/**
 * Central error middleware: typed error responses, no stack traces in production.
 * Multer errors are mapped to descriptive messages with error codes.
 */
export function errorHandler(err: unknown, req: Request, res: Response, _next: NextFunction): void {
  let statusCode = getErrorStatus(err);
  let message = getErrorMessage(err) || 'An unexpected error occurred.';
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
    ...(code ? { code } : {}),
    ...(isProd ? {} : { stack: getErrorStack(err) }),
  });
}
