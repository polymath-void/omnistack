/**
 * @omnistack/server - Extended API Controllers
 * Modular endpoints for Scaffolding, Vision Auditing, AST Introspection, Living Docs, and PR Tinder.
 */

import type { IncomingMessage, ServerResponse } from 'node:http';
import * as fs from 'node:fs';
import * as path from 'node:path';
import type { ASTComponentMetadata, ASTPropDefinition } from '@omnistack/types';
import { executeSelfHealingPipeline } from '@omnistack/scaffolder-core';
import { extractComponentMetadata, generateMockProps } from '@omnistack/ast-engine';
import { parseCssColor, evaluateContrast, solveContrastViolation } from '@omnistack/vision-auditor';
import { compileComponentMDX, renderPlaygroundHTML } from '@omnistack/docgen-renderer';
import { chunkDiffForMobile, generateQRCodeDataURL, createPairingSession } from '@omnistack/github-bridge';
import { getDatabase, PRReviewsRepository } from '@omnistack/db';
import { handleImageUpload, UPLOADS_DIR } from './upload.js';

function readJsonBody(req: IncomingMessage): Promise<any> {
  return new Promise((resolve, reject) => {
    let body = '';
    req.on('data', chunk => { body += chunk; });
    req.on('end', () => {
      try {
        resolve(body ? JSON.parse(body) : {});
      } catch (err) {
        reject(err);
      }
    });
    req.on('error', reject);
  });
}

function sendJson(res: ServerResponse, statusCode: number, data: any): void {
  res.writeHead(statusCode, {
    'Content-Type': 'application/json',
    'Access-Control-Allow-Origin': '*',
  });
  res.end(JSON.stringify(data, null, 2));
}

// ---------------------------------------------------------------------------
// 1. Scaffolding Controller
// ---------------------------------------------------------------------------
export async function handleScaffoldRoute(req: IncomingMessage, res: ServerResponse): Promise<void> {
  try {
    const payload = await readJsonBody(req);
    const projectName = payload.projectName || 'OmniStackApp';
    const prompt = payload.prompt || 'Autonomous full-stack commerce storefront';
    const templateId = payload.templateId || 'cybermech_01';

    const result = await executeSelfHealingPipeline({
      projectName,
      prompt,
      templateId,
      runVisionAudit: payload.runVisionAudit !== false,
    });

    sendJson(res, 200, {
      success: true,
      projectId: result.projectId,
      jobId: result.jobId,
      status: result.status,
      fileCount: result.fileCount,
      zipSizeBytes: result.zipSizeBytes,
      auditReport: result.auditReport,
      appliedPatches: result.appliedPatches,
      logs: result.logs,
    });
  } catch (err: any) {
    sendJson(res, 500, { error: 'Scaffold pipeline failed: ' + err.message });
  }
}

// ---------------------------------------------------------------------------
// 2. Vision Audit Controller
// ---------------------------------------------------------------------------
export async function handleAuditVisualRoute(req: IncomingMessage, res: ServerResponse): Promise<void> {
  try {
    const payload = await readJsonBody(req);
    const fg = payload.foreground || payload.fg || '#6b7280';
    const bg = payload.background || payload.bg || '#000000';

    const fgRgb = parseCssColor(fg);
    const bgRgb = parseCssColor(bg);
    const { ratio, passesAA, passesAAA } = evaluateContrast(fgRgb, bgRgb);

    let remediation = null;
    if (!passesAA || payload.fix) {
      remediation = solveContrastViolation({
        foreground: fg,
        background: bg,
        targetRatio: 4.5,
        property: 'text',
      });
    }

    sendJson(res, 200, {
      contrastRatio: ratio,
      passesAA,
      passesAAA,
      remediation,
      verdict: passesAA ? 'COMPLIANT' : 'VIOLATION_DETECTED',
    });
  } catch (err: any) {
    sendJson(res, 400, { error: 'Visual audit failed: ' + err.message });
  }
}

// ---------------------------------------------------------------------------
// 3. AST Introspection Controller
// ---------------------------------------------------------------------------
export async function handleAstIntrospectRoute(req: IncomingMessage, res: ServerResponse): Promise<void> {
  try {
    const payload = await readJsonBody(req);
    const code = payload.code || `
      import React from 'react';
      export interface CardProps { title: string; count?: number; isActive: boolean; }
      export function Card({ title, count = 1, isActive }: CardProps) {
        return <div>{title}</div>;
      }
    `;
    const filePath = payload.filePath || '/components/Card.tsx';

    const metadata = extractComponentMetadata(filePath, code);
    const mockProps = generateMockProps(metadata.propsSchema, { seed: 1337 });

    sendJson(res, 200, {
      componentName: metadata.componentName,
      filePath: metadata.filePath,
      propsSchema: metadata.propsSchema,
      exports: metadata.exports,
      dependencies: metadata.dependencies,
      docstring: metadata.docstring,
      mockProps,
    });
  } catch (err: any) {
    sendJson(res, 400, { error: 'AST introspection failed: ' + err.message });
  }
}

// ---------------------------------------------------------------------------
// 4. Living Docs & Playground Controller
// ---------------------------------------------------------------------------
function getSampleComponentMetadata(componentName: string): ASTComponentMetadata {
  const propsSchema: Record<string, ASTPropDefinition> = {
    headline: { name: 'headline', type: 'string', required: true, defaultValue: 'Apex Experience', description: 'Hero headline title' },
    subhead: { name: 'subhead', type: 'string', required: false, defaultValue: 'Engineered for speed.', description: 'Secondary descriptive text' },
    ctaText: { name: 'ctaText', type: 'string', required: false, defaultValue: 'Explore Store', description: 'Primary action button label' },
    isActive: { name: 'isActive', type: 'boolean', required: false, defaultValue: 'true', description: 'Visibility state' },
  };

  return {
    id: `comp_${componentName}`,
    projectId: 'omnistack_forge',
    filePath: `/components/${componentName}.tsx`,
    componentName,
    propsSchema,
    exports: [componentName],
    dependencies: ['react', 'framer-motion'],
    docstring: 'Living documentation rendered automatically from component TypeScript AST.',
  };
}

export async function handleDocsRoute(_req: IncomingMessage, res: ServerResponse, componentName: string): Promise<void> {
  const dummyMeta = getSampleComponentMetadata(componentName);

  const mdx = compileComponentMDX(dummyMeta, {
    headline: 'Apex Tactile Experience',
    subhead: 'Engineered for tactile enthusiasts.',
    ctaText: 'Shop Launch Collection',
    isActive: true,
  });

  res.writeHead(200, { 'Content-Type': 'text/markdown; charset=utf-8' });
  res.end(mdx);
}

export function handlePlaygroundRoute(res: ServerResponse, componentName: string): void {
  const dummyMeta = getSampleComponentMetadata(componentName);

  const html = renderPlaygroundHTML(dummyMeta, {
    headline: 'Apex Tactile 65% Hub',
    subhead: 'Engineered with Lubed Holy Pandas & Polycarbonate Plate.',
    ctaText: 'Configure & Buy',
    isActive: true,
  });

  res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8' });
  res.end(html);
}

// ---------------------------------------------------------------------------
// 5. PR Tinder & Mobile Review Controller
// ---------------------------------------------------------------------------
export async function handlePRsRoute(_req: IncomingMessage, res: ServerResponse): Promise<void> {
  const mockUnifiedDiff = `diff --git a/components/Hero.tsx b/components/Hero.tsx
index 83a21bc..9f120aa 100644
--- a/components/Hero.tsx
+++ b/components/Hero.tsx
@@ -12,7 +12,7 @@ export function Hero() {
   return (
     <section className="py-24 px-6 max-w-7xl mx-auto">
-      <span className="text-gray-500 bg-zinc-800">TACTILE</span>
+      <span className="text-gray-400 bg-zinc-800 font-bold">TACTILE</span>
       <h1 className="text-5xl font-extrabold">ApexCyber 65% Tactile Hub</h1>
     </section>
   );`;

  const cards = chunkDiffForMobile(mockUnifiedDiff, {
    linesPerCard: 10,
    maxCharsPerLine: 42,
  });

  const pairing = createPairingSession({
    projectId: 'omnistack-studio',
    prNumber: 42,
    wsUrl: 'ws://localhost:4000/api/v1/mobile-review',
  });

  const qrDataUrl = await generateQRCodeDataURL(pairing.pairingUrl);

  sendJson(res, 200, {
    prNumber: 42,
    title: 'Self-Healing WCAG Contrast Fix in Hero Badge',
    author: 'omnistack_vision',
    branch: 'fix/hero-contrast-wcag-aa',
    status: 'OPEN',
    totalCards: cards.length,
    cards,
    pairing: {
      pairingUrl: pairing.pairingUrl,
      qrDataUrl,
    },
  });
}

export async function handleSwipeReviewRoute(req: IncomingMessage, res: ServerResponse): Promise<void> {
  try {
    const payload = await readJsonBody(req);
    const { prNumber, action, reviewer, feedbackText } = payload;

    const db = getDatabase();
    const reviewsRepo = new PRReviewsRepository(db);

    const reviewId = `rev_${Date.now()}`;
    reviewsRepo.saveReview({
      id: reviewId,
      project_id: 'omnistack-studio',
      pr_number: prNumber || 42,
      title: 'PR Review Action',
      author: reviewer || 'Mobile Reviewer',
      diff_summary_json: JSON.stringify({ action }),
      verdict: action === 'APPROVE' ? 'APPROVED' : action === 'REQUEST_CHANGES' ? 'CHANGES_REQUESTED' : 'DELEGATED',
      feedback_text: feedbackText || null,
      reviewed_at: Date.now(),
    });

    sendJson(res, 200, {
      success: true,
      reviewId,
      action,
      verdict: action === 'APPROVE' ? 'APPROVED' : 'CHANGES_REQUESTED',
      message: `Swipe gesture ${action} processed and recorded to SQLite database.`,
    });
  } catch (err: any) {
    sendJson(res, 400, { error: 'Swipe review failed: ' + err.message });
  }
}

// ---------------------------------------------------------------------------
// 6. Image Upload Controller
// ---------------------------------------------------------------------------
export async function handleUploadRoute(req: IncomingMessage, res: ServerResponse): Promise<void> {
  try {
    const result = await handleImageUpload(req);
    sendJson(res, 200, result);
  } catch (err: any) {
    sendJson(res, 400, { error: 'Image upload failed: ' + err.message });
  }
}

// ---------------------------------------------------------------------------
// 7. Static Asset Serving (/uploads/*)
// ---------------------------------------------------------------------------
export function serveStaticUpload(res: ServerResponse, filename: string): boolean {
  const filePath = path.join(UPLOADS_DIR, path.basename(filename));
  if (fs.existsSync(filePath)) {
    const ext = path.extname(filePath).toLowerCase();
    const mimeTypes: Record<string, string> = {
      '.png': 'image/png',
      '.jpg': 'image/jpeg',
      '.jpeg': 'image/jpeg',
      '.webp': 'image/webp',
      '.svg': 'image/svg+xml',
    };
    const contentType = mimeTypes[ext] || 'application/octet-stream';
    res.writeHead(200, { 'Content-Type': contentType });
    fs.createReadStream(filePath).pipe(res);
    return true;
  }
  return false;
}
