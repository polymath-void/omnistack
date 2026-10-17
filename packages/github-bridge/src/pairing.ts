/**
 * Ephemeral QR Pairing Generator
 * Generates pairing session tokens and terminal/SVG/DataURL QR codes
 * for instant terminal-to-mobile review sessions.
 */

import { createHmac, randomBytes, timingSafeEqual } from 'node:crypto';
import QRCode from 'qrcode';

export interface MobilePairingSession {
  sessionId: string;
  sessionToken: string;
  projectId: string;
  prNumber: number;
  wsUrl: string;
  pairingUrl: string;
  createdAt: string;
  expiresAt: string;
}

export interface CreatePairingSessionOptions {
  projectId: string;
  prNumber: number;
  wsUrl?: string;
  secret?: string;
  ttlSeconds?: number;
  customHost?: string;
}

export interface TerminalQRDisplayOptions {
  small?: boolean;
}

const DEFAULT_TTL_SECONDS = 900; // 15 minutes

/**
 * Creates an ephemeral pairing session with HMAC authentication token and deep link URL.
 */
export function createPairingSession(
  options: CreatePairingSessionOptions
): MobilePairingSession {
  const sessionId = `sess_${randomBytes(12).toString('hex')}`;
  const secret = options.secret ?? randomBytes(32).toString('hex');
  const wsUrl = options.wsUrl ?? 'ws://localhost:3000/api/v1/mobile-review';
  const ttlSeconds = options.ttlSeconds ?? DEFAULT_TTL_SECONDS;

  const now = new Date();
  const createdAt = now.toISOString();
  const expiresAt = new Date(now.getTime() + ttlSeconds * 1000).toISOString();

  // Create cryptographic HMAC token
  const hmac = createHmac('sha256', secret);
  hmac.update(`${sessionId}:${options.projectId}:${options.prNumber}:${expiresAt}`);
  const sessionToken = hmac.digest('hex');

  // Form custom scheme deep-link URL and optional HTTP fallback
  const host = options.customHost ?? '127.0.0.1:3000';
  const queryParams = new URLSearchParams({
    session: sessionId,
    token: sessionToken,
    project: options.projectId,
    pr: String(options.prNumber),
    ws: wsUrl,
    exp: expiresAt,
  });

  const pairingUrl = `omnistack://review?${queryParams.toString()}`;

  return {
    sessionId,
    sessionToken,
    projectId: options.projectId,
    prNumber: options.prNumber,
    wsUrl,
    pairingUrl: options.customHost
      ? `http://${host}/review/mobile?${queryParams.toString()}`
      : pairingUrl,
    createdAt,
    expiresAt,
  };
}

/**
 * Generates an ANSI QR code string formatted for direct display in CLI terminal.
 */
export async function generateTerminalQRCode(
  pairingUrl: string,
  options: TerminalQRDisplayOptions = {}
): Promise<string> {
  const isSmall = options.small ?? true;
  return QRCode.toString(pairingUrl, {
    type: 'terminal',
    small: isSmall,
  });
}

/**
 * Generates a base64 Data URL (PNG image) representation of the QR code.
 */
export async function generateQRCodeDataURL(pairingUrl: string): Promise<string> {
  return QRCode.toDataURL(pairingUrl, {
    errorCorrectionLevel: 'M',
    margin: 2,
    width: 320,
  });
}

/**
 * Generates an SVG string representation of the QR code for web embeds.
 */
export async function generateQRCodeSVG(pairingUrl: string): Promise<string> {
  return QRCode.toString(pairingUrl, {
    type: 'svg',
    margin: 2,
  });
}

/**
 * Verifies a mobile pairing session token against the shared secret.
 */
export function verifyPairingToken(
  sessionId: string,
  projectId: string,
  prNumber: number,
  expiresAt: string,
  providedToken: string,
  secret: string
): boolean {
  // Check expiration
  if (Date.now() > new Date(expiresAt).getTime()) {
    return false;
  }

  const hmac = createHmac('sha256', secret);
  hmac.update(`${sessionId}:${projectId}:${prNumber}:${expiresAt}`);
  const expectedToken = hmac.digest('hex');

  const providedBuffer = Buffer.from(providedToken, 'utf8');
  const expectedBuffer = Buffer.from(expectedToken, 'utf8');

  if (providedBuffer.length !== expectedBuffer.length) {
    return false;
  }

  return timingSafeEqual(providedBuffer, expectedBuffer);
}

/**
 * In-memory pairing session store for managing active terminal sessions.
 */
export class PairingSessionManager {
  private readonly sessions = new Map<string, MobilePairingSession & { secret: string }>();

  /**
   * Generates and registers a new ephemeral pairing session.
   */
  async createSession(options: CreatePairingSessionOptions): Promise<{
    session: MobilePairingSession;
    terminalQR: string;
  }> {
    const secret = options.secret ?? randomBytes(32).toString('hex');
    const session = createPairingSession({ ...options, secret });
    this.sessions.set(session.sessionId, { ...session, secret });

    const terminalQR = await generateTerminalQRCode(session.pairingUrl, { small: true });

    return { session, terminalQR };
  }

  /**
   * Validates and retrieves an active pairing session.
   */
  validateSession(sessionId: string, token: string): MobilePairingSession | null {
    const item = this.sessions.get(sessionId);
    if (!item) {
      return null;
    }

    const isValid = verifyPairingToken(
      item.sessionId,
      item.projectId,
      item.prNumber,
      item.expiresAt,
      token,
      item.secret
    );

    if (!isValid) {
      return null;
    }

    const { secret: _, ...session } = item;
    return session;
  }

  /**
   * Cleans up expired sessions.
   */
  purgeExpired(): number {
    const now = Date.now();
    let purged = 0;
    for (const [id, session] of this.sessions.entries()) {
      if (now > new Date(session.expiresAt).getTime()) {
        this.sessions.delete(id);
        purged++;
      }
    }
    return purged;
  }
}
