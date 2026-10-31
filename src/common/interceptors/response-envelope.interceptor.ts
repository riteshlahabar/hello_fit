import {
  CallHandler,
  ExecutionContext,
  Injectable,
  NestInterceptor,
} from '@nestjs/common';
import { Observable, map } from 'rxjs';

/** Pagination / cursor info a service may attach alongside its payload. */
export interface ResponseMeta {
  [key: string]: unknown;
}

export interface ApiEnvelope<T> {
  success: true;
  data: T;
  meta: ResponseMeta | null;
  message: string | null;
}

/**
 * Services may return `{ data, meta, message }` to populate the envelope, or a
 * bare value which is placed in `data` as-is.
 */
interface EnvelopeParts {
  data: unknown;
  meta?: ResponseMeta;
  message?: string;
}

function hasEnvelopeParts(value: unknown): value is EnvelopeParts {
  return (
    typeof value === 'object' &&
    value !== null &&
    'data' in value &&
    ('meta' in value || 'message' in value)
  );
}

/**
 * Wraps every successful response in { success, data, meta, message } so the
 * Flutter app and admin panel parse one shape everywhere. Error responses are
 * shaped by AllExceptionsFilter instead.
 */
@Injectable()
export class ResponseEnvelopeInterceptor<T>
  implements NestInterceptor<T, ApiEnvelope<unknown>>
{
  intercept(
    _context: ExecutionContext,
    next: CallHandler<T>,
  ): Observable<ApiEnvelope<unknown>> {
    return next.handle().pipe(
      map((payload) => {
        if (hasEnvelopeParts(payload)) {
          return {
            success: true as const,
            data: payload.data,
            meta: payload.meta ?? null,
            message: payload.message ?? null,
          };
        }

        return {
          success: true as const,
          data: payload ?? null,
          meta: null,
          message: null,
        };
      }),
    );
  }
}
