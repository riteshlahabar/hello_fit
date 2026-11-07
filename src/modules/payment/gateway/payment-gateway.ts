/**
 * The port every payment gateway implements. The spec requires a "pluggable
 * gateway interface so Stripe or PayU can be added", so nothing outside this
 * folder may mention Razorpay.
 */
export const PAYMENT_GATEWAY = Symbol('PAYMENT_GATEWAY');

export interface GatewayOrder {
  /** The gateway's order id, handed to the client SDK. */
  orderId: string;
  amount: number;
  currency: string;
  /** Public key the mobile/web SDK needs; never the secret. */
  publicKey?: string;
}

export interface GatewayPaymentDetails {
  paymentId: string;
  orderId: string;
  amount: number;
  status: 'CAPTURED' | 'AUTHORIZED' | 'FAILED';
  method?: string;
  raw: Record<string, unknown>;
}

export interface GatewayRefund {
  refundId: string;
  amount: number;
  status: 'PENDING' | 'PROCESSED' | 'FAILED';
}

export interface PaymentGateway {
  readonly name: string;

  createOrder(input: {
    amount: number;
    currency: string;
    /** Our booking code, so the gateway dashboard is reconcilable. */
    receipt: string;
    notes?: Record<string, string>;
  }): Promise<GatewayOrder>;

  /**
   * Confirms a client-reported payment really happened, by signature and by
   * asking the gateway. Never trust the client's word that it succeeded.
   */
  verifyPayment(input: {
    orderId: string;
    paymentId: string;
    signature: string;
  }): Promise<GatewayPaymentDetails>;

  /** Verifies an inbound webhook's signature against the raw body. */
  verifyWebhookSignature(rawBody: string, signature: string): boolean;

  refund(input: {
    paymentId: string;
    amount: number;
    notes?: Record<string, string>;
  }): Promise<GatewayRefund>;
}
