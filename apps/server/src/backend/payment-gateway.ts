/**
 * @omnistack/server - Payment Gateway Integration Adapter
 * Stripe checkout sessions simulation, cryptographic webhook HMAC verification, and secure transactions.
 */

import * as crypto from 'node:crypto';

export interface PaymentIntent {
  id: string;
  amount: number;
  currency: string;
  status: 'requires_payment_method' | 'requires_confirmation' | 'processing' | 'succeeded' | 'canceled';
  clientSecret: string;
  customerEmail: string;
  metadata: Record<string, string>;
  createdAt: number;
}

export class PaymentGateway {
  private webhookSecret: string;

  constructor(webhookSecret: string = 'whsec_omnistack_forge_secure_test_key_999') {
    this.webhookSecret = webhookSecret;
  }

  /**
   * Creates a payment intent with simulated Stripe client secret
   */
  public async createPaymentIntent(params: {
    amount: number;
    currency?: string | undefined;
    customerEmail: string;
    orderId: string;
    idempotencyKey?: string | undefined;
  }): Promise<PaymentIntent> {
    const id = `pi_${crypto.randomBytes(12).toString('hex')}`;
    const clientSecret = `${id}_secret_${crypto.randomBytes(16).toString('hex')}`;

    return {
      id,
      amount: Math.round(params.amount * 100), // in cents
      currency: params.currency || 'usd',
      status: 'succeeded',
      clientSecret,
      customerEmail: params.customerEmail,
      metadata: {
        orderId: params.orderId,
        idempotencyKey: params.idempotencyKey || '',
      },
      createdAt: Date.now(),
    };
  }

  /**
   * Verifies cryptographic Stripe HMAC-SHA256 webhook signatures
   * Format: t=1614555555,v1=5257a869e7ecebeda32affa62cd...
   */
  public verifyWebhookSignature(payload: string, signatureHeader: string): boolean {
    if (!signatureHeader) return false;

    try {
      const parts = signatureHeader.split(',');
      const timestampPart = parts.find((p) => p.startsWith('t='));
      const sigPart = parts.find((p) => p.startsWith('v1='));

      if (!timestampPart || !sigPart) return false;

      const timestamp = timestampPart.slice(2);
      const signature = sigPart.slice(3);

      // Protect against replay attacks (older than 5 minutes)
      const now = Math.floor(Date.now() / 1000);
      if (Math.abs(now - parseInt(timestamp, 10)) > 300) {
        return false;
      }

      const signedPayload = `${timestamp}.${payload}`;
      const expectedSig = crypto
        .createHmac('sha256', this.webhookSecret)
        .update(signedPayload)
        .digest('hex');

      return crypto.timingSafeEqual(Buffer.from(signature, 'hex'), Buffer.from(expectedSig, 'hex'));
    } catch {
      return false;
    }
  }

  /**
   * Helper to sign a test webhook payload for verification demos
   */
  public generateTestSignature(payload: string): string {
    const timestamp = Math.floor(Date.now() / 1000);
    const signedPayload = `${timestamp}.${payload}`;
    const sig = crypto
      .createHmac('sha256', this.webhookSecret)
      .update(signedPayload)
      .digest('hex');
    return `t=${timestamp},v1=${sig}`;
  }
}

export const globalPaymentGateway = new PaymentGateway();
