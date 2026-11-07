import { Injectable, Logger, ServiceUnavailableException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { createHmac, timingSafeEqual } from 'node:crypto';
import { ErrorCode } from '../../../common/errors/error-codes';
import type { EnvVars } from '../../../config/env.validation';
import type {
  GatewayOrder,
  GatewayPaymentDetails,
  GatewayRefund,
  PaymentGateway,
} from './payment-gateway';

const API = 'https://api.razorpay.com/v1';

/**
 * Razorpay implementation. Uses the REST API over fetch rather than the SDK:
 * three endpoints and an HMAC are not worth another dependency, and it keeps
 * the signature verification visible.
 *
 * Razorpay works in the smallest currency unit, so every amount crossing this
 * boundary is converted to and from paise here — rupees never leave this file
 * as a float.
 */
@Injectable()
export class RazorpayGateway implements PaymentGateway {
  readonly name = 'RAZORPAY';

  private readonly logger = new Logger(RazorpayGateway.name);

  constructor(private readonly config: ConfigService<EnvVars, true>) {}

  async createOrder(input: {
    amount: number;
    currency: string;
    receipt: string;
    notes?: Record<string, string>;
  }): Promise<GatewayOrder> {
    const body = await this.request('POST', '/orders', {
      amount: toPaise(input.amount),
      currency: input.currency,
      receipt: input.receipt,
      notes: input.notes,
      // Capture automatically: a separate capture step adds a failure mode
      // with no benefit for a single-shot session payment.
      payment_capture: 1,
    });

    return {
      orderId: body.id as string,
      amount: fromPaise(body.amount as number),
      currency: body.currency as string,
      publicKey: this.keyId(),
    };
  }

  /**
   * Two checks, both required: the signature proves the response came from
   * Razorpay, and the fetch proves the payment is actually captured — a
   * signature alone can be replayed from a failed attempt.
   */
  async verifyPayment(input: {
    orderId: string;
    paymentId: string;
    signature: string;
  }): Promise<GatewayPaymentDetails> {
    const expected = createHmac('sha256', this.keySecret())
      .update(`${input.orderId}|${input.paymentId}`)
      .digest('hex');

    if (!safeEqual(expected, input.signature)) {
      throw new ServiceUnavailableException({
        code: ErrorCode.VALIDATION_FAILED,
        message: 'Payment signature verification failed',
      });
    }

    const payment = await this.request(
      'GET',
      `/payments/${input.paymentId}`,
      undefined,
    );

    if (payment.order_id !== input.orderId) {
      throw new ServiceUnavailableException({
        code: ErrorCode.VALIDATION_FAILED,
        message: 'Payment does not belong to this order',
      });
    }

    return {
      paymentId: payment.id as string,
      orderId: payment.order_id as string,
      amount: fromPaise(payment.amount as number),
      status: mapStatus(payment.status as string),
      method: payment.method as string | undefined,
      raw: payment,
    };
  }

  verifyWebhookSignature(rawBody: string, signature: string): boolean {
    const secret = this.config.get('RAZORPAY_WEBHOOK_SECRET', { infer: true });

    if (!secret) {
      this.logger.error(
        'RAZORPAY_WEBHOOK_SECRET is not set — refusing to trust the webhook',
      );
      return false;
    }

    const expected = createHmac('sha256', secret)
      .update(rawBody)
      .digest('hex');

    return safeEqual(expected, signature);
  }

  async refund(input: {
    paymentId: string;
    amount: number;
    notes?: Record<string, string>;
  }): Promise<GatewayRefund> {
    const body = await this.request(
      'POST',
      `/payments/${input.paymentId}/refund`,
      { amount: toPaise(input.amount), notes: input.notes },
    );

    return {
      refundId: body.id as string,
      amount: fromPaise(body.amount as number),
      status:
        body.status === 'processed'
          ? 'PROCESSED'
          : body.status === 'failed'
            ? 'FAILED'
            : 'PENDING',
    };
  }

  // -------------------------------------------------------------------------

  private async request(
    method: 'GET' | 'POST',
    path: string,
    body?: unknown,
  ): Promise<Record<string, unknown>> {
    const auth = Buffer.from(`${this.keyId()}:${this.keySecret()}`).toString(
      'base64',
    );

    const response = await fetch(`${API}${path}`, {
      method,
      headers: {
        Authorization: `Basic ${auth}`,
        'Content-Type': 'application/json',
      },
      ...(body ? { body: JSON.stringify(body) } : {}),
    });

    const json = (await response.json()) as Record<string, unknown>;

    if (!response.ok) {
      const error = (json.error ?? {}) as Record<string, unknown>;
      this.logger.error(
        `Razorpay ${method} ${path} failed: ${response.status} ${JSON.stringify(error)}`,
      );

      throw new ServiceUnavailableException({
        code: ErrorCode.INTERNAL_ERROR,
        message:
          (error.description as string) ??
          'The payment provider is unavailable. Please try again.',
      });
    }

    return json;
  }

  private keyId(): string {
    const value = this.config.get('RAZORPAY_KEY_ID', { infer: true });
    if (!value) throw this.notConfigured();
    return value;
  }

  private keySecret(): string {
    const value = this.config.get('RAZORPAY_KEY_SECRET', { infer: true });
    if (!value) throw this.notConfigured();
    return value;
  }

  private notConfigured() {
    return new ServiceUnavailableException({
      code: ErrorCode.INTERNAL_ERROR,
      message: 'Online payments are not configured on this environment',
    });
  }
}

const toPaise = (rupees: number): number => Math.round(rupees * 100);
const fromPaise = (paise: number): number => Math.round(paise) / 100;

const mapStatus = (status: string): GatewayPaymentDetails['status'] => {
  switch (status) {
    case 'captured':
      return 'CAPTURED';
    case 'authorized':
      return 'AUTHORIZED';
    default:
      return 'FAILED';
  }
};

/** Constant-time compare, so a signature cannot be guessed byte by byte. */
function safeEqual(a: string, b: string): boolean {
  const left = Buffer.from(a);
  const right = Buffer.from(b);
  return left.length === right.length && timingSafeEqual(left, right);
}
