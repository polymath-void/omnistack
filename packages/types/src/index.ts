/**
 * @omnistack/types
 * Core domain contracts and event envelopes for OmniStack Forge
 */

// ---------------------------------------------------------------------------
// 1. Scaffolding Contracts
// ---------------------------------------------------------------------------

export type StackType = 'nextjs_fastapi' | 'prompt_to_store' | 'custom';
export type ProjectStatus = 'pending' | 'scaffolding' | 'auditing' | 'ready' | 'failed';
export type DeployTarget = 'vercel' | 'docker' | 'cloudflare';

export interface ScaffoldFeatures {
  authentication: boolean;
  stripeCommerce: boolean;
  livingDocs: boolean;
  visionAuditor: boolean;
  mobileReview: boolean;
}

export interface ScaffoldJobPayload {
  id: string;
  projectId: string;
  projectName: string;
  slug: string;
  prompt: string;
  stackType: StackType;
  templateId?: string;
  localPath: string;
  deployTarget?: DeployTarget;
  features: Partial<ScaffoldFeatures>;
  customFlags?: Record<string, unknown>;
  createdAt: string; // ISO 8601 string
}

// ---------------------------------------------------------------------------
// 2. Compilation & Sandbox Verification Contracts
// ---------------------------------------------------------------------------

export type DiagnosticSeverity = 'error' | 'warning' | 'info';

export interface CompilationDiagnosticPayload {
  file: string;
  line: number;
  column: number;
  code: string; // e.g. "TS2339", "TS2304"
  message: string;
  severity: DiagnosticSeverity;
  snippet?: string;
  rawTrace?: string;
}

export interface CompilationResult {
  jobId: string;
  success: boolean;
  exitCode: number;
  stdout: string;
  stderr: string;
  diagnostics: CompilationDiagnosticPayload[];
  healingAttemptCount: number;
  verifiedAt: string;
}

// ---------------------------------------------------------------------------
// 3. Vision & A11y Auditor Contracts
// ---------------------------------------------------------------------------

export type ViewportKind = 'mobile' | 'tablet' | 'desktop';
export type ViolationType = 'contrast' | 'overflow' | 'a11y' | 'alignment';
export type PatchStatus = 'PENDING' | 'APPLIED' | 'FAILED' | 'REVERTED';

export interface ViewportDimension {
  viewport: ViewportKind;
  width: number;
  height: number;
  deviceScaleFactor: number;
}

export interface ContrastRatioMetric {
  before: number;
  after: number;
  targetMinimum: number; // e.g. 4.5 for WCAG 2.1 AA Normal Text
}

export interface A11yViolationNode {
  target: string[];
  html: string;
  failureSummary?: string;
}

export interface A11yViolationDetail {
  id: string;
  impact: 'minor' | 'moderate' | 'serious' | 'critical';
  description: string;
  help: string;
  helpUrl: string;
  nodes: A11yViolationNode[];
}

export interface VisionPatchDirective {
  id: string;
  projectId: string;
  targetFile: string;
  componentName?: string;
  selector: string;
  viewport: ViewportKind;
  violationType: ViolationType;
  originalClasses: string[];
  replacementClasses: string[];
  calculatedContrastRatio?: ContrastRatioMetric;
  deltaE?: number; // OKLab color distance
  wcagCriteria?: string;
  status: PatchStatus;
}

export interface UIAuditReport {
  id: string;
  projectId: string;
  viewport: ViewportKind;
  screenshotPath: string;
  contrastScore: number; // 0 - 100
  responsiveScore: number; // 0 - 100
  a11yViolationsCount: number;
  violations: A11yViolationDetail[];
  patchesApplied: VisionPatchDirective[];
  createdAt: string;
}

// ---------------------------------------------------------------------------
// 4. Mobile PR Tinder & Review Contracts
// ---------------------------------------------------------------------------

export type MobileSwipeAction =
  | 'SWIPE_RIGHT_APPROVE'
  | 'SWIPE_LEFT_REJECT'
  | 'SWIPE_UP_SWARM_HEAL';

export type PRVerdict = 'APPROVED' | 'CHANGES_REQUESTED' | 'DISMISSED';

export interface DiffChunk {
  oldStart: number;
  oldLines: number;
  newStart: number;
  newLines: number;
  lines: string[];
}

export interface FileDiffSummary {
  path: string;
  additions: number;
  deletions: number;
  chunks: DiffChunk[];
}

export interface MobileReviewEvent {
  id: string;
  projectId: string;
  prNumber: number;
  action: MobileSwipeAction;
  commitOid: string;
  reviewer: string;
  feedbackMemo?: string;
  voiceMemoUrl?: string;
  timestamp: string;
  metadata?: {
    deviceModel?: string;
    gestureVelocity?: number;
    beforeScreenshotUrl?: string;
    afterScreenshotUrl?: string;
  };
}

export interface PRReviewRecord {
  id: string;
  projectId: string;
  prNumber: number;
  title: string;
  author: string;
  diffSummary: FileDiffSummary[];
  screenshotBefore?: string;
  screenshotAfter?: string;
  verdict?: PRVerdict;
  feedbackText?: string;
  reviewedAt?: string;
}

// ---------------------------------------------------------------------------
// 5. Autonomous Swarm & Blackboard Contracts
// ---------------------------------------------------------------------------

export type SwarmStep =
  | 'IDLE'
  | 'SPEC_ROUTING'
  | 'SCAFFOLDING'
  | 'AST_ANALYSIS'
  | 'SANDBOX_VERIFICATION'
  | 'VISUAL_AUDIT'
  | 'GIT_MOBILE_REVIEW'
  | 'COMPLETED'
  | 'QUARANTINE_FAILED';

export type LockStatus = 'UNLOCKED' | 'LOCKED';

export interface ASTLockInfo {
  filePath: string;
  agentId: string;
  lockStatus: LockStatus;
  acquiredAt: string;
  expiresAt: string;
  revision: number;
}

export interface SwarmTelemetryLog {
  timestamp: string;
  agent: string;
  level: 'info' | 'warn' | 'error' | 'debug';
  message: string;
  metadata?: Record<string, unknown>;
}

export interface SwarmState {
  workflowId: string;
  projectId?: string;
  jobId?: string;
  currentStep: SwarmStep;
  activeAgent: string;
  progressPercent: number;
  healingAttempts: number;
  maxHealingAttempts: number;
  activeLocks: ASTLockInfo[];
  lastError?: string;
  telemetryLogs: SwarmTelemetryLog[];
  updatedAt: string;
}

// ---------------------------------------------------------------------------
// 6. AST & Living DocGen Component Contracts
// ---------------------------------------------------------------------------

export interface ASTPropDefinition {
  name: string;
  type: string;
  required: boolean;
  defaultValue?: string;
  description?: string;
  enumOptions?: string[];
}

export interface ASTComponentMetadata {
  id: string;
  projectId: string;
  filePath: string;
  componentName: string;
  propsSchema: Record<string, ASTPropDefinition>;
  exports: string[];
  dependencies: string[];
  docstring?: string;
  previewRoute?: string;
}

// ---------------------------------------------------------------------------
// 7. WebSocket Event Envelopes
// ---------------------------------------------------------------------------

export type WebSocketEventType =
  | 'step:start'
  | 'step:stdout'
  | 'heal:attempt'
  | 'job:complete'
  | 'error';

export interface WebSocketEvent<T = unknown> {
  event: WebSocketEventType;
  jobId: string;
  payload: T;
  timestamp: string;
}
