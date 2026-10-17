/**
 * @omnistack/scaffolder-core - Sandbox Sentry Verification Engine
 * 
 * Strict deterministic sandbox compilation, Docker isolation governance,
 * TypeScript diagnostic error parsing (TS2304, TS2322, TS2339),
 * and non-bypassable verification gate enforcement.
 * 
 * References:
 * - Blueprint Sections 3.1, 4.3, 8.2
 * - Agent Architecture Section 4.4
 * - CPU Resource Governance Rule 3
 */

import { spawn } from 'node:child_process';
import * as fs from 'node:fs';
import * as path from 'node:path';
import * as os from 'node:os';
import type {
  CompilationDiagnosticPayload,
  CompilationResult,
  DiagnosticSeverity,
} from '@omnistack/types';
import { VirtualFileSystem } from './virtual-fs.js';

// ============================================================================
// 1. Diagnostics Parser (TS2304, TS2322, TS2339 & General Compiler Errors)
// ============================================================================

/** ANSI Escape Sequence Stripper */
const ANSI_REGEX = new RegExp(
  // eslint-disable-next-line no-control-regex
  '[\\u001B\\u009B][[\\]()#;?]*(?:(?:(?:[a-zA-Z\\d]*(?:;[-a-zA-Z\\d\\/#&.:=?%@_]*)*)?\\u0007)|(?:(?:\\d{1,4}(?:;\\d{0,4})*)?[\\dA-PR-TZcf-ntqry=><~]))',
  'g'
);

/** Strip ANSI color and formatting codes from terminal output */
export function stripAnsi(text: string): string {
  return text.replace(ANSI_REGEX, '');
}

/** Normalize file path to forward slashes without leading `./` or container prefix */
export function normalizeDiagnosticFilePath(filePath: string): string {
  let cleaned = filePath.replace(/\\/g, '/');
  cleaned = cleaned.replace(/^\/sandbox\//, '');
  cleaned = cleaned.replace(/^\.\//, '');
  return cleaned;
}

/**
 * Intercepts compiler stderr and stdout traces and parses raw compiler outputs
 * into structured CompilationDiagnosticPayload events (file, line, column, code, message).
 * 
 * Handles standard tsc patterns, parenthesis formats, and Next.js / Webpack traces.
 * Explicitly captures TS2304 (Cannot find name), TS2322 (Type mismatch),
 * TS2339 (Property does not exist), and all standard TS codes.
 */
export function parseTypeScriptDiagnostics(rawOutput: string): CompilationDiagnosticPayload[] {
  if (!rawOutput || rawOutput.trim().length === 0) {
    return [];
  }

  const clean = stripAnsi(rawOutput);
  const lines = clean.split(/\r?\n/);
  const diagnostics: CompilationDiagnosticPayload[] = [];
  const seenKeys = new Set<string>();

  // Pattern 1: Standard tsc output:
  // "src/components/Checkout.tsx:42:15 - error TS2339: Property 'clientSecret' does not exist on type 'PaymentIntent'."
  const standardPattern = /^([^\r\n:(]+(?:\.[a-zA-Z0-9]+)?):(\d+):(\d+)\s*-\s*(error|warning|info)\s+(TS\d+):\s*(.+)$/;

  // Pattern 2: Parenthesized format:
  // "src/components/Checkout.tsx(42,15): error TS2339: Property 'clientSecret' does not exist on type 'PaymentIntent'."
  const parenPattern = /^([^\r\n:(]+(?:\.[a-zA-Z0-9]+)?)\((\d+),(\d+)\):\s*(error|warning|info)\s+(TS\d+):\s*(.+)$/;

  // Pattern 3: Next.js / Turbopack header line:
  // "./src/components/Checkout.tsx:42:15"
  const nextHeaderPattern = /^(\.?\/?[^\r\n:]+\.[a-zA-Z0-9]+):(\d+):(\d+)$/;

  let currentDiag: {
    file: string;
    line: number;
    column: number;
    code: string;
    message: string;
    severity: DiagnosticSeverity;
    snippetLines: string[];
    rawTraceLines: string[];
  } | null = null;

  const flushCurrent = () => {
    if (!currentDiag) return;
    const key = `${currentDiag.file}:${currentDiag.line}:${currentDiag.column}:${currentDiag.code}`;
    if (!seenKeys.has(key)) {
      seenKeys.add(key);
      const snippet = currentDiag.snippetLines.length > 0
        ? currentDiag.snippetLines.join('\n')
        : undefined;
      const rawTrace = currentDiag.rawTraceLines.length > 0
        ? currentDiag.rawTraceLines.join('\n')
        : undefined;

      const payload: CompilationDiagnosticPayload = {
        file: currentDiag.file,
        line: currentDiag.line,
        column: currentDiag.column,
        code: currentDiag.code,
        message: currentDiag.message.trim(),
        severity: currentDiag.severity,
      };

      if (snippet !== undefined) {
        payload.snippet = snippet;
      }
      if (rawTrace !== undefined) {
        payload.rawTrace = rawTrace;
      }

      diagnostics.push(payload);
    }
    currentDiag = null;
  };

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    if (line === undefined) continue;
    const trimmed = line.trim();

    // Check Pattern 1: Standard tsc
    const matchStd = line.match(standardPattern);
    if (matchStd) {
      flushCurrent();
      const rawFile = matchStd[1] ?? 'unknown';
      const lineNum = parseInt(matchStd[2] ?? '1', 10);
      const colNum = parseInt(matchStd[3] ?? '1', 10);
      const sev = (matchStd[4]?.toLowerCase() ?? 'error') as DiagnosticSeverity;
      const code = matchStd[5] ?? 'TS_UNKNOWN';
      const message = matchStd[6] ?? '';

      currentDiag = {
        file: normalizeDiagnosticFilePath(rawFile),
        line: isNaN(lineNum) ? 1 : lineNum,
        column: isNaN(colNum) ? 1 : colNum,
        code,
        message,
        severity: sev,
        snippetLines: [],
        rawTraceLines: [line],
      };
      continue;
    }

    // Check Pattern 2: Parentheses
    const matchParen = line.match(parenPattern);
    if (matchParen) {
      flushCurrent();
      const rawFile = matchParen[1] ?? 'unknown';
      const lineNum = parseInt(matchParen[2] ?? '1', 10);
      const colNum = parseInt(matchParen[3] ?? '1', 10);
      const sev = (matchParen[4]?.toLowerCase() ?? 'error') as DiagnosticSeverity;
      const code = matchParen[5] ?? 'TS_UNKNOWN';
      const message = matchParen[6] ?? '';

      currentDiag = {
        file: normalizeDiagnosticFilePath(rawFile),
        line: isNaN(lineNum) ? 1 : lineNum,
        column: isNaN(colNum) ? 1 : colNum,
        code,
        message,
        severity: sev,
        snippetLines: [],
        rawTraceLines: [line],
      };
      continue;
    }

    // Check Pattern 3: Next.js format (Header line followed by Type error)
    const matchNextHeader = trimmed.match(nextHeaderPattern);
    if (matchNextHeader) {
      // Look ahead for "Type error:" or error details
      const nextLine = lines[i + 1]?.trim() ?? '';
      let code = 'TS_TYPE_ERROR';
      let message = nextLine;

      if (nextLine.startsWith('Type error:')) {
        message = nextLine.replace(/^Type error:\s*/, '');
        // Check if a TS error code is inside the message
        const codeMatch = message.match(/\b(TS\d{4,5})\b/);
        if (codeMatch && codeMatch[1]) {
          code = codeMatch[1];
        }
      }

      if (nextLine.startsWith('Type error:') || nextLine.includes('error TS')) {
        flushCurrent();
        const rawFile = matchNextHeader[1] ?? 'unknown';
        const lineNum = parseInt(matchNextHeader[2] ?? '1', 10);
        const colNum = parseInt(matchNextHeader[3] ?? '1', 10);

        currentDiag = {
          file: normalizeDiagnosticFilePath(rawFile),
          line: isNaN(lineNum) ? 1 : lineNum,
          column: isNaN(colNum) ? 1 : colNum,
          code,
          message,
          severity: 'error',
          snippetLines: [],
          rawTraceLines: [line, lines[i + 1] ?? ''],
        };
        i++; // advance past message line
        continue;
      }
    }

    // If we have an active diagnostic, capture subsequent snippet lines or continuation
    if (currentDiag) {
      // Check if line is a code snippet indicator
      // Format A (Next.js/Babel): "  42 |   foo.bar" or "     |   ^"
      // Format B (tsc standard):  "42     const secret = ..." or "         ~~~~~~~~~~~~"
      if (
        /^\s*\d+\s*\|/.test(line) ||
        /^\s*\d+\s{2,}/.test(line) ||
        /^\s*\|?\s*[\^~]+/.test(line) ||
        /^\s*[\^~]+/.test(line) ||
        /^\s{2,}[\^~]+/.test(line)
      ) {
        currentDiag.snippetLines.push(line);
        currentDiag.rawTraceLines.push(line);
        continue;
      }

      // Check if line is an indented continuation message
      if (/^\s{2,4}\S+/.test(line) && !line.includes(':') && currentDiag.snippetLines.length === 0) {
        currentDiag.message += ` ${trimmed}`;
        currentDiag.rawTraceLines.push(line);
        continue;
      }

      // Allow a single blank line between error header and snippet
      if (trimmed === '') {
        if (currentDiag.snippetLines.length > 0) {
          // If we already captured snippets, an empty line ends this block
          flushCurrent();
        }
        continue;
      }

      // Any other non-empty line that didn't match closes current diagnostic
      flushCurrent();
    }
  }

  flushCurrent();
  return diagnostics;
}

/**
 * Groups an array of diagnostics by normalized file path.
 */
export function groupDiagnosticsByFile(
  diagnostics: CompilationDiagnosticPayload[]
): Record<string, CompilationDiagnosticPayload[]> {
  const grouped: Record<string, CompilationDiagnosticPayload[]> = {};
  for (const diag of diagnostics) {
    const list = grouped[diag.file] ?? [];
    list.push(diag);
    grouped[diag.file] = list;
  }
  return grouped;
}

/**
 * Extracts a formatted code snippet from source text surrounding a given 1-indexed line.
 */
export function extractSnippet(
  lines: string[],
  targetLine: number,
  targetColumn = 1,
  contextLines = 2
): string {
  const startIdx = Math.max(0, targetLine - 1 - contextLines);
  const endIdx = Math.min(lines.length - 1, targetLine - 1 + contextLines);
  const result: string[] = [];

  for (let idx = startIdx; idx <= endIdx; idx++) {
    const currentLineNum = idx + 1;
    const content = lines[idx] ?? '';
    const prefix = currentLineNum === targetLine ? '> ' : '  ';
    const lineNumStr = String(currentLineNum).padStart(4, ' ');
    result.push(`${prefix}${lineNumStr} | ${content}`);

    if (currentLineNum === targetLine && targetColumn > 0) {
      const indent = ' '.repeat(Math.max(0, targetColumn - 1));
      result.push(`       | ${indent}^`);
    }
  }

  return result.join('\n');
}

/**
 * Resolves source file from VirtualFileSystem and builds an annotated diagnostic snippet.
 */
export function resolveDiagnosticSnippet(
  vfs: VirtualFileSystem,
  filePath: string,
  line: number,
  column = 1
): string | undefined {
  try {
    const content = vfs.read(filePath);
    if (!content) return undefined;
    const lines = content.split(/\r?\n/);
    return extractSnippet(lines, line, column);
  } catch {
    return undefined;
  }
}

// ============================================================================
// 2. Quarantine & Failure Isolation
// ============================================================================

export interface QuarantineRecord {
  jobId: string;
  quarantinePath: string;
  quarantinedAt: string;
  healingAttemptCount: number;
  diagnostics: CompilationDiagnosticPayload[];
  rawStderr: string;
  quarantinedFiles: string[];
}

/**
 * Isolate persistent compilation failures to the quarantine directory
 * after maximum healing attempts are exhausted.
 */
export async function isolateToQuarantine(
  projectDir: string,
  jobId: string,
  diagnostics: CompilationDiagnosticPayload[],
  rawStderr: string,
  healingAttemptCount = 3,
  quarantineBaseDir = 'quarantine'
): Promise<QuarantineRecord> {
  const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
  const quarantineDir = path.resolve(quarantineBaseDir, `${timestamp}_${jobId}`);
  fs.mkdirSync(quarantineDir, { recursive: true });

  const quarantinedFiles: string[] = [];

  // Copy affected failing files into quarantine directory
  for (const diag of diagnostics) {
    if (!diag.file) continue;
    const sourceFilePath = path.resolve(projectDir, diag.file);
    if (fs.existsSync(sourceFilePath)) {
      const destFilePath = path.resolve(quarantineDir, 'files', diag.file);
      fs.mkdirSync(path.dirname(destFilePath), { recursive: true });
      fs.copyFileSync(sourceFilePath, destFilePath);
      quarantinedFiles.push(diag.file);
    }
  }

  const record: QuarantineRecord = {
    jobId,
    quarantinePath: quarantineDir,
    quarantinedAt: new Date().toISOString(),
    healingAttemptCount,
    diagnostics,
    rawStderr,
    quarantinedFiles,
  };

  // Write quarantine manifest
  const manifestPath = path.join(quarantineDir, 'quarantine-manifest.json');
  fs.writeFileSync(manifestPath, JSON.stringify(record, null, 2), 'utf8');

  // Also write raw stderr trace log
  const logPath = path.join(quarantineDir, 'compiler-trace.log');
  fs.writeFileSync(logPath, rawStderr, 'utf8');

  return record;
}

// ============================================================================
// 3. Non-Bypassable Verification Gate
// ============================================================================

export class SandboxGateViolationError extends Error {
  public readonly diagnostics: CompilationDiagnosticPayload[];
  public readonly exitCode: number;
  public readonly rawStderr: string;
  public readonly healingAttempt: number;

  constructor(
    message: string,
    diagnostics: CompilationDiagnosticPayload[],
    exitCode: number,
    rawStderr: string,
    healingAttempt = 1
  ) {
    super(message);
    this.name = 'SandboxGateViolationError';
    this.diagnostics = diagnostics;
    this.exitCode = exitCode;
    this.rawStderr = rawStderr;
    this.healingAttempt = healingAttempt;
  }
}

/**
 * Non-bypassable verification gate:
 * Blocks any broken, invalid, or failing code from progressing to visual audit or Git publication.
 */
export function assertVerificationGate(result: CompilationResult): void {
  if (!result.success || result.exitCode !== 0 || result.diagnostics.length > 0) {
    const errorCount = result.diagnostics.filter(d => d.severity === 'error').length || result.diagnostics.length;
    throw new SandboxGateViolationError(
      `Sandbox Verification Gate BLOCKED: ${errorCount} compiler error(s) detected. Code cannot progress to visual audit or Git publication.`,
      result.diagnostics,
      result.exitCode,
      result.stderr,
      result.healingAttemptCount
    );
  }
}

// ============================================================================
// 4. Sandbox Sentry Verification Engine
// ============================================================================

export interface SandboxConfig {
  /** Maximum CPU ceiling (Laptop Governance: max 1.5 CPUs) */
  cpuLimit?: string;
  /** Maximum RAM ceiling (Laptop Governance: max 1536m / 1.5GB) */
  memoryLimit?: string;
  /** Maximum swap ceiling (2048m) */
  memorySwapLimit?: string;
  /** Hard timeout in milliseconds before process reaping (default: 45000ms) */
  timeoutMs?: number;
  /** Docker image name for compilation sandbox (default: 'omnistack-sandbox:latest') */
  dockerImage?: string;
  /** Max healing iterations before persistent quarantine (default: 3) */
  maxHealingIterations?: number;
  /** Base quarantine directory (default: 'quarantine') */
  quarantineBaseDir?: string;
  /** Allow fallback to isolated local subprocess when Docker is unavailable */
  allowSubprocessFallback?: boolean;
}

export const DEFAULT_SANDBOX_CONFIG: Required<SandboxConfig> = {
  cpuLimit: '1.5',
  memoryLimit: '1536m',
  memorySwapLimit: '2048m',
  timeoutMs: 45000, // 45 seconds hard ceiling (CPU_RESOURCE_GOVERNANCE.md)
  dockerImage: 'omnistack-sandbox:latest',
  maxHealingIterations: 3,
  quarantineBaseDir: 'quarantine',
  allowSubprocessFallback: true,
};

export interface RunCompilerDiagnosticsOptions {
  jobId?: string;
  cwd?: string;
  timeoutMs?: number;
  healingAttemptCount?: number;
  action?: 'compile' | 'typecheck' | 'build';
  env?: Record<string, string>;
  allowSubprocessFallback?: boolean;
}

export interface VerifyVirtualFileSystemOptions extends RunCompilerDiagnosticsOptions {
  targetDir?: string;
  cleanup?: boolean;
}

export class SandboxVerificationEngine {
  private config: Required<SandboxConfig>;

  constructor(customConfig?: Partial<SandboxConfig>) {
    this.config = {
      ...DEFAULT_SANDBOX_CONFIG,
      ...customConfig,
    };
  }

  /**
   * Check if Docker CLI and daemon are currently accessible.
   */
  public async isDockerAvailable(): Promise<boolean> {
    return new Promise((resolve) => {
      const proc = spawn('docker', ['info'], { stdio: 'ignore', shell: true });
      proc.on('error', () => resolve(false));
      proc.on('close', (code) => resolve(code === 0));
    });
  }

  /**
   * Constructs the deterministic Docker execution command enforcing:
   * - Strict CPU quota: 1.5 cores
   * - Strict Memory ceiling: 1536M
   * - Zero network isolation: --network none
   * - Immutable root filesystem: --read-only
   * - Unprivileged execution: --user 1000:1000
   * - Ephemeral container cleanup: --rm
   */
  public buildDockerRunArgs(hostWorkspacePath: string, action = 'compile'): string[] {
    const normalizedHostPath = path.resolve(hostWorkspacePath).replace(/\\/g, '/');
    return [
      'run',
      '--rm',
      `--cpus=${this.config.cpuLimit}`,
      `--memory=${this.config.memoryLimit}`,
      `--memory-swap=${this.config.memorySwapLimit}`,
      '--network', 'none',
      '--read-only',
      '--user', '1000:1000',
      '--security-opt', 'no-new-privileges:true',
      '--cap-drop', 'ALL',
      '--pids-limit', '100',
      '--tmpfs', '/tmp:rw,noexec,nosuid,size=256m',
      '--tmpfs', '/sandbox/.next/cache:rw,size=512m',
      '--tmpfs', '/sandbox/dist:rw,size=256m',
      '--tmpfs', '/home/node/.npm:rw,noexec,nosuid,size=128m',
      '-v', `${normalizedHostPath}:/sandbox`,
      this.config.dockerImage,
      action,
    ];
  }

  /**
   * Runs the deterministic build passes inside an ephemeral Docker container.
   */
  private async runInDocker(
    workspacePath: string,
    action = 'compile'
  ): Promise<{ exitCode: number; stdout: string; stderr: string }> {
    const args = this.buildDockerRunArgs(workspacePath, action);

    return new Promise((resolve) => {
      let stdout = '';
      let stderr = '';
      let isTimedOut = false;

      const proc = spawn('docker', args, { shell: true });

      const timer = setTimeout(() => {
        isTimedOut = true;
        try {
          proc.kill('SIGKILL');
        } catch {
          // ignore kill errors
        }
      }, this.config.timeoutMs);

      proc.stdout?.on('data', (data) => {
        stdout += data.toString();
      });

      proc.stderr?.on('data', (data) => {
        stderr += data.toString();
      });

      proc.on('error', (err) => {
        clearTimeout(timer);
        resolve({
          exitCode: 1,
          stdout,
          stderr: `${stderr}\n[Sandbox Sentry] Docker spawn error: ${err.message}`,
        });
      });

      proc.on('close', (code) => {
        clearTimeout(timer);
        if (isTimedOut) {
          resolve({
            exitCode: 124,
            stdout,
            stderr: `${stderr}\n[Sandbox Sentry] Container execution exceeded hard timeout (${this.config.timeoutMs}ms). Process killed.`,
          });
        } else {
          resolve({
            exitCode: code ?? 0,
            stdout,
            stderr,
          });
        }
      });
    });
  }

  /**
   * Fallback deterministic execution in an isolated child process
   * when Docker daemon is not available on host environment.
   */
  private async runInSubprocess(
    workspacePath: string
  ): Promise<{ exitCode: number; stdout: string; stderr: string }> {
    return new Promise((resolve) => {
      let stdout = '';
      let stderr = '';
      let isTimedOut = false;

      const isWindows = process.platform === 'win32';
      const cmd = isWindows ? 'cmd.exe' : 'bash';
      const args = isWindows
        ? ['/d', '/c', 'npx --no-install tsc --noEmit']
        : ['-c', 'npx --no-install tsc --noEmit'];

      const proc = spawn(cmd, args, {
        cwd: workspacePath,
        env: {
          ...process.env,
          NODE_ENV: 'production',
          CI: 'true',
        },
      });

      const timer = setTimeout(() => {
        isTimedOut = true;
        try {
          proc.kill();
        } catch {
          // ignore
        }
      }, this.config.timeoutMs);

      proc.stdout?.on('data', (data) => {
        stdout += data.toString();
      });

      proc.stderr?.on('data', (data) => {
        stderr += data.toString();
      });

      proc.on('error', (err) => {
        clearTimeout(timer);
        resolve({
          exitCode: 1,
          stdout,
          stderr: `${stderr}\n[Sandbox Sentry] Subprocess error: ${err.message}`,
        });
      });

      proc.on('close', (code) => {
        clearTimeout(timer);
        if (isTimedOut) {
          resolve({
            exitCode: 124,
            stdout,
            stderr: `${stderr}\n[Sandbox Sentry] Subprocess compilation timed out after ${this.config.timeoutMs}ms.`,
          });
        } else {
          resolve({
            exitCode: code ?? 0,
            stdout,
            stderr,
          });
        }
      });
    });
  }

  /**
   * Verifies a project filesystem by executing deterministic compilation passes
   * and intercepting compiler diagnostics.
   * 
   * Accepts either:
   * 1. A physical filesystem directory path
   * 2. A VirtualFileSystem (memfs) instance
   * 3. A Record<string, string> in-memory file dictionary
   */
  public async verifyProject(
    jobId: string,
    source: string | VirtualFileSystem | Record<string, string>,
    options: {
      healingAttemptCount?: number;
      action?: string;
    } = {}
  ): Promise<CompilationResult> {
    const attempt = options.healingAttemptCount ?? 1;
    let tempDir: string | null = null;
    let targetDir: string;

    if (typeof source === 'string') {
      targetDir = source;
    } else {
      // Materialize virtual files into ephemeral sandbox directory
      tempDir = path.join(os.tmpdir(), `omnistack-sandbox-${jobId}-${Date.now()}`);
      fs.mkdirSync(tempDir, { recursive: true });

      const filesMap: Record<string, string | null> =
        source instanceof VirtualFileSystem ? source.toJSON() : source;

      for (const [relPath, content] of Object.entries(filesMap)) {
        if (content !== null && typeof content === 'string') {
          const destPath = path.join(tempDir, relPath);
          fs.mkdirSync(path.dirname(destPath), { recursive: true });
          fs.writeFileSync(destPath, content, 'utf8');
        }
      }
      targetDir = tempDir;
    }

    try {
      let rawResult: { exitCode: number; stdout: string; stderr: string };

      const dockerReady = await this.isDockerAvailable();
      if (dockerReady) {
        rawResult = await this.runInDocker(targetDir, options.action ?? 'compile');
      } else if (this.config.allowSubprocessFallback) {
        rawResult = await this.runInSubprocess(targetDir);
      } else {
        throw new Error(
          '[Sandbox Sentry] Docker daemon unavailable and subprocess fallback disabled.'
        );
      }

      // Parse compiler stderr & stdout into structured diagnostics
      const combinedOutput = `${rawResult.stdout}\n${rawResult.stderr}`;
      const diagnostics = parseTypeScriptDiagnostics(combinedOutput);
      const isSuccess = rawResult.exitCode === 0 && diagnostics.length === 0;

      // Handle quarantine isolation if maximum healing attempts are exceeded
      if (!isSuccess && attempt >= this.config.maxHealingIterations) {
        await isolateToQuarantine(
          targetDir,
          jobId,
          diagnostics,
          rawResult.stderr,
          attempt,
          this.config.quarantineBaseDir
        );
      }

      const compilationResult: CompilationResult = {
        jobId,
        success: isSuccess,
        exitCode: rawResult.exitCode,
        stdout: rawResult.stdout,
        stderr: rawResult.stderr,
        diagnostics,
        healingAttemptCount: attempt,
        verifiedAt: new Date().toISOString(),
      };

      return compilationResult;
    } finally {
      // Cleanup ephemeral temporary directory if created
      if (tempDir && fs.existsSync(tempDir)) {
        try {
          fs.rmSync(tempDir, { recursive: true, force: true });
        } catch {
          // ignore temp cleanup error
        }
      }
    }
  }
}

// ============================================================================
// 5. Standalone Helper Functions
// ============================================================================

/**
 * Runs compiler diagnostics on a workspace directory.
 */
export async function runCompilerDiagnostics(
  cwd: string,
  options: RunCompilerDiagnosticsOptions = {}
): Promise<CompilationResult> {
  const engine = new SandboxVerificationEngine({
    timeoutMs: options.timeoutMs ?? 45000,
    allowSubprocessFallback: options.allowSubprocessFallback ?? true,
  });

  return engine.verifyProject(options.jobId ?? `job_${Date.now()}`, cwd, {
    healingAttemptCount: options.healingAttemptCount ?? 1,
    action: options.action ?? 'compile',
  });
}

/**
 * Verifies an in-memory VirtualFileSystem project tree in the sandbox.
 */
export async function verifyVirtualFileSystem(
  vfs: VirtualFileSystem,
  options: VerifyVirtualFileSystemOptions = {}
): Promise<CompilationResult> {
  const engine = new SandboxVerificationEngine({
    timeoutMs: options.timeoutMs ?? 45000,
    allowSubprocessFallback: options.allowSubprocessFallback ?? true,
  });

  return engine.verifyProject(options.jobId ?? `job_${Date.now()}`, vfs, {
    healingAttemptCount: options.healingAttemptCount ?? 1,
    action: options.action ?? 'compile',
  });
}
