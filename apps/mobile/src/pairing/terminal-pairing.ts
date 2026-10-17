/**
 * Mobile Pairing Client Receiver
 * Ingests ephemeral QR pairing deep links, establishes WebSocket session,
 * and synchronizes PR review cards and swipe gestures.
 */

import type { MobileReviewEvent } from '@omnistack/types';

export interface ParsedPairingPayload {
  sessionId: string;
  sessionToken: string;
  projectId: string;
  prNumber: number;
  wsUrl: string;
  expiresAt: string;
}

export interface PairingConnectionStatus {
  state: 'disconnected' | 'connecting' | 'connected' | 'error' | 'expired';
  errorMessage?: string;
  activePrNumber?: number;
}

/**
 * Parses an ingested QR code deep link or HTTP pairing URL into structured parameters.
 */
export function parsePairingUrl(url: string): ParsedPairingPayload | null {
  try {
    const parsed = new URL(url);
    const params = parsed.searchParams;

    const sessionId = params.get('session');
    const sessionToken = params.get('token');
    const projectId = params.get('project');
    const prStr = params.get('pr');
    const wsUrl = params.get('ws') || params.get('wsUrl');
    const expiresAt = params.get('exp') || params.get('expiresAt');

    if (!sessionId || !sessionToken || !projectId || !prStr || !wsUrl) {
      return null;
    }

    return {
      sessionId,
      sessionToken,
      projectId,
      prNumber: parseInt(prStr, 10),
      wsUrl,
      expiresAt: expiresAt ?? new Date(Date.now() + 900000).toISOString(),
    };
  } catch {
    return null;
  }
}

/**
 * Mobile Terminal Pairing Client
 * Handles WebSocket connection lifecycle to the OmniStack studio gateway.
 */
export class MobilePairingClient {
  private ws: WebSocket | null = null;
  private payload: ParsedPairingPayload | null = null;
  private statusListeners: Array<(status: PairingConnectionStatus) => void> = [];

  constructor(pairingUrl?: string) {
    if (pairingUrl) {
      this.payload = parsePairingUrl(pairingUrl);
    }
  }

  /**
   * Registers a connection status listener.
   */
  onStatusChange(listener: (status: PairingConnectionStatus) => void): () => void {
    this.statusListeners.push(listener);
    return () => {
      this.statusListeners = this.statusListeners.filter((l) => l !== listener);
    };
  }

  private notifyStatus(status: PairingConnectionStatus): void {
    for (const listener of this.statusListeners) {
      listener(status);
    }
  }

  /**
   * Connects to the host using the parsed pairing credentials.
   */
  connect(pairingPayload?: ParsedPairingPayload): void {
    if (pairingPayload) {
      this.payload = pairingPayload;
    }

    if (!this.payload) {
      this.notifyStatus({
        state: 'error',
        errorMessage: 'Invalid pairing payload or unparsed URL',
      });
      return;
    }

    // Verify expiry
    if (Date.now() > new Date(this.payload.expiresAt).getTime()) {
      this.notifyStatus({
        state: 'expired',
        errorMessage: 'Pairing session has expired. Scan a newly generated terminal QR code.',
      });
      return;
    }

    this.notifyStatus({ state: 'connecting' });

    try {
      if (typeof WebSocket === 'undefined') {
        // Mock connection in non-browser runtime
        this.notifyStatus({
          state: 'connected',
          activePrNumber: this.payload.prNumber,
        });
        return;
      }

      this.ws = new WebSocket(
        `${this.payload.wsUrl}?sessionId=${this.payload.sessionId}&token=${this.payload.sessionToken}`
      );

      const activePr = this.payload.prNumber;
      this.ws.onopen = () => {
        this.notifyStatus({
          state: 'connected',
          activePrNumber: activePr,
        });
      };

      this.ws.onerror = (err) => {
        this.notifyStatus({
          state: 'error',
          errorMessage: `WebSocket error: ${String(err)}`,
        });
      };

      this.ws.onclose = () => {
        this.notifyStatus({ state: 'disconnected' });
      };
    } catch (err) {
      this.notifyStatus({
        state: 'error',
        errorMessage: `Failed to initiate connection: ${String(err)}`,
      });
    }
  }

  /**
   * Transmits a swipe gesture event to the server.
   */
  sendReviewEvent(event: MobileReviewEvent): boolean {
    if (this.ws && this.ws.readyState === WebSocket.OPEN) {
      this.ws.send(
        JSON.stringify({
          type: 'mobile:swipe_event',
          sessionId: this.payload?.sessionId,
          token: this.payload?.sessionToken,
          payload: event,
        })
      );
      return true;
    }
    return false;
  }

  /**
   * Closes active connection.
   */
  disconnect(): void {
    if (this.ws) {
      this.ws.close();
      this.ws = null;
    }
    this.notifyStatus({ state: 'disconnected' });
  }
}
