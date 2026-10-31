import {
  ArgumentsHost,
  Catch,
  ExceptionFilter,
  HttpException,
  HttpStatus,
  Logger,
} from '@nestjs/common';
import type { Request, Response } from 'express';
import { ErrorCode, type ErrorCodeValue } from '../errors/error-codes';

interface ErrorBody {
  success: false;
  error: {
    code: ErrorCodeValue | string;
    message: string;
    /** Field-level problems, present only for validation failures. */
    details?: unknown;
  };
  meta: {
    requestId: string | null;
    path: string;
    timestamp: string;
  };
}

/** Nest's ValidationPipe throws with this response shape. */
interface ValidationExceptionResponse {
  message: string[];
  error?: string;
  statusCode: number;
}

function isValidationResponse(
  value: unknown,
): value is ValidationExceptionResponse {
  return (
    typeof value === 'object' &&
    value !== null &&
    Array.isArray((value as { message?: unknown }).message)
  );
}

const STATUS_TO_CODE: Partial<Record<HttpStatus, ErrorCodeValue>> = {
  [HttpStatus.BAD_REQUEST]: ErrorCode.VALIDATION_FAILED,
  [HttpStatus.UNAUTHORIZED]: ErrorCode.UNAUTHENTICATED,
  [HttpStatus.FORBIDDEN]: ErrorCode.FORBIDDEN,
  [HttpStatus.NOT_FOUND]: ErrorCode.NOT_FOUND,
  [HttpStatus.CONFLICT]: ErrorCode.DUPLICATE_RESOURCE,
  [HttpStatus.TOO_MANY_REQUESTS]: ErrorCode.RATE_LIMITED,
};

/**
 * Single exit point for every error leaving the API. Guarantees the clients see
 * one shape with a stable `error.code` they can localise, and makes sure
 * unexpected exceptions are logged with their stack but never leak internals to
 * the caller.
 */
@Catch()
export class AllExceptionsFilter implements ExceptionFilter {
  private readonly logger = new Logger(AllExceptionsFilter.name);

  catch(exception: unknown, host: ArgumentsHost): void {
    const ctx = host.switchToHttp();
    const response = ctx.getResponse<Response>();
    const request = ctx.getRequest<Request>();

    const { status, code, message, details } = this.describe(exception);

    if (status >= HttpStatus.INTERNAL_SERVER_ERROR) {
      this.logger.error(
        `${request.method} ${request.url} -> ${status} ${code}`,
        exception instanceof Error ? exception.stack : String(exception),
      );
    } else {
      this.logger.warn(`${request.method} ${request.url} -> ${status} ${code}`);
    }

    const body: ErrorBody = {
      success: false,
      error: { code, message, ...(details === undefined ? {} : { details }) },
      meta: {
        requestId: (request.headers['x-request-id'] as string) ?? null,
        // originalUrl keeps the global /api prefix; req.url has it stripped.
        path: request.originalUrl || request.url,
        timestamp: new Date().toISOString(),
      },
    };

    response.status(status).json(body);
  }

  private describe(exception: unknown): {
    status: number;
    code: ErrorCodeValue | string;
    message: string;
    details?: unknown;
  } {
    if (exception instanceof HttpException) {
      const status = exception.getStatus();
      const payload = exception.getResponse();

      // Validation failures arrive as an array of messages.
      if (isValidationResponse(payload)) {
        return {
          status,
          code: ErrorCode.VALIDATION_FAILED,
          message: 'Request validation failed',
          details: payload.message,
        };
      }

      // A thrown object may carry its own code, e.g. throw new
      // BadRequestException({ code: ErrorCode.OTP_EXPIRED, message: '...' })
      if (typeof payload === 'object' && payload !== null) {
        const asRecord = payload as Record<string, unknown>;
        return {
          status,
          code:
            typeof asRecord.code === 'string'
              ? asRecord.code
              : (STATUS_TO_CODE[status as HttpStatus] ??
                ErrorCode.INTERNAL_ERROR),
          message:
            typeof asRecord.message === 'string'
              ? asRecord.message
              : exception.message,
          details: asRecord.details,
        };
      }

      return {
        status,
        code:
          STATUS_TO_CODE[status as HttpStatus] ?? ErrorCode.INTERNAL_ERROR,
        message: typeof payload === 'string' ? payload : exception.message,
      };
    }

    return {
      status: HttpStatus.INTERNAL_SERVER_ERROR,
      code: ErrorCode.INTERNAL_ERROR,
      message: 'Something went wrong. Please try again.',
    };
  }
}
