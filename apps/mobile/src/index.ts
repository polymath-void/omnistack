/**
 * @omnistack/mobile
 * PR Tinder mobile swipe mechanics and review card component skeletons
 */

import type { MobileReviewEvent } from '@omnistack/types';

export const MOBILE_APP_TITLE = 'OmniStack PR Tinder';

// Touch Gesture Physics Engine
export {
  SwipePhysicsEngine,
  DEFAULT_PHYSICS_CONFIG,
  type TouchPosition,
  type SwipePhysicsConfig,
  type SwipeGestureState,
} from './components/SwipePhysicsEngine.js';

// Mobile Diff Viewer Component
export {
  MobileDiffViewer,
  type MobileDiffViewerProps,
} from './components/DiffViewer.js';

// Audio Memo Recorder Component
export {
  AudioMemoRecorder,
  type AudioMemoRecorderProps,
  type RecorderState,
} from './components/AudioMemoRecorder.js';

// Main Review Card Component Skeleton
export {
  ReviewCard,
  type ReviewCardProps,
} from './components/ReviewCard.js';

// Ephemeral Terminal Pairing Receiver
export {
  MobilePairingClient,
  parsePairingUrl,
  type ParsedPairingPayload,
  type PairingConnectionStatus,
} from './pairing/terminal-pairing.js';

export function handleSwipeGesture(event: MobileReviewEvent): void {
  console.log(`Action ${event.action} by ${event.reviewer} on PR #${event.prNumber}`);
}
