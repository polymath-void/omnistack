import type { ScaffoldJobPayload } from '@omnistack/types';

export const SCAFFOLDER_CORE_VERSION = '1.0.0';

export function createScaffoldJobPlan(payload: ScaffoldJobPayload): { planId: string; status: string } {
  return {
    planId: `plan_${payload.id}`,
    status: 'PLANNED',
  };
}

// ---------------------------------------------------------------------------
// Virtual File System
// ---------------------------------------------------------------------------
export {
  VirtualFileSystem,
  createVirtualFileSystem,
  normalizeVirtualPath,
  type VfsStat,
  type VfsEntry,
} from './virtual-fs.js';

// ---------------------------------------------------------------------------
// Template Engine
// ---------------------------------------------------------------------------
export {
  TemplateEngine,
  renderTemplate,
  toKebabCase,
  toCamelCase,
  toPascalCase,
  toSnakeCase,
  toUpper,
  toLower,
  toJSON,
  type TemplateHelperFn,
  type TemplateEngineOptions,
  type RenderOptions,
  type VfsProcessOptions,
} from './template-engine.js';

// ---------------------------------------------------------------------------
// Emitter & Archive Streaming
// ---------------------------------------------------------------------------
export {
  commitToDisk,
  createZipArchive,
  createTarArchive,
  streamArchiveToFile,
  type CommitToDiskOptions,
  type CommitResult,
  type BaseArchiveOptions,
  type ZipArchiveOptions,
  type TarArchiveOptions,
  type StreamArchiveOptions,
  type ArchiveFileResult,
} from './emitter.js';

// ---------------------------------------------------------------------------
// Sandbox Verification & Compiler Diagnostics
// ---------------------------------------------------------------------------
export {
  runCompilerDiagnostics,
  verifyVirtualFileSystem,
  parseTypeScriptDiagnostics,
  extractSnippet,
  stripAnsi,
  groupDiagnosticsByFile,
  resolveDiagnosticSnippet,
  isolateToQuarantine,
  assertVerificationGate,
  SandboxGateViolationError,
  SandboxVerificationEngine,
  DEFAULT_SANDBOX_CONFIG,
  type RunCompilerDiagnosticsOptions,
  type VerifyVirtualFileSystemOptions,
  type SandboxConfig,
  type QuarantineRecord,
} from './sandbox.js';

// ---------------------------------------------------------------------------
// Closed-Loop Self-Healing Pipeline Orchestrator
// ---------------------------------------------------------------------------
export {
  executeSelfHealingPipeline,
  type PipelineSpec,
  type PipelineResult,
  type PipelineAuditReport,
} from './pipeline.js';

