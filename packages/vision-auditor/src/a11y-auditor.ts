import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import type { Page } from 'puppeteer';
import { AxePuppeteer } from '@axe-core/puppeteer';
import type {
  ViewportKind,
  VisionPatchDirective,
  UIAuditReport,
  A11yViolationDetail,
  A11yViolationNode,
  ContrastRatioMetric,
} from '@omnistack/types';
import { BrowserPool } from './browser-pool.js';
import {
  parseCssColor,
  solveContrastViolation,
} from './contrast-solver.js';

export interface VisionAuditOptions {
  projectId?: string;
  targetFile?: string;
  componentName?: string;
  screenshotDir?: string;
  waitForSelector?: string;
  autoRemediateContrast?: boolean;
}

export interface ComputedElementStyleInfo {
  selector: string;
  className: string;
  color: string;
  backgroundColor: string;
  hasHorizontalOverflow: boolean;
}

/**
 * Executes an in-page DOM script to inspect computed foreground & effective background colors.
 */
export async function inspectElementStyles(
  page: Page,
  selector: string
): Promise<ComputedElementStyleInfo | null> {
  try {
    return await page.evaluate((sel: string) => {
      const el = document.querySelector(sel);
      if (!el || !(el instanceof HTMLElement)) return null;

      const computed = window.getComputedStyle(el);

      // Walk up the DOM tree to find an opaque or non-transparent background color
      let current: HTMLElement | null = el;
      let effectiveBg = 'rgb(255, 255, 255)'; // Default white background

      while (current && current !== document.documentElement) {
        const bg = window.getComputedStyle(current).backgroundColor;
        if (bg && bg !== 'transparent' && !bg.startsWith('rgba(0, 0, 0, 0)')) {
          effectiveBg = bg;
          break;
        }
        current = current.parentElement;
      }

      const hasHorizontalOverflow =
        document.documentElement.scrollWidth > document.documentElement.clientWidth;

      return {
        selector: sel,
        className: el.className || '',
        color: computed.color,
        backgroundColor: effectiveBg,
        hasHorizontalOverflow,
      };
    }, selector);
  } catch {
    return null;
  }
}

/**
 * Audits an open Puppeteer Page for WCAG 2.1 AA violations using axe-core,
 * resolves contrast deficits mathematically along brand hue curves,
 * and synthesizes VisionPatchDirective items.
 */
export async function auditPageAccessibility(
  page: Page,
  viewport: ViewportKind,
  options: VisionAuditOptions = {}
): Promise<UIAuditReport> {
  const projectId = options.projectId ?? 'default-project';
  const targetFile = options.targetFile ?? 'src/App.tsx';
  const autoRemediate = options.autoRemediateContrast ?? true;

  if (options.waitForSelector) {
    await page.waitForSelector(options.waitForSelector, { timeout: 10000 }).catch(() => {});
  }

  // 1. Run axe-core with WCAG 2.1 AA tags
  const axe = new AxePuppeteer(page).withTags([
    'wcag2a',
    'wcag2aa',
    'wcag21a',
    'wcag21aa',
    'cat.color',
  ]);

  const axeResults = await axe.analyze();

  const violations: A11yViolationDetail[] = [];
  const patchesApplied: VisionPatchDirective[] = [];
  let contrastViolationsCount = 0;

  for (const v of axeResults.violations) {
    const nodes: A11yViolationNode[] = v.nodes.map((n) => {
      const nodeObj: A11yViolationNode = {
        target: n.target.map(String),
        html: n.html,
      };
      if (n.failureSummary) {
        nodeObj.failureSummary = n.failureSummary;
      }
      return nodeObj;
    });

    const impact: 'minor' | 'moderate' | 'serious' | 'critical' =
      v.impact && ['minor', 'moderate', 'serious', 'critical'].includes(v.impact)
        ? (v.impact as 'minor' | 'moderate' | 'serious' | 'critical')
        : 'minor';

    violations.push({
      id: v.id,
      impact,
      description: v.description,
      help: v.help,
      helpUrl: v.helpUrl,
      nodes,
    });

    // 2. Synthesize patches for color contrast violations
    if (v.id === 'color-contrast' && autoRemediate) {
      contrastViolationsCount += nodes.length;

      for (const node of v.nodes) {
        const selector = node.target.map(String).join(' ');
        const styles = await inspectElementStyles(page, selector);
        if (!styles) continue;

        const fg = parseCssColor(styles.color);
        const bg = parseCssColor(styles.backgroundColor);

        // Identify existing text-* color class from element classes
        const classes = styles.className.split(/\s+/).filter(Boolean);
        const originalTextClass = classes.find((c) =>
          /^text-(?:slate|gray|zinc|neutral|stone|red|orange|amber|yellow|lime|green|emerald|teal|cyan|sky|blue|indigo|violet|purple|fuchsia|pink|rose)-\d+$/.test(
            c
          )
        );

        const solveOptions: {
          foreground: ReturnType<typeof parseCssColor>;
          background: ReturnType<typeof parseCssColor>;
          targetRatio: number;
          property: 'text';
          originalClass?: string;
        } = {
          foreground: fg,
          background: bg,
          targetRatio: 4.5,
          property: 'text',
        };
        if (originalTextClass) {
          solveOptions.originalClass = originalTextClass;
        }

        const solution = solveContrastViolation(solveOptions);

        if (solution) {
          const patchMetric: ContrastRatioMetric = {
            before: solution.initialContrastRatio,
            after: solution.resolvedContrastRatio,
            targetMinimum: 4.5,
          };

          const patch: VisionPatchDirective = {
            id: `patch-${crypto.randomUUID()}`,
            projectId,
            targetFile,
            selector,
            viewport,
            violationType: 'contrast',
            originalClasses: originalTextClass ? [originalTextClass] : [],
            replacementClasses: [solution.replacementClass],
            calculatedContrastRatio: patchMetric,
            deltaE: solution.deltaE,
            wcagCriteria: 'WCAG 2.1 AA 1.4.3 Contrast (Minimum)',
            status: 'PENDING',
          };

          if (options.componentName) {
            patch.componentName = options.componentName;
          }

          patchesApplied.push(patch);
        }
      }
    }

    // 3. Synthesize patches for image-alt violations
    if (v.id === 'image-alt') {
      for (const node of v.nodes) {
        const selector = node.target.map(String).join(' ');
        const patch: VisionPatchDirective = {
          id: `patch-${crypto.randomUUID()}`,
          projectId,
          targetFile,
          selector,
          viewport,
          violationType: 'a11y',
          originalClasses: [],
          replacementClasses: ['alt="Component visual asset"'],
          wcagCriteria: 'WCAG 2.1 A 1.1.1 Non-text Content',
          status: 'PENDING',
        };
        if (options.componentName) {
          patch.componentName = options.componentName;
        }
        patchesApplied.push(patch);
      }
    }

    // 4. Synthesize patches for button-name violations
    if (v.id === 'button-name') {
      for (const node of v.nodes) {
        const selector = node.target.map(String).join(' ');
        const patch: VisionPatchDirective = {
          id: `patch-${crypto.randomUUID()}`,
          projectId,
          targetFile,
          selector,
          viewport,
          violationType: 'a11y',
          originalClasses: [],
          replacementClasses: ['aria-label="Interactive action button"'],
          wcagCriteria: 'WCAG 2.1 A 4.1.2 Name, Role, Value',
          status: 'PENDING',
        };
        if (options.componentName) {
          patch.componentName = options.componentName;
        }
        patchesApplied.push(patch);
      }
    }
  }

  // 5. Check for horizontal overflow (WCAG 1.4.10 Reflow)
  const isOverflowing = await page.evaluate(() => {
    return document.documentElement.scrollWidth > document.documentElement.clientWidth;
  });

  if (isOverflowing) {
    const patch: VisionPatchDirective = {
      id: `patch-${crypto.randomUUID()}`,
      projectId,
      targetFile,
      selector: 'body',
      viewport,
      violationType: 'overflow',
      originalClasses: [],
      replacementClasses: ['overflow-x-hidden', 'max-w-full'],
      wcagCriteria: 'WCAG 2.1 AA 1.4.10 Reflow',
      status: 'PENDING',
    };
    if (options.componentName) {
      patch.componentName = options.componentName;
    }
    patchesApplied.push(patch);
  }

  // 6. Capture screenshot
  const screenshotDir = options.screenshotDir ?? path.join(process.cwd(), '.omnistack', 'screenshots');
  if (!fs.existsSync(screenshotDir)) {
    fs.mkdirSync(screenshotDir, { recursive: true });
  }

  const screenshotFilename = `${projectId}-${viewport}-${Date.now()}.png`;
  const screenshotPath = path.join(screenshotDir, screenshotFilename);

  const pool = BrowserPool.getInstance();
  await pool.captureViewportScreenshot(page, screenshotPath);

  // 7. Calculate aggregate scores
  const contrastScore = Math.max(0, Math.min(100, 100 - contrastViolationsCount * 15));
  const responsiveScore = Math.max(0, isOverflowing ? 70 : 100);
  const a11yViolationsCount = violations.reduce((acc, v) => acc + v.nodes.length, 0);

  return {
    id: `audit-${crypto.randomUUID()}`,
    projectId,
    viewport,
    screenshotPath,
    contrastScore,
    responsiveScore,
    a11yViolationsCount,
    violations,
    patchesApplied,
    createdAt: new Date().toISOString(),
  };
}

/**
 * High-level Vision Auditor service managing resource-constrained browser sessions,
 * multi-viewport rendering, and visual before/after snapshot diffs.
 */
export class VisionAuditor {
  private pool: BrowserPool;

  constructor() {
    this.pool = BrowserPool.getInstance();
  }

  /**
   * Run visual and accessibility audit for a target URL on a specific viewport.
   */
  public async auditUrl(
    url: string,
    viewport: ViewportKind,
    options: VisionAuditOptions = {}
  ): Promise<UIAuditReport> {
    return this.pool.withPage(viewport, async (page) => {
      await page.goto(url, { waitUntil: 'networkidle0' });
      return auditPageAccessibility(page, viewport, options);
    });
  }

  /**
   * Executes audits across all deterministic viewports (mobile, tablet, desktop)
   * sequentially to respect CPU/memory constraints.
   */
  public async auditAllViewports(
    url: string,
    options: VisionAuditOptions = {}
  ): Promise<Record<ViewportKind, UIAuditReport>> {
    const viewports: ViewportKind[] = ['mobile', 'tablet', 'desktop'];
    const results = {} as Record<ViewportKind, UIAuditReport>;

    for (const vp of viewports) {
      results[vp] = await this.auditUrl(url, vp, options);
    }

    return results;
  }

  /**
   * Captures visual before and after screenshots by applying synthesized
   * VisionPatchDirective patches in memory within the live DOM.
   */
  public async captureVisualDiff(
    page: Page,
    patches: VisionPatchDirective[],
    outputPathBefore: string,
    outputPathAfter: string
  ): Promise<{ beforeScreenshotPath: string; afterScreenshotPath: string }> {
    // 1. Snapshot Before
    await this.pool.captureViewportScreenshot(page, outputPathBefore);

    // 2. Apply patches directly into DOM classes in memory
    await page.evaluate((directives: VisionPatchDirective[]) => {
      for (const d of directives) {
        if (!d.selector || d.status === 'APPLIED') continue;
        const elements = document.querySelectorAll(d.selector);
        for (const el of elements) {
          if (!(el instanceof HTMLElement)) continue;

          // Remove original classes
          for (const orig of d.originalClasses) {
            el.classList.remove(orig);
          }
          // Add replacement classes
          for (const repl of d.replacementClasses) {
            if (repl.includes('=')) {
              // Attribute patch (e.g. alt="..." or aria-label="...")
              const [attr, val] = repl.split('=');
              if (attr && val) {
                el.setAttribute(attr.trim(), val.replace(/^["']|["']$/g, ''));
              }
            } else {
              el.classList.add(repl);
            }
          }
        }
      }
    }, patches);

    // 3. Snapshot After
    await this.pool.captureViewportScreenshot(page, outputPathAfter);

    return {
      beforeScreenshotPath: outputPathBefore,
      afterScreenshotPath: outputPathAfter,
    };
  }

  /**
   * Disposes the underlying browser pool.
   */
  public async dispose(): Promise<void> {
    await this.pool.close();
  }
}
