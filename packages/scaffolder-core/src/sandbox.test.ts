/**
 * @omnistack/scaffolder-core - Sandbox Sentry Verification Engine Test Suite
 * 
 * Validates compiler stderr parsing (TS2304, TS2322, TS2339),
 * container resource argument construction, verification gate assertions,
 * and quarantine isolation mechanics.
 */

import { describe, it } from 'node:test';
import * as assert from 'node:assert';
import * as fs from 'node:fs';
import * as path from 'node:path';
import * as os from 'node:os';
import {
  parseTypeScriptDiagnostics,
  stripAnsi,
  normalizeDiagnosticFilePath,
  groupDiagnosticsByFile,
  extractSnippet,
  assertVerificationGate,
  SandboxGateViolationError,
  SandboxVerificationEngine,
  isolateToQuarantine,
  DEFAULT_SANDBOX_CONFIG,
} from './sandbox.js';
import type { CompilationResult } from '@omnistack/types';

describe('Sandbox Sentry Diagnostic Parsing Engine', () => {
  it('should parse TS2339 (Property does not exist on type)', () => {
    const rawTrace = `
src/components/Checkout.tsx:42:15 - error TS2339: Property 'clientSecret' does not exist on type 'PaymentIntent'.

42     const secret = payment.clientSecret;
                             ~~~~~~~~~~~~
`;
    const diagnostics = parseTypeScriptDiagnostics(rawTrace);

    assert.strictEqual(diagnostics.length, 1);
    const diag = diagnostics[0]!;
    assert.strictEqual(diag.file, 'src/components/Checkout.tsx');
    assert.strictEqual(diag.line, 42);
    assert.strictEqual(diag.column, 15);
    assert.strictEqual(diag.code, 'TS2339');
    assert.strictEqual(diag.severity, 'error');
    assert.strictEqual(
      diag.message,
      "Property 'clientSecret' does not exist on type 'PaymentIntent'."
    );
    assert.ok(diag.snippet?.includes('~~~~~~~~~~~~'));
  });

  it('should parse TS2304 (Cannot find name)', () => {
    const rawTrace = `
src/services/stripe.ts:18:7 - error TS2304: Cannot find name 'stripeWebhookSecret'.

18   if (!stripeWebhookSecret) {
          ~~~~~~~~~~~~~~~~~~~
`;
    const diagnostics = parseTypeScriptDiagnostics(rawTrace);

    assert.strictEqual(diagnostics.length, 1);
    const diag = diagnostics[0]!;
    assert.strictEqual(diag.file, 'src/services/stripe.ts');
    assert.strictEqual(diag.line, 18);
    assert.strictEqual(diag.column, 7);
    assert.strictEqual(diag.code, 'TS2304');
    assert.strictEqual(diag.message, "Cannot find name 'stripeWebhookSecret'.");
  });

  it('should parse TS2322 (Type mismatch / not assignable)', () => {
    const rawTrace = `
src/models/product.ts:25:3 - error TS2322: Type 'string' is not assignable to type 'number'.

25   price: "19.99",
     ~~~~~
`;
    const diagnostics = parseTypeScriptDiagnostics(rawTrace);

    assert.strictEqual(diagnostics.length, 1);
    const diag = diagnostics[0]!;
    assert.strictEqual(diag.file, 'src/models/product.ts');
    assert.strictEqual(diag.line, 25);
    assert.strictEqual(diag.column, 3);
    assert.strictEqual(diag.code, 'TS2322');
    assert.strictEqual(diag.message, "Type 'string' is not assignable to type 'number'.");
  });

  it('should parse parenthesized format (file(line,col): error TSxxxx)', () => {
    const rawTrace = `
src/views/Home.tsx(10,5): error TS2554: Expected 2 arguments, but got 1.
`;
    const diagnostics = parseTypeScriptDiagnostics(rawTrace);

    assert.strictEqual(diagnostics.length, 1);
    const diag = diagnostics[0]!;
    assert.strictEqual(diag.file, 'src/views/Home.tsx');
    assert.strictEqual(diag.line, 10);
    assert.strictEqual(diag.column, 5);
    assert.strictEqual(diag.code, 'TS2554');
    assert.strictEqual(diag.message, 'Expected 2 arguments, but got 1.');
  });

  it('should parse Next.js / Webpack build errors', () => {
    const rawTrace = `
Failed to compile.
./src/app/api/route.ts:15:20
Type error: TS2339: Property 'json' does not exist on type 'Request'.
`;
    const diagnostics = parseTypeScriptDiagnostics(rawTrace);

    assert.strictEqual(diagnostics.length, 1);
    const diag = diagnostics[0]!;
    assert.strictEqual(diag.file, 'src/app/api/route.ts');
    assert.strictEqual(diag.line, 15);
    assert.strictEqual(diag.column, 20);
    assert.strictEqual(diag.code, 'TS2339');
    assert.ok(diag.message.includes("Property 'json' does not exist on type 'Request'"));
  });

  it('should strip ANSI colors cleanly from terminal output', () => {
    const coloredOutput = '\u001b[31msrc/index.ts:5:2 - error TS2304: Cannot find name \'x\'.\u001b[39m';
    const clean = stripAnsi(coloredOutput);
    assert.strictEqual(clean, "src/index.ts:5:2 - error TS2304: Cannot find name 'x'.");

    const diagnostics = parseTypeScriptDiagnostics(coloredOutput);
    assert.strictEqual(diagnostics.length, 1);
    assert.strictEqual(diagnostics[0]?.code, 'TS2304');
  });

  it('should normalize Windows backslashes and container prefixes', () => {
    assert.strictEqual(
      normalizeDiagnosticFilePath('/sandbox/src/components/Header.tsx'),
      'src/components/Header.tsx'
    );
    assert.strictEqual(
      normalizeDiagnosticFilePath('src\\components\\Header.tsx'),
      'src/components/Header.tsx'
    );
    assert.strictEqual(
      normalizeDiagnosticFilePath('./src/index.ts'),
      'src/index.ts'
    );
  });

  it('should group diagnostics by file', () => {
    const diagnostics = parseTypeScriptDiagnostics(`
src/A.ts:1:1 - error TS2304: Cannot find name 'a'.
src/B.ts:2:2 - error TS2304: Cannot find name 'b'.
src/A.ts:5:5 - error TS2322: Type mismatch.
`);
    const grouped = groupDiagnosticsByFile(diagnostics);
    assert.strictEqual(Object.keys(grouped).length, 2);
    assert.strictEqual(grouped['src/A.ts']?.length, 2);
    assert.strictEqual(grouped['src/B.ts']?.length, 1);
  });

  it('should format snippet with line and column pointer', () => {
    const lines = [
      'import { useState } from "react";',
      'export function Counter() {',
      '  const [count, setCount] = useState(0);',
      '  return <div onClick={() => setCount("bad")}>{count}</div>;',
      '}',
    ];
    const snippet = extractSnippet(lines, 4, 39, 1);
    assert.ok(snippet.includes('>    4 |   return <div onClick={() => setCount("bad")}>{count}</div>;'));
    assert.ok(snippet.includes('^'));
  });
});

describe('Sandbox Verification Gate & Isolation Governance', () => {
  it('should build Docker run args adhering to Laptop Resource Governance (Rule 3)', () => {
    const engine = new SandboxVerificationEngine();
    const args = engine.buildDockerRunArgs('/workspace/project1', 'compile');

    // Rule 3: max 1.5 CPUs, 1536m RAM, 2048m swap, network none, read-only
    assert.ok(args.includes('--cpus=1.5'), 'Missing strict 1.5 CPU quota');
    assert.ok(args.includes('--memory=1536m'), 'Missing strict 1536M memory limit');
    assert.ok(args.includes('--memory-swap=2048m'), 'Missing strict 2048M swap limit');
    assert.ok(args.includes('--network'), 'Missing network flag');
    assert.ok(args.includes('none'), 'Missing network none parameter');
    assert.ok(args.includes('--read-only'), 'Missing read-only root enforcement');
    assert.ok(args.includes('--user'), 'Missing unprivileged user parameter');
    assert.ok(args.includes('1000:1000'), 'Missing 1000:1000 user quota');
    assert.ok(args.includes(DEFAULT_SANDBOX_CONFIG.dockerImage), 'Missing sandbox image');
  });

  it('should pass verification gate for successful compilation', () => {
    const cleanResult: CompilationResult = {
      jobId: 'job_test_success',
      success: true,
      exitCode: 0,
      stdout: 'Compilation complete.',
      stderr: '',
      diagnostics: [],
      healingAttemptCount: 1,
      verifiedAt: new Date().toISOString(),
    };

    // Does not throw
    assert.doesNotThrow(() => {
      assertVerificationGate(cleanResult);
    });
  });

  it('should throw SandboxGateViolationError and block unverified code', () => {
    const failedResult: CompilationResult = {
      jobId: 'job_test_fail',
      success: false,
      exitCode: 1,
      stdout: '',
      stderr: "src/app.ts:1:1 - error TS2304: Cannot find name 'broken'.",
      diagnostics: [
        {
          file: 'src/app.ts',
          line: 1,
          column: 1,
          code: 'TS2304',
          message: "Cannot find name 'broken'.",
          severity: 'error',
        },
      ],
      healingAttemptCount: 1,
      verifiedAt: new Date().toISOString(),
    };

    assert.throws(
      () => {
        assertVerificationGate(failedResult);
      },
      (err: unknown) => {
        assert.ok(err instanceof SandboxGateViolationError);
        assert.strictEqual(err.diagnostics.length, 1);
        assert.strictEqual(err.diagnostics[0]?.code, 'TS2304');
        assert.ok(err.message.includes('Sandbox Verification Gate BLOCKED'));
        return true;
      }
    );
  });

  it('should isolate persistent failures to quarantine directory after max healing', async () => {
    const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'quarantine-test-'));
    const testQuarantineDir = path.join(tempDir, 'quarantine-output');

    // Create a mock failing file
    const failingFilePath = path.join(tempDir, 'src', 'Checkout.tsx');
    fs.mkdirSync(path.dirname(failingFilePath), { recursive: true });
    fs.writeFileSync(failingFilePath, 'const bad = clientSecret;', 'utf8');

    const mockDiagnostics = [
      {
        file: 'src/Checkout.tsx',
        line: 1,
        column: 13,
        code: 'TS2304',
        message: "Cannot find name 'clientSecret'.",
        severity: 'error' as const,
      },
    ];

    const quarantineRecord = await isolateToQuarantine(
      tempDir,
      'job_quarantine_99',
      mockDiagnostics,
      'Simulated TS compiler error stderr',
      3,
      testQuarantineDir
    );

    assert.strictEqual(quarantineRecord.jobId, 'job_quarantine_99');
    assert.strictEqual(quarantineRecord.healingAttemptCount, 3);
    assert.ok(fs.existsSync(quarantineRecord.quarantinePath));

    const manifestFile = path.join(quarantineRecord.quarantinePath, 'quarantine-manifest.json');
    assert.ok(fs.existsSync(manifestFile));

    const manifestContent = JSON.parse(fs.readFileSync(manifestFile, 'utf8'));
    assert.strictEqual(manifestContent.jobId, 'job_quarantine_99');
    assert.strictEqual(manifestContent.diagnostics[0].code, 'TS2304');

    // Verify failing source file was preserved in quarantine
    const preservedFile = path.join(quarantineRecord.quarantinePath, 'files', 'src', 'Checkout.tsx');
    assert.ok(fs.existsSync(preservedFile));
    assert.strictEqual(fs.readFileSync(preservedFile, 'utf8'), 'const bad = clientSecret;');

    // Cleanup
    fs.rmSync(tempDir, { recursive: true, force: true });
  });
});
