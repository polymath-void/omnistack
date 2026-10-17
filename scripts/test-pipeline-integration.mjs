import { executeSelfHealingPipeline } from '@omnistack/scaffolder-core';
import { getDatabase, ProjectsRepository, ScaffoldJobsRepository, UIAuditsRepository } from '@omnistack/db';
import * as path from 'node:path';
import * as assert from 'node:assert';

async function main() {
  process.env['OMNISTACK_DB_PATH'] = path.resolve('omnistack.db');
  console.log('Testing executeSelfHealingPipeline with OMNISTACK_DB_PATH =', process.env['OMNISTACK_DB_PATH']);

  const projectName = 'Integration Check Store';
  const result = await executeSelfHealingPipeline({
    projectName,
    prompt: 'A modern cybernetic storefront with dark mode and zero contrast violations',
    templateId: 'hyper-local-artisan',
  });

  console.log('\n--- Pipeline Result ---');
  console.log('Project ID:', result.projectId);
  console.log('Job ID:', result.jobId);
  console.log('Status:', result.status);
  console.log('ZIP Buffer size (bytes):', result.zipSizeBytes);
  console.log('VFS file count:', result.fileCount);
  console.log('Applied patches:', result.appliedPatches);
  console.log('Audit report:', JSON.stringify(result.auditReport, null, 2));

  // Assertions on Result
  assert.strictEqual(result.status, 'COMPLETED', 'Pipeline status must be COMPLETED');
  assert.ok(result.zipSizeBytes > 0, 'ZIP size must be > 0 bytes');
  assert.ok(result.artifactZipBuffer instanceof Buffer, 'ZIP artifact must be a Buffer');
  assert.strictEqual(result.auditReport.diagnosticsChecked, 0, 'Diagnostics count must be 0');
  assert.strictEqual(result.auditReport.diagnosticsPassed, true, 'Diagnostics must pass');
  assert.strictEqual(result.auditReport.healingAttempts, 0, 'Healing attempts must be 0 for clean compilation');
  assert.strictEqual(result.auditReport.status, 'HEALED', 'Audit status should be HEALED due to contrast remediation');

  // Verify ZIP archive physical extraction and contents
  console.log('\n--- Verifying ZIP Archive Integrity ---');
  const tempDir = path.resolve('temp_test_zip_extracted');
  const tempZip = path.resolve('temp_test_artifact.zip');
  const fs = await import('node:fs');
  const { execFileSync } = await import('node:child_process');

  if (fs.existsSync(tempDir)) {
    fs.rmSync(tempDir, { recursive: true, force: true });
  }
  fs.mkdirSync(tempDir, { recursive: true });
  fs.writeFileSync(tempZip, result.artifactZipBuffer);

  // Extract using PowerShell Expand-Archive
  execFileSync('powershell.exe', [
    '-NoProfile',
    '-NonInteractive',
    '-Command',
    `Expand-Archive -Path '${tempZip}' -DestinationPath '${tempDir}' -Force`
  ]);

  const extractedFiles = fs.readdirSync(tempDir, { recursive: true }).map(f => f.toString().replace(/\\/g, '/'));
  console.log('Extracted Files from ZIP Archive:', extractedFiles);

  assert.ok(extractedFiles.some(f => f.includes('package.json')), 'ZIP must contain package.json');
  assert.ok(extractedFiles.some(f => f.includes('tsconfig.json')), 'ZIP must contain tsconfig.json');
  assert.ok(extractedFiles.some(f => f.includes('globals.css')), 'ZIP must contain app/globals.css');
  assert.ok(extractedFiles.some(f => f.includes('Hero.tsx')), 'ZIP must contain components/Hero.tsx');
  assert.ok(extractedFiles.some(f => f.includes('page.tsx')), 'ZIP must contain app/page.tsx');

  // Verify non-destructive AST patch inside the extracted ZIP
  const heroPath = path.join(tempDir, 'components', 'Hero.tsx');
  const heroSource = fs.readFileSync(heroPath, 'utf8');
  assert.ok(heroSource.includes('text-gray-400'), 'Hero.tsx inside ZIP must contain patched class "text-gray-400"');
  assert.ok(!heroSource.includes('text-gray-500'), 'Hero.tsx inside ZIP must NOT contain violating class "text-gray-500"');
  console.log('Verified: AST contrast patch correctly embedded in ZIP archive Hero.tsx');

  // Cleanup temporary test artifacts
  try {
    fs.rmSync(tempDir, { recursive: true, force: true });
    fs.unlinkSync(tempZip);
  } catch {
    // Ignore cleanup errors
  }

  // Verify omnistack.db persistence
  console.log('\n--- Verifying omnistack.db Persistence ---');
  const db = getDatabase();
  const projectsRepo = new ProjectsRepository(db);
  const jobsRepo = new ScaffoldJobsRepository(db);
  const auditsRepo = new UIAuditsRepository(db);

  console.log('\n--- Pipeline Execution Logs ---');
  console.log(result.logs.join('\n'));

  const proj = projectsRepo.getById(result.projectId);
  console.log('DB Project Record:', proj);
  assert.ok(proj, `Project ${result.projectId} must exist in omnistack.db`);
  assert.strictEqual(proj.name, projectName);
  assert.strictEqual(proj.status, 'ready');

  const job = jobsRepo.getById(result.jobId);
  console.log('DB Job Record:', job);
  assert.ok(job, `Job ${result.jobId} must exist in omnistack.db`);
  assert.strictEqual(job.project_id, result.projectId);
  assert.strictEqual(job.current_step, 'done');
  assert.strictEqual(job.progress_percent, 100);

  const audits = auditsRepo.listByProject(result.projectId);
  console.log('DB Audits Record count:', audits.length);
  assert.ok(audits.length > 0, 'UI Audit record should be persisted');
  assert.strictEqual(audits[0].project_id, result.projectId);

  console.log('\n>>> INTEGRATION CHECK PASSED: Clean ZIP, zero compiler diagnostics, omnistack.db verified! <<<');
}

main().catch(err => {
  console.error('\n>>> INTEGRATION CHECK FAILED <<<', err);
  process.exit(1);
});
