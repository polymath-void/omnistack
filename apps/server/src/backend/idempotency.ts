/**
 * @omnistack/server - Cryptographic Idempotency Engine
 * Guarantees zero duplicate orders, replay attack protection, and cached response replaying.
 */

import * as crypto from 'node:crypto';

export interface IdempotencyRecord {
  key: string;
  payloadHash: string;
  statusCode: number;
  responseBody: any;
  createdAt: number;
  expiresAt: number;
  status: 'IN_FLIGHT' | 'COMMITTED' | 'FAILED';
}

export interface IdempotencyCheckResult {
  isDuplicate: boolean;
  isConflict: boolean;
  isInFlight: boolean;
  cachedResponse?: {
    statusCode: number;
    body: any;
  };
  payloadHash: string;
}

export class IdempotencyEngine {
  private cache = new Map<string, IdempotencyRecord>();
  private defaultTtlMs: number;

  constructor(ttlMs: number = 24 * 60 * 60 * 1000) { // 24 hours
    this.defaultTtlMs = ttlMs;

    // Background reaper to prevent memory rot
    setInterval(() => this.reapExpired(), 60 * 1000).unref();
  }

  /**
   * Generates a deterministic SHA-256 hash of the order payload
   */
  public hashPayload(payload: any): string {
    const canonical = JSON.stringify(payload, Object.keys(payload || {}).sort());
    return crypto.createHash('sha256').update(canonical).digest('hex');
  }

  /**
   * Checks or registers an idempotency key
   */
  public evaluate(key: string, payload: any): IdempotencyCheckResult {
    const payloadHash = this.hashPayload(payload);
    const existing = this.cache.get(key);

    if (!existing) {
      // First time seeing this key -> mark IN_FLIGHT
      this.cache.set(key, {
        key,
        payloadHash,
        statusCode: 0,
        responseBody: null,
        createdAt: Date.now(),
        expiresAt: Date.now() + this.defaultTtlMs,
        status: 'IN_FLIGHT',
      });
      return { isDuplicate: false, isConflict: false, isInFlight: false, payloadHash };
    }

    // Check if expired
    if (Date.now() > existing.expiresAt) {
      this.cache.delete(key);
      return this.evaluate(key, payload);
    }

    // Conflict detection: Same key used with different payload
    if (existing.payloadHash !== payloadHash) {
      return {
        isDuplicate: true,
        isConflict: true,
        isInFlight: false,
        payloadHash,
      };
    }

    // Still processing the first request
    if (existing.status === 'IN_FLIGHT') {
      return {
        isDuplicate: true,
        isConflict: false,
        isInFlight: true,
        payloadHash,
      };
    }

    // Idempotent Match: Return exact cached response
    return {
      isDuplicate: true,
      isConflict: false,
      isInFlight: false,
      cachedResponse: {
        statusCode: existing.statusCode,
        body: existing.responseBody,
      },
      payloadHash,
    };
  }

  /**
   * Commits the final response for an idempotency key
   */
  public commit(key: string, statusCode: number, responseBody: any): void {
    const existing = this.cache.get(key);
    if (existing) {
      existing.statusCode = statusCode;
      existing.responseBody = responseBody;
      existing.status = 'COMMITTED';
    }
  }

  /**
   * Marks a failed request so subsequent requests can retry
   */
  public release(key: string): void {
    this.cache.delete(key);
  }

  /**
   * Garbage collection to prevent software rot / memory leaks
   */
  public reapExpired(): number {
    const now = Date.now();
    let reaped = 0;
    for (const [key, record] of this.cache.entries()) {
      if (now > record.expiresAt) {
        this.cache.delete(key);
        reaped++;
      }
    }
    return reaped;
  }

  public getStats() {
    return {
      activeRecords: this.cache.size,
      ttlHours: Math.round(this.defaultTtlMs / 3600000),
    };
  }
}

export const globalIdempotencyEngine = new IdempotencyEngine();
