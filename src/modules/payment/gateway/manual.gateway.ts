import { Injectable, Logger } from '@nestjs/common';
import { createHmac, randomUUID, timingSafeEqual } from 'node:crypto';
import type {
  GatewayOrder,
  GatewayPaymentDetails,
  GatewayRefund,
  PaymentGateway,
} from './payment-gateway';

/**
 * Stand-in gateway used when no Razorpay credentials are configured, so the
 * booking-to-payment flow is testable on a developer machine and in CI.
 *
 * It still signs and verifies, using a fixed development secret — the shape of
 * the flow stays identical, so swapping in the real gateway changes no caller.
 * Selection happens in PaymentModule, which refuses to use this in production.
 */
const DEV_SECRET = 'hellofit-development-only';

@Injectable()
export class ManualGateway implements PaymentGateway {
  readonly name = 'MANUAL';

  private readonly logger = new Logger(ManualGateway.name);

  createOrder(input: {
    amount: number;
    currency: string;
    receipt: string;
  }): Promise<GatewayOrder> {
    const orderId = `order_dev_${randomUUID().replace(/-/g, '').slice(0, 14)}`;

    this.logger.warn(
      `Development gateway: created ${orderId} for ${input.receipt} (${input.amount} ${input.currency})`,
    );

    return Promise.resolve({
      orderId,
      amount: input.amount,
      currency: input.currency,
      publicKey: 'dev_key',
    });
  }

  /**
   * Accepts the signature this gateway itself would produce, so a test client
   * can complete the flow without a real provider.
   */
  verifyPayment(input: {
    orderId: string;
    paymentId: string;
    signature: string;
  }): Promise<GatewayPaymentDetails> {
    const expected = this.sign(`${input.orderId}|${input.paymentId}`);

    return Promise.resolve({
      paymentId: input.paymentId,
      orderId: input.orderId,
      amount: 0, // The caller uses the booking amount; dev mode cannot confirm it.
      status: safeEqual(expected, input.signature) ? 'CAPTURED' : 'FAILED',
      method: 'development',
      raw: { gateway: 'MANUAL', note: 'development only' },
    });
  }

  verifyWebhookSignature(rawBody: string, signature: string): boolean {
    return safeEqual(this.sign(rawBody), signature);
  }

  refund(input: { paymentId: string; amount: number }): Promise<GatewayRefund> {
    return Promise.resolve({
      refundId: `rfnd_dev_${randomUUID().replace(/-/g, '').slice(0, 14)}`,
      amount: input.amount,
      status: 'PROCESSED',
    });
  }

  /** Exposed so tests and the dev client can produce a valid signature. */
  sign(payload: string): string {
    return createHmac('sha256', DEV_SECRET).update(payload).digest('hex');
  }
}

function safeEqual(a: string, b: string): boolean {
  const left = Buffer.from(a);
  const right = Buffer.from(b);
  return left.length === right.length && timingSafeEqual(left, right);
}
