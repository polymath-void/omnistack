import fs from 'node:fs';
import { execSync } from 'node:child_process';
import puppeteer, { type Browser, type Page } from 'puppeteer';
import type { ViewportDimension, ViewportKind } from '@omnistack/types';

/**
 * Deterministic standard viewport profiles as specified in OmniStack Forge Blueprint:
 * - Mobile Portrait: 390x844 @ 3.0x (iPhone 14/15/16 layout)
 * - Tablet Portrait: 768x1024 @ 2.0x (iPad / Tablet grid collapse)
 * - Desktop Full: 1440x900 @ 1.0x (Standard widescreen density)
 */
export const VIEWPORT_PROFILES: Record<ViewportKind, ViewportDimension> = {
  mobile: { viewport: 'mobile', width: 390, height: 844, deviceScaleFactor: 3.0 },
  tablet: { viewport: 'tablet', width: 768, height: 1024, deviceScaleFactor: 2.0 },
  desktop: { viewport: 'desktop', width: 1440, height: 900, deviceScaleFactor: 1.0 },
};

export interface BrowserPoolConfig {
  executablePath?: string;
  headless?: boolean | 'shell';
  defaultTimeoutMs?: number;
  maxRetries?: number;
}

/**
 * Resolves Chrome or Edge executable across OS platforms.
 */
export function resolveBrowserExecutablePath(): string | undefined {
  if (process.env.PUPPETEER_EXECUTABLE_PATH) {
    return process.env.PUPPETEER_EXECUTABLE_PATH;
  }
  if (process.env.CHROME_PATH) {
    return process.env.CHROME_PATH;
  }

  if (process.platform === 'win32') {
    const candidates = [
      'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe',
      'C:\\Program Files (x86)\\Google\\Chrome\\Application\\chrome.exe',
      'C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe',
      'C:\\Program Files\\Microsoft\\Edge\\Application\\msedge.exe',
    ];
    for (const p of candidates) {
      if (fs.existsSync(p)) return p;
    }
  } else if (process.platform === 'darwin') {
    const candidates = [
      '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',
      '/Applications/Microsoft Edge.app/Contents/MacOS/Microsoft Edge',
      '/Applications/Chromium.app/Contents/MacOS/Chromium',
    ];
    for (const p of candidates) {
      if (fs.existsSync(p)) return p;
    }
  } else {
    const candidates = [
      '/usr/bin/google-chrome',
      '/usr/bin/google-chrome-stable',
      '/usr/bin/chromium',
      '/usr/bin/chromium-browser',
    ];
    for (const p of candidates) {
      if (fs.existsSync(p)) return p;
    }
  }

  return undefined;
}

/**
 * BrowserPool:
 * Resource-governed single-instance headless Chromium manager complying with
 * D:\Projects\OmniStack\CPU_RESOURCE_GOVERNANCE.md (Rule 2).
 *
 * Guarantees:
 * 1. Strict single-browser / single-page concurrency mutex.
 * 2. Aggressive PID reaping and exit hooks to prevent orphaned processes.
 * 3. Low-overhead launch arguments (--disable-gpu, --single-process, --no-zygote).
 */
export class BrowserPool {
  private static instance: BrowserPool | null = null;
  private browser: Browser | null = null;
  private activePage: Page | null = null;
  private browserPid: number | null = null;
  private config: BrowserPoolConfig;
  private queue: Promise<void> = Promise.resolve();
  private isShuttingDown = false;

  private constructor(config: BrowserPoolConfig = {}) {
    this.config = {
      defaultTimeoutMs: 30000,
      headless: true,
      ...config,
    };

    this.registerProcessHandlers();
  }

  public static getInstance(config?: BrowserPoolConfig): BrowserPool {
    if (!BrowserPool.instance) {
      BrowserPool.instance = new BrowserPool(config);
    }
    return BrowserPool.instance;
  }

  /**
   * Register system signals to guarantee process reaping.
   */
  private registerProcessHandlers(): void {
    const cleanup = () => {
      this.reapProcessSync();
    };

    process.once('exit', cleanup);
    process.once('SIGINT', cleanup);
    process.once('SIGTERM', cleanup);
    process.once('beforeExit', cleanup);
  }

  /**
   * Acquire a lock to ensure sequential single-page execution.
   */
  private async acquireLock<T>(fn: () => Promise<T>): Promise<T> {
    let releaseLock: () => void = () => {};
    const lockWait = new Promise<void>((resolve) => {
      releaseLock = resolve;
    });

    const previousQueue = this.queue;
    this.queue = (async () => {
      await previousQueue;
      await lockWait;
    })();

    await previousQueue;
    try {
      return await fn();
    } finally {
      releaseLock();
    }
  }

  /**
   * Launches or returns the single active browser instance.
   */
  public async getBrowser(): Promise<Browser> {
    if (this.isShuttingDown) {
      throw new Error('BrowserPool is shutting down.');
    }

    if (this.browser && this.browser.connected) {
      return this.browser;
    }

    // If an old browser instance lost connection, reap it
    if (this.browser) {
      await this.closeBrowser();
    }

    const resolvedExecutable = this.config.executablePath ?? resolveBrowserExecutablePath();

    const launchArgs: string[] = [
      '--no-sandbox',
      '--disable-setuid-sandbox',
      '--disable-gpu',
      '--disable-dev-shm-usage',
      '--disable-software-rasterizer',
      '--disable-extensions',
      '--single-process',
      '--no-zygote',
      '--disable-background-networking',
      '--disable-default-apps',
      '--disable-sync',
      '--disable-translate',
      '--metrics-recording-only',
      '--mute-audio',
      '--no-first-run',
      '--safebrowsing-disable-auto-update',
    ];

    const launchOptions: {
      headless: boolean | 'shell';
      args: string[];
      executablePath?: string;
    } = {
      headless: this.config.headless ?? true,
      args: launchArgs,
    };

    if (resolvedExecutable) {
      launchOptions.executablePath = resolvedExecutable;
    }

    const browser = await puppeteer.launch(launchOptions);

    const proc = browser.process();
    this.browserPid = proc?.pid ?? null;
    this.browser = browser;

    browser.once('disconnected', () => {
      this.browser = null;
      this.activePage = null;
      this.browserPid = null;
    });

    return browser;
  }

  /**
   * Executes an action on a freshly created and configured Page.
   * Guarantees strict try/finally cleanup so activePage is closed immediately.
   */
  public async withPage<T>(
    viewport: ViewportKind | ViewportDimension,
    action: (page: Page) => Promise<T>
  ): Promise<T> {
    return this.acquireLock(async () => {
      const browser = await this.getBrowser();

      // Ensure no dangling page exists before creating a new one
      if (this.activePage && !this.activePage.isClosed()) {
        try {
          await this.activePage.close();
        } catch {
          // ignore already closed
        }
        this.activePage = null;
      }

      const page = await browser.newPage();
      this.activePage = page;

      try {
        const dim: ViewportDimension =
          typeof viewport === 'string' ? VIEWPORT_PROFILES[viewport] : viewport;

        await page.setViewport({
          width: dim.width,
          height: dim.height,
          deviceScaleFactor: dim.deviceScaleFactor,
          isMobile: dim.viewport === 'mobile',
          hasTouch: dim.viewport === 'mobile',
        });

        if (this.config.defaultTimeoutMs) {
          page.setDefaultTimeout(this.config.defaultTimeoutMs);
        }

        return await action(page);
      } finally {
        if (!page.isClosed()) {
          try {
            await page.close();
          } catch {
            // ignore
          }
        }
        this.activePage = null;
      }
    });
  }

  /**
   * Takes a high-fidelity viewport screenshot.
   */
  public async captureViewportScreenshot(
    page: Page,
    outputPath?: string
  ): Promise<Uint8Array> {
    const screenshotBuffer = await page.screenshot({
      type: 'png',
      fullPage: false,
    });

    if (outputPath) {
      await fs.promises.writeFile(outputPath, screenshotBuffer);
    }

    return screenshotBuffer;
  }

  /**
   * Gracefully close page and browser.
   */
  public async close(): Promise<void> {
    this.isShuttingDown = true;
    await this.closeBrowser();
  }

  private async closeBrowser(): Promise<void> {
    if (this.activePage && !this.activePage.isClosed()) {
      try {
        await this.activePage.close();
      } catch {
        // ignore
      }
      this.activePage = null;
    }

    if (this.browser) {
      try {
        await this.browser.close();
      } catch {
        this.reapProcessSync();
      }
      this.browser = null;
    }

    this.browserPid = null;
  }

  /**
   * Forceful PID reaping for emergency exit handling or uncooperative processes.
   */
  public reapProcessSync(): void {
    if (!this.browserPid) return;

    const pid = this.browserPid;
    this.browserPid = null;
    this.browser = null;
    this.activePage = null;

    try {
      if (process.platform === 'win32') {
        execSync(`taskkill /F /T /PID ${pid} >nul 2>&1`);
      } else {
        process.kill(pid, 'SIGKILL');
      }
    } catch {
      // Process might already be dead
    }
  }

  public getActivePid(): number | null {
    return this.browserPid;
  }
}
