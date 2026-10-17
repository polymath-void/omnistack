/**
 * @omnistack/github-bridge
 * GitHub App authentication, line-wrapped 390px mobile diff chunker,
 * GraphQL review mutations for PR Tinder, and ephemeral QR pairing generator.
 */

// Domain contracts from @omnistack/types
export type {
  MobileReviewEvent,
  MobileSwipeAction,
  PRVerdict,
  DiffChunk,
  FileDiffSummary,
  PRReviewRecord,
} from '@omnistack/types';

// GitHub App Client & Webhook Verification
export {
  GitHubBridgeClient,
  getInstallationToken,
  createInstallationClient,
  createAppOctokitClient,
  verifyWebhookSignature,
  dispatchWebhookEvent,
  type GitHubAppConfig,
  type EphemeralInstallationToken,
  type PullRequestUser,
  type PullRequestBranch,
  type PullRequestPayload,
  type PullRequestWebhookPayload,
  type PullRequestReviewCommentWebhookPayload,
  type IssueCommentWebhookPayload,
  type WebhookHandlers,
  type PullRequestDetails,
} from './client.js';

// Line-wrapped 390px Mobile Diff Chunker & Snapshot Pairing
export {
  MOBILE_VIEWPORT_WIDTH_PX,
  DEFAULT_MAX_CHARS_PER_LINE,
  DEFAULT_LINES_PER_CARD,
  tokenizeDiffLine,
  wrapDiffLine,
  parseUnifiedDiff,
  chunkDiffForMobile,
  pairVisualSnapshots,
  toFileDiffSummary,
  type DiffLineType,
  type SyntaxTokenKind,
  type DiffLineToken,
  type MobileDiffLine,
  type MobileDiffCard,
  type VisualSnapshotPair,
  type ChunkerOptions,
} from './diff-chunker.js';

// GraphQL Review Mutations & Swipe Gesture Dispatcher
export {
  fetchPullRequestNodeId,
  executeAddPullRequestReview,
  formatMobileReviewBody,
  processMobileReviewEvent,
  type PullRequestReviewEventGraphQL,
  type AddPullRequestReviewInput,
  type GraphQLReviewResponse,
  type ReviewExecutionResult,
  type SwarmDelegationPayload,
  type SwarmDelegationHandler,
  type ReviewMutationOptions,
} from './review-mutations.js';

// Ephemeral QR Pairing Generator
export {
  createPairingSession,
  generateTerminalQRCode,
  generateQRCodeDataURL,
  generateQRCodeSVG,
  verifyPairingToken,
  PairingSessionManager,
  type MobilePairingSession,
  type CreatePairingSessionOptions,
  type TerminalQRDisplayOptions,
} from './pairing.js';

export const GITHUB_BRIDGE_VERSION = '1.0.0';
