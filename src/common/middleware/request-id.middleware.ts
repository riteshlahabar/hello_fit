import { Injectable, Logger, NestMiddleware } from '@nestjs/common';
import { randomUUID } from 'node:crypto';
import type { NextFunction, Request, Response } from 'express';

export const REQUEST_ID_HEADER = 'x-request-id';

/**
 * Attaches a request id to every request (reusing an inbound one so the id
 * survives across Nginx, the API and the BullMQ workers) and logs one line per
 * completed request. This id is what support uses to trace a booking or a
 * failed payment end to end.
 */
@Injectable()
export class RequestIdMiddleware implements NestMiddleware {
  private readonly logger = new Logger('HTTP');

  use(req: Request, res: Response, next: NextFunction): void {
    const incoming = req.headers[REQUEST_ID_HEADER];
    const requestId =
      typeof incoming === 'string' && incoming.length > 0
        ? incoming
        : randomUUID();

    req.headers[REQUEST_ID_HEADER] = requestId;
    res.setHeader(REQUEST_ID_HEADER, requestId);

    const startedAt = process.hrtime.bigint();

    res.on('finish', () => {
      const ms = Number(process.hrtime.bigint() - startedAt) / 1_000_000;
      this.logger.log(
        `${req.method} ${req.originalUrl} ${res.statusCode} ${ms.toFixed(1)}ms [${requestId}]`,
      );
    });

    next();
  }
}
