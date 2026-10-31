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

/**
 * A controller opts into the envelope by returning an object whose keys are a
 * subset of { data, meta, message }. Requiring the whole shape to match —
 * rather than just the presence of `data` — means an entity that happens to
 * carry its own `data` field is still returned untouched.
 */
const ENVELOPE_KEYS = new Set(['data', 'meta', 'message']);

function hasEnvelopeParts(value: unknown): value is EnvelopeParts {
  if (typeof value !== 'object' || value === null || Array.isArray(value)) {
    return false;
  }

  const keys = Object.keys(value);
  return (
    keys.includes('data') && keys.every((key) => ENVELOPE_KEYS.has(key))
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
