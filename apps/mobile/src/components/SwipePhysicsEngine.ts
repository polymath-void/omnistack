/**
 * Mobile Swipe Physics Engine
 * Calculates touch gesture physics, spring animations, rotation, and swipe direction
 * (Swipe Right -> APPROVE, Swipe Left -> REQUEST_CHANGES, Swipe Up -> SWARM_HEAL).
 */

import type { MobileReviewEvent, MobileSwipeAction } from '@omnistack/types';

export interface TouchPosition {
  x: number;
  y: number;
  timestamp: number;
}

export interface SwipePhysicsConfig {
  screenWidth: number;
  minSwipeDistanceX: number;
  minSwipeDistanceY: number;
  velocityThreshold: number;
  maxRotationDegrees: number;
}

export const DEFAULT_PHYSICS_CONFIG: SwipePhysicsConfig = {
  screenWidth: 390,
  minSwipeDistanceX: 95,
  minSwipeDistanceY: 110,
  velocityThreshold: 0.35,
  maxRotationDegrees: 14,
};

export interface SwipeGestureState {
  isActive: boolean;
  startX: number;
  startY: number;
  currentX: number;
  currentY: number;
  deltaX: number;
  deltaY: number;
  velocity: number;
  rotationDegrees: number;
  activeDirection: MobileSwipeAction | null;
  approveOpacity: number;
  rejectOpacity: number;
  swarmHealOpacity: number;
}

export class SwipePhysicsEngine {
  private config: SwipePhysicsConfig;
  private startTouch: TouchPosition | null = null;

  constructor(config: Partial<SwipePhysicsConfig> = {}) {
    this.config = { ...DEFAULT_PHYSICS_CONFIG, ...config };
  }

  /**
   * Initializes a new touch tracking gesture.
   */
  startGesture(x: number, y: number, timestamp = Date.now()): SwipeGestureState {
    this.startTouch = { x, y, timestamp };
    return this.calculateState(x, y, timestamp);
  }

  /**
   * Updates state during pan/drag motion.
   */
  updateGesture(x: number, y: number, timestamp = Date.now()): SwipeGestureState {
    if (!this.startTouch) {
      return this.startGesture(x, y, timestamp);
    }
    return this.calculateState(x, y, timestamp);
  }

  /**
   * Evaluates final gesture release and determines swipe trigger.
   */
  endGesture(
    x: number,
    y: number,
    timestamp = Date.now()
  ): {
    triggered: boolean;
    action: MobileSwipeAction | null;
    state: SwipeGestureState;
  } {
    const state = this.calculateState(x, y, timestamp);
    const action = this.resolveAction(state);

    this.startTouch = null;

    return {
      triggered: action !== null,
      action,
      state: {
        ...state,
        isActive: false,
      },
    };
  }

  /**
   * Calculates real-time card rotation, opacity, and velocity.
   */
  private calculateState(x: number, y: number, timestamp: number): SwipeGestureState {
    if (!this.startTouch) {
      return {
        isActive: false,
        startX: x,
        startY: y,
        currentX: x,
        currentY: y,
        deltaX: 0,
        deltaY: 0,
        velocity: 0,
        rotationDegrees: 0,
        activeDirection: null,
        approveOpacity: 0,
        rejectOpacity: 0,
        swarmHealOpacity: 0,
      };
    }

    const deltaX = x - this.startTouch.x;
    const deltaY = y - this.startTouch.y;
    const dt = Math.max(1, timestamp - this.startTouch.timestamp);
    const distance = Math.hypot(deltaX, deltaY);
    const velocity = distance / dt;

    // Card rotation based on horizontal travel: [-maxRotation, +maxRotation]
    const clampedRatio = Math.max(-1, Math.min(1, deltaX / (this.config.screenWidth * 0.6)));
    const rotationDegrees = clampedRatio * this.config.maxRotationDegrees;

    // Stamp badge opacities
    const approveOpacity = Math.max(0, Math.min(1, deltaX / this.config.minSwipeDistanceX));
    const rejectOpacity = Math.max(0, Math.min(1, -deltaX / this.config.minSwipeDistanceX));
    const swarmHealOpacity = Math.max(0, Math.min(1, -deltaY / this.config.minSwipeDistanceY));

    let activeDirection: MobileSwipeAction | null = null;
    if (deltaY < -this.config.minSwipeDistanceY * 0.7 && Math.abs(deltaX) < Math.abs(deltaY) * 0.8) {
      activeDirection = 'SWIPE_UP_SWARM_HEAL';
    } else if (deltaX > this.config.minSwipeDistanceX * 0.7) {
      activeDirection = 'SWIPE_RIGHT_APPROVE';
    } else if (deltaX < -this.config.minSwipeDistanceX * 0.7) {
      activeDirection = 'SWIPE_LEFT_REJECT';
    }

    return {
      isActive: true,
      startX: this.startTouch.x,
      startY: this.startTouch.y,
      currentX: x,
      currentY: y,
      deltaX,
      deltaY,
      velocity,
      rotationDegrees,
      activeDirection,
      approveOpacity,
      rejectOpacity,
      swarmHealOpacity,
    };
  }

  /**
   * Resolves whether swipe velocity or translation crossed threshold.
   */
  private resolveAction(state: SwipeGestureState): MobileSwipeAction | null {
    // 1. Swipe Up (Swarm Heal): upward vertical motion dominant
    if (
      state.deltaY <= -this.config.minSwipeDistanceY ||
      (state.deltaY < -50 && state.velocity > this.config.velocityThreshold && state.deltaY < -Math.abs(state.deltaX))
    ) {
      return 'SWIPE_UP_SWARM_HEAL';
    }

    // 2. Swipe Right (Approve & Merge)
    if (
      state.deltaX >= this.config.minSwipeDistanceX ||
      (state.deltaX > 40 && state.velocity > this.config.velocityThreshold && state.deltaX > Math.abs(state.deltaY))
    ) {
      return 'SWIPE_RIGHT_APPROVE';
    }

    // 3. Swipe Left (Request Changes with Memo)
    if (
      state.deltaX <= -this.config.minSwipeDistanceX ||
      (state.deltaX < -40 && state.velocity > this.config.velocityThreshold && -state.deltaX > Math.abs(state.deltaY))
    ) {
      return 'SWIPE_LEFT_REJECT';
    }

    return null;
  }

  /**
   * Helper to build a MobileReviewEvent from a swipe gesture.
   */
  createReviewEvent(
    action: MobileSwipeAction,
    options: {
      projectId: string;
      prNumber: number;
      commitOid: string;
      reviewer: string;
      feedbackMemo?: string;
      voiceMemoUrl?: string;
      deviceModel?: string;
      gestureVelocity?: number;
      beforeScreenshotUrl?: string;
      afterScreenshotUrl?: string;
    }
  ): MobileReviewEvent {
    const eventId = `mre_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
    const meta: {
      deviceModel?: string;
      gestureVelocity?: number;
      beforeScreenshotUrl?: string;
      afterScreenshotUrl?: string;
    } = {};

    if (options.deviceModel !== undefined) meta.deviceModel = options.deviceModel;
    if (options.gestureVelocity !== undefined) meta.gestureVelocity = options.gestureVelocity;
    if (options.beforeScreenshotUrl !== undefined) meta.beforeScreenshotUrl = options.beforeScreenshotUrl;
    if (options.afterScreenshotUrl !== undefined) meta.afterScreenshotUrl = options.afterScreenshotUrl;

    const hasMeta = Object.keys(meta).length > 0;

    const event: MobileReviewEvent = {
      id: eventId,
      projectId: options.projectId,
      prNumber: options.prNumber,
      action,
      commitOid: options.commitOid,
      reviewer: options.reviewer,
      timestamp: new Date().toISOString(),
      ...(options.feedbackMemo !== undefined ? { feedbackMemo: options.feedbackMemo } : {}),
      ...(options.voiceMemoUrl !== undefined ? { voiceMemoUrl: options.voiceMemoUrl } : {}),
      ...(hasMeta ? { metadata: meta } : {}),
    };

    return event;
  }
}
