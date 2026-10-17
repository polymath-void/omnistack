/**
 * @omnistack/server - Coupons & Discounts Promotions Engine
 * Features:
 * - Percentage & Fixed amount discounts
 * - Minimum order thresholds, expiration dates, and redemption caps
 * - Instant coupon validation and cart recalculation
 */

export interface Coupon {
  code: string;
  discountType: 'PERCENTAGE' | 'FIXED';
  discountValue: number; // e.g., 20 for 20% or 15 for $15
  minOrderAmount: number;
  maxRedemptions?: number | undefined;
  redeemedCount: number;
  expiresAt?: number | undefined;
  isActive: boolean;
  description: string;
}

export interface CouponValidationResult {
  valid: boolean;
  code: string;
  discountType?: 'PERCENTAGE' | 'FIXED' | undefined;
  discountValue?: number | undefined;
  discountAmount: number;
  finalTotal: number;
  message: string;
}

export class PromotionsEngine {
  private coupons = new Map<string, Coupon>();

  constructor() {
    this.seedDefaultCoupons();
  }

  private seedDefaultCoupons() {
    this.createCoupon({
      code: 'FORGE20',
      discountType: 'PERCENTAGE',
      discountValue: 20,
      minOrderAmount: 50,
      maxRedemptions: 500,
      isActive: true,
      description: '20% off all orders over $50 for early supporters',
    });

    this.createCoupon({
      code: 'LAUNCH15',
      discountType: 'FIXED',
      discountValue: 15,
      minOrderAmount: 40,
      isActive: true,
      description: '$15 off your first studio order',
    });

    this.createCoupon({
      code: 'VIP50',
      discountType: 'PERCENTAGE',
      discountValue: 50,
      minOrderAmount: 200,
      maxRedemptions: 50,
      isActive: true,
      description: 'Exclusive 50% VIP discount on purchases exceeding $200',
    });
  }

  public listCoupons(): Coupon[] {
    return Array.from(this.coupons.values());
  }

  public getCoupon(code: string): Coupon | undefined {
    return this.coupons.get(code.toUpperCase().trim());
  }

  public createCoupon(params: Omit<Coupon, 'redeemedCount'>): Coupon {
    const code = params.code.toUpperCase().trim();
    const coupon: Coupon = {
      ...params,
      code,
      redeemedCount: 0,
    };
    this.coupons.set(code, coupon);
    return coupon;
  }

  public updateCoupon(code: string, updates: Partial<Omit<Coupon, 'code' | 'redeemedCount'>>): Coupon | undefined {
    const existing = this.getCoupon(code);
    if (!existing) return undefined;

    const updated = {
      ...existing,
      ...updates,
    };
    this.coupons.set(existing.code, updated);
    return updated;
  }

  public deleteCoupon(code: string): boolean {
    return this.coupons.delete(code.toUpperCase().trim());
  }

  public validateCoupon(rawCode: string, orderSubtotal: number): CouponValidationResult {
    const code = rawCode.toUpperCase().trim();
    const coupon = this.coupons.get(code);

    if (!coupon || !coupon.isActive) {
      return {
        valid: false,
        code,
        discountAmount: 0,
        finalTotal: orderSubtotal,
        message: `Promo code "${code}" is invalid or inactive.`,
      };
    }

    if (coupon.expiresAt && Date.now() > coupon.expiresAt) {
      return {
        valid: false,
        code,
        discountAmount: 0,
        finalTotal: orderSubtotal,
        message: `Promo code "${code}" has expired.`,
      };
    }

    if (coupon.maxRedemptions && coupon.redeemedCount >= coupon.maxRedemptions) {
      return {
        valid: false,
        code,
        discountAmount: 0,
        finalTotal: orderSubtotal,
        message: `Promo code "${code}" has reached its maximum redemptions limit.`,
      };
    }

    if (orderSubtotal < coupon.minOrderAmount) {
      return {
        valid: false,
        code,
        discountAmount: 0,
        finalTotal: orderSubtotal,
        message: `Promo code "${code}" requires a minimum order of $${coupon.minOrderAmount}.`,
      };
    }

    let discountAmount = 0;
    if (coupon.discountType === 'PERCENTAGE') {
      discountAmount = Math.round((orderSubtotal * (coupon.discountValue / 100)) * 100) / 100;
    } else {
      discountAmount = Math.min(orderSubtotal, coupon.discountValue);
    }

    const finalTotal = Math.max(0, Math.round((orderSubtotal - discountAmount) * 100) / 100);

    return {
      valid: true,
      code,
      discountType: coupon.discountType,
      discountValue: coupon.discountValue,
      discountAmount,
      finalTotal,
      message: `Coupon "${code}" applied: -$${discountAmount.toFixed(2)} (${coupon.description})`,
    };
  }

  public recordRedemption(code: string): void {
    const coupon = this.getCoupon(code);
    if (coupon) {
      coupon.redeemedCount++;
    }
  }
}

export const globalPromotionsEngine = new PromotionsEngine();
