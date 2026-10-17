/**
 * @omnistack/scaffolder-core - Closed-Loop Self-Healing Pipeline Integration Test
 * 
 * Verifies:
 * 1. Scaffold ➔ AST ➔ Sandbox Sentry (0 diagnostics) ➔ Vision Audit ➔ Non-destructive Recast Patch
 * 2. In-memory ZIP archive generation with verified valid entries and patched code
 * 3. Persistence of projects, scaffold_jobs, and ui_audits to SQLite database via @omnistack/db
 */

import { describe, it, beforeEach } from 'node:test';
import * as assert from 'node:assert';
import { executeSelfHealingPipeline } from './pipeline.js';
import {
  getDatabase,
  resetDatabaseForTesting,
  ProjectsRepository,
  ScaffoldJobsRepository,
  UIAuditsRepository,
} from '@omnistack/db';

describe('Closed-Loop Self-Healing Pipeline Integration', () => {
  beforeEach(() => {
    // Reset database to fresh in-memory SQLite for isolated test execution
    resetDatabaseForTesting();
  });

  it('should execute end-to-end self-healing pipeline with zero compiler diagnostics and clean ZIP', async () => {
    const projectName = 'Apex Cyber Store';
    const prompt = 'Autonomous cybernetic mechanical keyboard store with dark mode';

    const result = await executeSelfHealingPipeline({
      projectName,
      prompt,
      templateId: 'cybermech_01',
    });

    // 1. Result Status & Structural Verification
    assert.strictEqual(result.status, 'COMPLETED');
    assert.ok(result.projectId.startsWith('proj_'));
    assert.ok(result.jobId.startsWith('job_'));
    assert.ok(result.fileCount >= 5, 'Should generate at least 5 scaffolding files');

    // 2. Zero Compiler Diagnostics Gate
    assert.strictEqual(
      result.auditReport.diagnosticsChecked,
      0,
      'TypeScript sentry should record zero compiler diagnostic errors'
    );
    assert.strictEqual(result.auditReport.diagnosticsPassed, true);
    assert.strictEqual(result.auditReport.healingAttempts, 0);

    // 3. Vision Audit & OKLab Contrast Self-Healing Gate
    assert.strictEqual(result.auditReport.contrastEvaluations, 1);
    assert.strictEqual(result.auditReport.contrastViolationsFound, 1);
    assert.strictEqual(result.auditReport.contrastPatchesApplied, 1);
    assert.strictEqual(result.auditReport.status, 'HEALED');
    assert.ok(
      result.appliedPatches.some((p) => p.includes('text-gray-500 ➔ text-gray-400')),
      'Applied patches must record text-gray-500 replacement'
    );

    // 4. Clean ZIP Archive Generation
    assert.ok(result.artifactZipBuffer instanceof Buffer, 'ZIP artifact must be a Buffer');
    assert.ok(result.zipSizeBytes > 1000, 'ZIP size must be substantial (> 1KB)');
    assert.strictEqual(result.artifactZipBuffer.length, result.zipSizeBytes);

    // Verify ZIP magic bytes (PK\x03\x04 = 0x50, 0x4B, 0x03, 0x04)
    assert.strictEqual(result.artifactZipBuffer[0], 0x50, 'ZIP byte 0 must be 0x50 (P)');
    assert.strictEqual(result.artifactZipBuffer[1], 0x4b, 'ZIP byte 1 must be 0x4B (K)');
    assert.strictEqual(result.artifactZipBuffer[2], 0x03, 'ZIP byte 2 must be 0x03');
    assert.strictEqual(result.artifactZipBuffer[3], 0x04, 'ZIP byte 3 must be 0x04');

    // 5. Database Persistence via @omnistack/db
    const db = getDatabase();
    const projectsRepo = new ProjectsRepository(db);
    const jobsRepo = new ScaffoldJobsRepository(db);
    const auditsRepo = new UIAuditsRepository(db);

    const projectRecord = projectsRepo.getById(result.projectId);
    assert.ok(projectRecord, `Project ${result.projectId} must be persisted in SQLite`);
    assert.strictEqual(projectRecord.name, projectName);
    assert.strictEqual(projectRecord.prompt, prompt);
    assert.strictEqual(projectRecord.status, 'ready');

    const jobRecord = jobsRepo.getById(result.jobId);
    assert.ok(jobRecord, `Job ${result.jobId} must be persisted in SQLite`);
    assert.strictEqual(jobRecord.project_id, result.projectId);
    assert.strictEqual(jobRecord.current_step, 'done');
    assert.strictEqual(jobRecord.progress_percent, 100);
    assert.strictEqual(jobRecord.healing_attempts, 0);
    assert.ok(jobRecord.logs?.includes('Starting self-healing pipeline'));
    assert.ok(jobRecord.logs?.includes('ZIP archive created successfully'));

    const audits = auditsRepo.listByProject(result.projectId);
    assert.strictEqual(audits.length, 1, 'UI Audit record must be persisted in SQLite');
    assert.strictEqual(audits[0]!.project_id, result.projectId);
    assert.strictEqual(audits[0]!.viewport, 'mobile');
    assert.strictEqual(audits[0]!.a11y_violations_count, 1);
  });
});
