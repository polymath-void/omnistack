/**
 * @omnistack/vision-auditor
 * Multimodal Visual Critic, WCAG AA Mathematician & Self-Healing CSS Patcher for OmniStack Forge
 */

// Re-export core domain types
export type {
  ViewportKind,
  ViewportDimension,
  ViolationType,
  PatchStatus,
  ContrastRatioMetric,
  A11yViolationNode,
  A11yViolationDetail,
  VisionPatchDirective,
  UIAuditReport,
} from '@omnistack/types';

// Browser Pool & Viewports
export {
  BrowserPool,
  VIEWPORT_PROFILES,
  resolveBrowserExecutablePath,
  type BrowserPoolConfig,
} from './browser-pool.js';

// Contrast Math & OKLab Perceptual Solver
export {
  calculateRelativeLuminance,
  calculateContrastRatio,
  evaluateContrast,
  parseCssColor,
  compositeColors,
  rgbToOklab,
  calculateDeltaE,
  solveContrastViolation,
  TAILWIND_COLOR_TOKENS,
  type RGBColor,
  type OKLabColor,
  type TailwindColorToken,
  type ContrastResult,
  type RemediationSuggestion,
  type ContrastSolveOptions,
} from './contrast-solver.js';

// Vision & A11y Auditor
export {
  VisionAuditor,
  auditPageAccessibility,
  inspectElementStyles,
  type VisionAuditOptions,
  type ComputedElementStyleInfo,
} from './a11y-auditor.js';

export const VISION_AUDITOR_VERSION = '1.0.0';
