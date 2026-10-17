#!/usr/bin/env node
/**
 * @omnistack/cli
 * Production Developer CLI Suite for OmniStack Forge
 * Usage: omnistack <command> [options]
 */

import * as fs from 'node:fs';
import * as path from 'node:path';
import { parseArgs } from 'node:util';
import { executeSelfHealingPipeline } from '@omnistack/scaffolder-core';
import { extractComponentMetadata, generateMockProps } from '@omnistack/ast-engine';
import { parseCssColor, evaluateContrast, solveContrastViolation } from '@omnistack/vision-auditor';
import { createPairingSession, generateTerminalQRCode } from '@omnistack/github-bridge';
import { compileComponentMDX } from '@omnistack/docgen-renderer';
import { getDatabase, ProjectsRepository, InventoryRepository, OrdersRepository } from '@omnistack/db';
import { TEMPLATES_CATALOG, searchTemplates } from '@omnistack/templates';

export const CLI_VERSION = '1.4.0';

function printBanner(): void {
  console.log(`\x1b[36m\x1b[1m
   ____                  _ ____  _             _      _____                   
  / __ \\                (_) ___|| |           | |    |  ___|                  
 | |  | |_ __ ___  _ __  _\\___ \\| |_ __ _  ___| | __ | |_ ___  _ __ __ _  ___ 
 | |  | | '_ \` _ \\| '_ \\| |___) | __/ _\` |/ __| |/ / |  _/ _ \\| '__/ _\` |/ _ \\
 | |__| | | | | | | | | | |____/| || (_| | (__|   <  | || (_) | | | (_| |  __/
  \\____/|_| |_| |_|_| |_|_|      \\__\\__,_|\\___|_|\\_\\ \\_| \\___/|_|  \\__, |\\___|
                                                                    __/ |     
                                                                   |___/      
\x1b[0m\x1b[32m  Autonomous Full-Stack Software Factory & Studio CLI v${CLI_VERSION}\x1b[0m\n`);
}

function printHelp(): void {
  printBanner();
  console.log(`\x1b[1mCOMMANDS:\x1b[0m
  \x1b[33minit\x1b[0m <projectName>        Scaffold a new project with closed-loop self-healing verification
      \x1b[36m--template, -t <id>\x1b[0m    Template ID (e.g., cybermech_01, botanica_01, kicksvault_01)
      \x1b[36m--prompt, -p <text>\x1b[0m    Natural language project description
      \x1b[36m--output, -o <dir>\x1b[0m     Output directory for the generated project archive

  \x1b[33maudit\x1b[0m <url | colorPair>   Run visual & WCAG contrast audit on live URL or CSS color pair
      \x1b[36m--fg <color>\x1b[0m           Foreground text color (e.g. #6b7280)
      \x1b[36m--bg <color>\x1b[0m           Background surface color (e.g. #000000)
      \x1b[36m--fix\x1b[0m                  Auto-solve contrast violation and propose nearest Tailwind token

  \x1b[33mdocgen\x1b[0m <filePath>         Introspect component AST, extract props, and compile living MDX docs
      \x1b[36m--output, -o <dir>\x1b[0m     Output markdown file or directory

  \x1b[33mpair\x1b[0m                      Generate ephemeral terminal QR code for PR Tinder mobile pairing
      \x1b[36m--port, -p <port>\x1b[0m      Port of the active gateway server (default: 4000)

  \x1b[33mtemplates\x1b[0m [query]         Search and browse through the 100+ niche templates catalog

  \x1b[33mdb\x1b[0m                       Display SQLite persistence telemetry, projects, and inventory stats

  \x1b[33mhelp\x1b[0m                      Show this command reference
  \x1b[33mversion\x1b[0m                   Print CLI version
`);
}

async function handleInit(args: string[]): Promise<void> {
  const { values, positionals } = parseArgs({
    args,
    options: {
      template: { type: 'string', short: 't' },
      prompt: { type: 'string', short: 'p' },
      output: { type: 'string', short: 'o' },
    },
    allowPositionals: true,
  });

  const projectName = positionals[0] ?? 'OmniStackApp';
  const templateId = values.template ?? 'cybermech_01';
  const prompt = values.prompt ?? `Autonomous full-stack e-commerce store for ${projectName}`;
  const outDir = values.output ?? path.join(process.cwd(), 'dist', 'projects');

  console.log(`\x1b[34m[SCMD]\x1b[0m Initializing project: \x1b[1m${projectName}\x1b[0m`);
  console.log(`\x1b[34m[SCMD]\x1b[0m Template: ${templateId} | Target Dir: ${outDir}`);

  const result = await executeSelfHealingPipeline({
    projectName,
    prompt,
    templateId,
    runVisionAudit: true,
  });

  if (!fs.existsSync(outDir)) {
    fs.mkdirSync(outDir, { recursive: true });
  }

  const zipPath = path.join(outDir, `${projectName.toLowerCase().replace(/[^a-z0-9]+/g, '-')}.zip`);
  fs.writeFileSync(zipPath, result.artifactZipBuffer);

  console.log(`\n\x1b[32m✔ SUCCESS:\x1b[0m Scaffolding completed in closed-loop self-healing pipeline!`);
  console.log(`  ➜ Project ID:      ${result.projectId}`);
  console.log(`  ➜ Artifact ZIP:    ${zipPath} (${result.zipSizeBytes} bytes)`);
  console.log(`  ➜ Verified Files:  ${result.fileCount} source files`);
  console.log(`  ➜ Self-Healing:    ${result.auditReport.status} (${result.appliedPatches.length} patches applied)`);
  if (result.appliedPatches.length > 0) {
    result.appliedPatches.forEach(p => console.log(`     • ${p}`));
  }
}

async function handleAudit(args: string[]): Promise<void> {
  const { values, positionals } = parseArgs({
    args,
    options: {
      fg: { type: 'string' },
      bg: { type: 'string' },
      fix: { type: 'boolean', default: false },
    },
    allowPositionals: true,
  });

  const fg = values.fg ?? positionals[0] ?? '#6b7280';
  const bg = values.bg ?? positionals[1] ?? '#000000';

  console.log(`\x1b[34m[VISION]\x1b[0m Evaluating relative luminance contrast...`);
  console.log(`  Foreground: ${fg}`);
  console.log(`  Background: ${bg}`);

  const fgRgb = parseCssColor(fg);
  const bgRgb = parseCssColor(bg);
  const { ratio, passesAA, passesAAA } = evaluateContrast(fgRgb, bgRgb);

  console.log(`\n\x1b[1mCONTRAST SCORE:\x1b[0m ${ratio.toFixed(2)}:1`);
  console.log(`  WCAG AA (4.5:1):  ${passesAA ? '\x1b[32mPASS\x1b[0m' : '\x1b[31mFAIL (Violation)\x1b[0m'}`);
  console.log(`  WCAG AAA (7.0:1): ${passesAAA ? '\x1b[32mPASS\x1b[0m' : '\x1b[33mFAIL\x1b[0m'}`);

  if (!passesAA || values.fix) {
    const suggestion = solveContrastViolation({
      foreground: fg,
      background: bg,
      targetRatio: 4.5,
      property: 'text',
    });
    if (suggestion) {
      console.log(`\n\x1b[32m✔ AUTO-HEALING REMEDIATION (OKLab Space):\x1b[0m`);
      console.log(`  Suggested Token:     \x1b[36m${suggestion.replacementClass}\x1b[0m`);
      console.log(`  Remediated Ratio:    \x1b[1m${suggestion.resolvedContrastRatio.toFixed(2)}:1\x1b[0m`);
      console.log(`  Perceptual Delta E:  ${suggestion.deltaE.toFixed(3)}`);
    }
  }
}

async function handleDocgen(args: string[]): Promise<void> {
  const { positionals } = parseArgs({
    args,
    options: {},
    allowPositionals: true,
  });

  const targetFile = positionals[0];
  if (!targetFile || !fs.existsSync(targetFile)) {
    console.error(`\x1b[31mError:\x1b[0m File not found: "${targetFile}"`);
    process.exit(1);
  }

  const sourceCode = fs.readFileSync(targetFile, 'utf-8');
  const metadata = extractComponentMetadata(targetFile, sourceCode);
  const mockProps = generateMockProps(metadata.propsSchema, { seed: 1337 });
  const mdx = compileComponentMDX(metadata, mockProps);

  console.log(mdx);
}

async function handlePair(args: string[]): Promise<void> {
  const { values } = parseArgs({
    args,
    options: {
      port: { type: 'string', short: 'p', default: '4000' },
    },
    allowPositionals: true,
  });

  const port = parseInt(values.port ?? '4000', 10);
  const session = createPairingSession({
    projectId: 'omnistack-studio',
    prNumber: 1,
    wsUrl: `ws://localhost:${port}/api/v1/mobile-review`,
  });

  console.log(`\x1b[32m\x1b[1m⚡ Ephemeral Terminal Pairing Active!\x1b[0m`);
  console.log(`Session ID: ${session.sessionId}`);
  console.log(`Scan the QR code below using your mobile device:\n`);

  const qrTerminal = await generateTerminalQRCode(session.pairingUrl, { small: true });
  console.log(qrTerminal);
  console.log(`URL: \x1b[36m${session.pairingUrl}\x1b[0m\n`);
}

function handleTemplates(args: string[]): void {
  const query = args[0] ?? '';
  const results = query ? searchTemplates(query) : TEMPLATES_CATALOG;

  console.log(`\x1b[36m\x1b[1mTemplates Catalog (${results.length} found):\x1b[0m\n`);
  results.slice(0, 15).forEach((t, i) => {
    console.log(`  ${(i + 1).toString().padStart(2, ' ')}. \x1b[1m${t.name}\x1b[0m [\x1b[33m${t.id}\x1b[0m] (${t.niche})`);
    console.log(`      Tagline: ${t.tagline}`);
    console.log(`      Tokens:  bg=${t.tokens.bg} | primary=${t.tokens.primary}`);
  });

  if (results.length > 15) {
    console.log(`\n  ... and ${results.length - 15} more templates. Use specific query: omnistack templates <query>`);
  }
}

function handleDb(): void {
  const db = getDatabase();
  const projRepo = new ProjectsRepository(db);
  const invRepo = new InventoryRepository(db);
  const ordRepo = new OrdersRepository(db);

  const projects = projRepo.list(10);
  const products = invRepo.listProducts();
  const coupons = invRepo.listCoupons();
  const orders = ordRepo.list(10);

  console.log(`\x1b[36m\x1b[1mOmniStack SQLite Database Telemetry:\x1b[0m`);
  console.log(`  Database File:  ${db.dbPath}`);
  console.log(`  Total Projects: ${projects.length}`);
  console.log(`  Catalog Items:  ${products.length} products`);
  console.log(`  Active Coupons: ${coupons.length} coupons`);
  console.log(`  Orders Logged:  ${orders.length} orders`);

  if (projects.length > 0) {
    console.log(`\n\x1b[1mRecent Projects:\x1b[0m`);
    projects.forEach(p => console.log(`  • ${p.name} (${p.status}) - slug: ${p.slug}`));
  }
}

export async function runCLI(rawArgs: string[] = process.argv.slice(2)): Promise<void> {
  const command = rawArgs[0];
  const restArgs = rawArgs.slice(1);

  if (!command || command === 'help' || command === '--help' || command === '-h') {
    printHelp();
    return;
  }

  if (command === 'version' || command === '--version' || command === '-v') {
    console.log(`OmniStack Forge CLI v${CLI_VERSION}`);
    return;
  }

  switch (command) {
    case 'init':
      await handleInit(restArgs);
      break;
    case 'audit':
      await handleAudit(restArgs);
      break;
    case 'docgen':
      await handleDocgen(restArgs);
      break;
    case 'pair':
      await handlePair(restArgs);
      break;
    case 'templates':
      handleTemplates(restArgs);
      break;
    case 'db':
      handleDb();
      break;
    default:
      console.error(`\x1b[31mUnknown command:\x1b[0m "${command}". Run \x1b[36momnistack help\x1b[0m for available commands.`);
      process.exit(1);
  }
}

const isDirectRun = process.argv[1]?.includes('cli') && (process.argv[1]?.endsWith('.js') || process.argv[1]?.endsWith('.ts'));
if (isDirectRun) {
  runCLI().catch(err => {
    console.error('\x1b[31mFatal CLI Error:\x1b[0m', err);
    process.exit(1);
  });
}
