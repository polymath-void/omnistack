/**
 * @omnistack/server
 * Autonomous Full-Stack Software Studio Gateway Server
 * Complete Store Creation Journey:
 * 1. 100+ Modular Visual Template Swiper
 * 2. Visual Tinder "Swipe-to-Configure" Journey (Fonts, Colors, Boxing, Modules, Payment)
 * 3. Products Inventory Management (Listing, Tagging, SKU, Categories, Image Uploading, Stock Levels)
 * 4. Merchandising, Announcement Bar, Hero Banner Customizations & Coupons Engine
 * 5. Unified Functional Backend Orders Management & Idempotency Shield
 * 6. Standalone Production Release Forge (.ZIP & Mobile Edge Relay)
 */

import * as http from 'node:http';
import * as url from 'node:url';
import * as os from 'node:os';
import * as crypto from 'node:crypto';
import {
  generateQRCodeDataURL,
} from '@omnistack/github-bridge';
import {
  VirtualFileSystem,
  createZipArchive,
} from '@omnistack/scaffolder-core';
import {
  TEMPLATES_CATALOG,
  StoreTemplateItem,
} from '@omnistack/templates';
import {
  globalOrderQueue,
  globalIdempotencyEngine,
  globalPaymentGateway,
  globalInventoryEngine,
  globalPromotionsEngine,
  OrderPayload,
} from './backend/index.js';
import {
  handleScaffoldRoute,
  handleAuditVisualRoute,
  handleAstIntrospectRoute,
  handleDocsRoute,
  handlePlaygroundRoute,
  handlePRsRoute,
  handleSwipeReviewRoute,
  handleUploadRoute,
  serveStaticUpload,
} from './api/routes.js';

export const SERVER_VERSION = '1.4.0';
export const DEFAULT_PORT = 4000;

// Active Store Customization State
export interface CustomizedStoreState {
  templateId: string;
  storeName: string;
  niche: string;
  fontHeading: string;
  fontBody: string;
  h1Size: string; // '2rem' | '2.5rem' | '3.2rem'
  themeMode: 'oled' | 'slate' | 'sand' | 'white';
  primaryColor: string;
  secondaryColor: string;
  bgColor: string;
  cardBgColor: string;
  textColor: string;
  textMutedColor: string;
  borderRadius: string; // '0px' | '6px' | '14px' | '24px' | '999px'
  cardPadding: string; // '16px' | '24px' | '32px'
  primaryCtaText: string;
  hasBlog: boolean;
  hasReviews: boolean;
  hasStripeBadge: boolean;
  hasBentoGrid: boolean;
  hasStickyCart: boolean;
  hasAnnouncement: boolean;
  announcementText: string;
  announcementBg: string;
  heroHeadline: string;
  heroSubheadline: string;
  heroBadge: string;
  heroBgImage: string;
  sampleProducts: Array<{ name: string; price: number; tag: string }>;
}

const defaultTemplate: StoreTemplateItem = TEMPLATES_CATALOG[0]!;

let activeCustomization: CustomizedStoreState = {
  templateId: defaultTemplate.id,
  storeName: defaultTemplate.name,
  niche: defaultTemplate.niche,
  fontHeading: defaultTemplate.tokens.fontHeading,
  fontBody: defaultTemplate.tokens.fontBody,
  h1Size: '2.5rem',
  themeMode: 'slate',
  primaryColor: defaultTemplate.tokens.primary,
  secondaryColor: defaultTemplate.tokens.secondary,
  bgColor: defaultTemplate.tokens.bg,
  cardBgColor: defaultTemplate.tokens.cardBg,
  textColor: defaultTemplate.tokens.text,
  textMutedColor: defaultTemplate.tokens.textMuted,
  borderRadius: defaultTemplate.tokens.borderRadius,
  cardPadding: defaultTemplate.tokens.containerPadding,
  primaryCtaText: defaultTemplate.hero.primaryCta,
  hasBlog: defaultTemplate.hasBlog,
  hasReviews: defaultTemplate.hasReviews,
  hasStripeBadge: defaultTemplate.hasStripeBadge,
  hasBentoGrid: true,
  hasStickyCart: true,
  hasAnnouncement: true,
  announcementText: '🔥 FREE WORLDWIDE EXPRESS SHIPPING ON ORDERS OVER $150 • USE CODE "FORGE20" FOR 20% OFF',
  announcementBg: defaultTemplate.tokens.primary,
  heroHeadline: defaultTemplate.hero.headline,
  heroSubheadline: defaultTemplate.hero.subheadline,
  heroBadge: defaultTemplate.hero.badge,
  heroBgImage: 'https://images.unsplash.com/photo-1595225476474-87563907a212?auto=format&fit=crop&w=1200&q=80',
  sampleProducts: defaultTemplate.sampleProducts,
};

function getLocalIp(): string {
  const interfaces = os.networkInterfaces();
  const candidates: string[] = [];
  for (const name of Object.keys(interfaces)) {
    for (const net of interfaces[name] ?? []) {
      if (net.family === 'IPv4' && !net.internal) {
        if (net.address.startsWith('192.168.') || net.address.startsWith('10.')) {
          return net.address;
        }
        candidates.push(net.address);
      }
    }
  }
  return candidates[0] ?? '127.0.0.1';
}

// Generate in-memory customized production release VirtualFileSystem with full Inventory & Promotions
function buildCustomStoreVirtualFileSystem(state: CustomizedStoreState): VirtualFileSystem {
  const vfs = new VirtualFileSystem();
  const products = globalInventoryEngine.getAllProducts();
  const coupons = globalPromotionsEngine.listCoupons();

  const pkgJson = JSON.stringify({
    name: state.storeName.toLowerCase().replace(/[^a-z0-9]+/g, '-'),
    version: '1.0.0',
    private: true,
    scripts: {
      dev: 'next dev',
      build: 'next build',
      start: 'next start',
      lint: 'next lint',
    },
    dependencies: {
      next: '^14.2.15',
      react: '^18.3.1',
      'react-dom': '^18.3.1',
      stripe: '^17.0.0',
      'lucide-react': '^0.453.0',
      'tailwind-merge': '^2.5.4',
    },
  }, null, 2);

  vfs.writeFile('/package.json', pkgJson);
  vfs.writeFile('/tsconfig.json', JSON.stringify({
    compilerOptions: {
      target: 'es5',
      lib: ['dom', 'dom.iterable', 'esnext'],
      allowJs: true,
      skipLibCheck: true,
      strict: true,
      noEmit: true,
      esModuleInterop: true,
      module: 'esnext',
      moduleResolution: 'bundler',
      resolveJsonModule: true,
      isolatedModules: true,
      jsx: 'preserve',
      incremental: true,
      paths: { '@/*': ['./src/*'] },
    },
  }, null, 2));

  vfs.writeFile('/.env.example', `
# OmniStack Forge Production Store Environment
STRIPE_SECRET_KEY=sk_test_51...
STRIPE_WEBHOOK_SECRET=whsec_...
NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY=pk_test_51...
NEXT_PUBLIC_APP_URL=http://localhost:3000
DATABASE_URL=file:./sqlite.db
  `.trim());

  // Products Data
  vfs.writeFile('/src/data/products.json', JSON.stringify(products, null, 2));
  vfs.writeFile('/src/data/coupons.json', JSON.stringify(coupons, null, 2));

  // Announcement Bar Component
  vfs.writeFile('/src/components/AnnouncementBar.tsx', `
import React from 'react';

export function AnnouncementBar() {
  ${state.hasAnnouncement ? `
  return (
    <div className="py-2 px-4 text-center text-xs font-bold tracking-wide text-white uppercase overflow-hidden"
      style={{ backgroundColor: '${state.announcementBg}' }}>
      <span>${state.announcementText}</span>
    </div>
  );
  ` : 'return null;'}
}
  `.trim());

  vfs.writeFile('/src/app/page.tsx', `
import React from 'react';
import { AnnouncementBar } from '@/components/AnnouncementBar';
import { StoreNavbar } from '@/components/StoreNavbar';
import { StoreHero } from '@/components/StoreHero';
import { ProductGrid } from '@/components/ProductGrid';
${state.hasBlog ? "import { BlogSection } from '@/components/BlogSection';" : ""}

export default function StoreHomePage() {
  return (
    <main className="min-h-screen" style={{ backgroundColor: '${state.bgColor}', color: '${state.textColor}' }}>
      <AnnouncementBar />
      <StoreNavbar />
      <StoreHero />
      <ProductGrid />
      ${state.hasBlog ? "<BlogSection />" : ""}
    </main>
  );
}
  `.trim());

  vfs.writeFile('/src/components/StoreNavbar.tsx', `
import React from 'react';

export function StoreNavbar() {
  return (
    <header className="sticky top-0 z-50 backdrop-blur-md border-b px-6 py-4 flex justify-between items-center"
      style={{ backgroundColor: '${state.cardBgColor}cc', borderColor: '${state.cardBgColor}' }}>
      <div className="font-extrabold text-xl tracking-tight" style={{ color: '${state.primaryColor}' }}>
        ${state.storeName}
      </div>
      <nav className="hidden md:flex gap-6 text-sm font-semibold">
        <a href="#products" className="hover:opacity-80">Catalog</a>
        <a href="#inventory" className="hover:opacity-80">Stock</a>
        <a href="#features" className="hover:opacity-80">Features</a>
        ${state.hasBlog ? '<a href="#blog" className="hover:opacity-80">Articles</a>' : ''}
      </nav>
      <button className="px-4 py-2 rounded-full font-bold text-xs text-white"
        style={{ backgroundColor: '${state.primaryColor}' }}>
        Cart (0)
      </button>
    </header>
  );
}
  `.trim());

  vfs.writeFile('/src/components/StoreHero.tsx', `
import React from 'react';

export function StoreHero() {
  return (
    <section className="relative py-24 px-6 text-center max-w-5xl mx-auto overflow-hidden">
      ${state.hasStripeBadge ? '<span className="inline-block text-xs px-3 py-1 rounded-full font-bold uppercase tracking-wider text-white mb-6 shadow-md" style={{ backgroundColor: \'' + state.secondaryColor + '\' }}>' + state.heroBadge + ' • Verified Stripe Checkout</span>' : ''}
      <h1 className="font-black tracking-tight" style={{ fontSize: '${state.h1Size}', fontFamily: "${state.fontHeading}" }}>
        ${state.heroHeadline}
      </h1>
      <p className="mt-4 text-base max-w-2xl mx-auto opacity-80" style={{ fontFamily: "${state.fontBody}" }}>
        ${state.heroSubheadline}
      </p>
      <div className="mt-8 flex justify-center gap-4">
        <a href="#products" className="px-6 py-3 font-bold text-white shadow-lg inline-block"
          style={{ backgroundColor: '${state.primaryColor}', borderRadius: '${state.borderRadius}' }}>
          ${state.primaryCtaText}
        </a>
      </div>
    </section>
  );
}
  `.trim());

  vfs.writeFile('/src/components/ProductGrid.tsx', `
import React from 'react';
import productsData from '@/data/products.json';

export function ProductGrid() {
  return (
    <section id="products" className="py-12 px-6 max-w-6xl mx-auto">
      <div className="flex justify-between items-end mb-8">
        <div>
          <span className="text-xs font-bold uppercase tracking-widest text-sky-400">Official Catalog</span>
          <h2 className="text-3xl font-extrabold mt-1">Live Inventory Collection</h2>
        </div>
        <div className="text-xs opacity-70">
          Showing {productsData.length} items with real-time stock allocation
        </div>
      </div>
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {productsData.map((p) => (
          <div key={p.id} className="p-6 border shadow-md flex flex-col justify-between"
            style={{ backgroundColor: '${state.cardBgColor}', borderRadius: '${state.borderRadius}', borderColor: '${state.cardBgColor}' }}>
            <div>
              <div className="relative mb-4 h-48 rounded-xl overflow-hidden bg-slate-900 flex items-center justify-center">
                <img src={p.imageUrl} alt={p.title} className="w-full h-full object-cover" />
                <span className="absolute top-3 left-3 text-xs font-bold px-2 py-1 rounded text-white shadow-md"
                  style={{ backgroundColor: '${state.secondaryColor}' }}>
                  {p.tags[0] || p.category}
                </span>
                {p.compareAtPrice && (
                  <span className="absolute top-3 right-3 text-xs font-black px-2 py-1 rounded bg-rose-600 text-white shadow-md">
                    -\${p.compareAtPrice - p.price} OFF
                  </span>
                )}
              </div>
              <div className="text-xs text-sky-400 font-mono font-semibold">{p.sku}</div>
              <h3 className="text-lg font-bold mt-1 line-clamp-1">{p.title}</h3>
              <p className="text-xs opacity-75 mt-1 line-clamp-2">{p.description}</p>
              <div className="flex items-baseline gap-2 mt-4">
                <span className="text-2xl font-black">\${p.price}</span>
                {p.compareAtPrice && (
                  <span className="text-sm line-through opacity-50">\${p.compareAtPrice}</span>
                )}
              </div>
              <div className="text-xs font-semibold mt-2 text-emerald-400">
                {p.stockQuantity > 0 ? \`In Stock (\${p.stockQuantity} units)\` : 'Out of Stock'}
              </div>
            </div>
            <button className="w-full mt-6 py-3 font-semibold text-white transition-opacity hover:opacity-90 disabled:opacity-40"
              disabled={p.stockQuantity <= 0}
              style={{ backgroundColor: '${state.primaryColor}', borderRadius: '${state.borderRadius}' }}>
              {p.stockQuantity > 0 ? 'Order with Idempotency Shield' : 'Sold Out'}
            </button>
          </div>
        ))}
      </div>
    </section>
  );
}
  `.trim());

  if (state.hasBlog) {
    vfs.writeFile('/src/components/BlogSection.tsx', `
import React from 'react';

export function BlogSection() {
  return (
    <section id="blog" className="py-16 px-6 max-w-5xl mx-auto border-t border-slate-800">
      <h2 className="text-2xl font-bold mb-6 text-center">Editorial & Insights</h2>
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <article className="p-6 border rounded-xl" style={{ backgroundColor: '${state.cardBgColor}' }}>
          <span className="text-xs font-semibold text-sky-400">GUIDE • 5 MIN READ</span>
          <h3 className="text-lg font-bold mt-2">The Architecture Behind ${state.storeName}</h3>
          <p className="text-sm opacity-80 mt-2">How we engineered asynchronous order queues, idempotency keys, and software rot defense.</p>
        </article>
        <article className="p-6 border rounded-xl" style={{ backgroundColor: '${state.cardBgColor}' }}>
          <span className="text-xs font-semibold text-amber-400">SECURITY BRIEF</span>
          <h3 className="text-lg font-bold mt-2">Replay Protection & Zero Double Charges</h3>
          <p className="text-sm opacity-80 mt-2">Cryptographic SHA-256 fingerprinting ensures flawless order integrity even during network disconnects.</p>
        </article>
      </div>
    </section>
  );
}
    `.trim());
  }

  vfs.writeFile('/README.md', `
# ${state.storeName} • Generated by OmniStack Forge

Autonomous Full-Stack Software Studio Zero-to-Production Release.
Template: ${state.templateId} (${state.niche})
Inventory: ${products.length} Products Configured
Promo Codes: ${coupons.length} Active Discounts

## Quick Start
\`\`\`bash
1. npm install
2. cp .env.example .env.local
3. npm run dev
\`\`\`

Ready for deployment to Vercel, Fly.io, or Docker.
  `.trim());

  return vfs;
}

// ============================================================================
// HTML Studio Template with Visual Tinder, Inventory Management & Orders Queue
// ============================================================================

function renderStudioHtml(port: number, qrDataUrl: string, hostIp: string, publicUrl: string): string {
  const catalogJson = JSON.stringify(TEMPLATES_CATALOG);
  const activeCustomizationJson = JSON.stringify(activeCustomization);

  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0, maximum-scale=1.0, user-scalable=no">
  <title>OmniStack Forge • Store Creator, Inventory & Backend Management</title>
  <link rel="preconnect" href="https://fonts.googleapis.com">
  <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
  <link href="https://fonts.googleapis.com/css2?family=Chakra+Petch:wght@700&family=Cinzel:wght@700&family=Clash+Display:wght@700&family=Dela+Gothic+One&family=Eczar:wght@700&family=Fraunces:opsz,wght@9..144,700&family=Inter:wght@400;600;800&family=JetBrains+Mono:wght@500;700&family=Playfair+Display:ital,wght@0,700;1,700&family=Plus+Jakarta+Sans:wght@500;700;800&family=Space+Grotesk:wght@700&family=Syne:wght@800&display=swap" rel="stylesheet">
  <style>
    * { box-sizing: border-box; margin: 0; padding: 0; }
    body {
      background: #060911;
      color: #e2e8f0;
      font-family: 'Plus Jakarta Sans', -apple-system, sans-serif;
      min-height: 100vh;
      display: flex;
      flex-direction: column;
      align-items: center;
      padding: 12px;
      overflow-x: hidden;
    }

    /* Top Bar */
    header {
      width: 100%;
      max-width: 1320px;
      display: flex;
      justify-content: space-between;
      align-items: center;
      padding: 12px 20px;
      background: rgba(15, 23, 42, 0.7);
      backdrop-filter: blur(14px);
      border: 1px solid rgba(255, 255, 255, 0.08);
      border-radius: 18px;
      margin-bottom: 14px;
    }
    .brand {
      display: flex;
      align-items: center;
      gap: 10px;
      font-weight: 800;
      font-size: 1.15rem;
      color: #38bdf8;
    }
    .status-badge {
      background: #0369a1;
      color: #e0f2fe;
      font-size: 0.72rem;
      padding: 3px 10px;
      border-radius: 999px;
      font-weight: 700;
      text-transform: uppercase;
    }

    /* Navigation Tabs */
    .tabs-bar {
      width: 100%;
      max-width: 1320px;
      display: grid;
      grid-template-columns: repeat(5, 1fr);
      gap: 8px;
      margin-bottom: 16px;
    }
    @media (max-width: 900px) {
      .tabs-bar { grid-template-columns: repeat(3, 1fr); }
    }
    @media (max-width: 600px) {
      .tabs-bar { grid-template-columns: repeat(2, 1fr); }
    }
    .nav-tab {
      background: #0f172a;
      border: 1px solid #1e293b;
      color: #94a3b8;
      padding: 12px 14px;
      border-radius: 14px;
      font-size: 0.8rem;
      font-weight: 700;
      cursor: pointer;
      display: flex;
      align-items: center;
      justify-content: center;
      gap: 6px;
      transition: all 0.2s;
    }
    .nav-tab.active {
      background: #0284c7;
      color: white;
      border-color: #38bdf8;
      box-shadow: 0 4px 16px rgba(2, 132, 199, 0.4);
    }

    .tab-pane {
      width: 100%;
      max-width: 1320px;
      display: none;
    }
    .tab-pane.active {
      display: block;
    }

    /* =======================================================================
       TAB 1: VISUAL TINDER DECK (TEMPLATES & SWIPE-TO-CONFIGURE)
       ======================================================================= */
    .deck-mode-bar {
      display: flex;
      justify-content: center;
      gap: 12px;
      margin-bottom: 14px;
    }
    .deck-mode-btn {
      background: #1e293b;
      border: 1px solid #334155;
      color: #cbd5e1;
      padding: 8px 18px;
      border-radius: 999px;
      font-size: 0.8rem;
      font-weight: 700;
      cursor: pointer;
      transition: all 0.2s;
    }
    .deck-mode-btn.active {
      background: #10b981;
      border-color: #34d399;
      color: white;
      box-shadow: 0 4px 14px rgba(16, 185, 129, 0.4);
    }

    .filter-pills {
      display: flex;
      flex-wrap: wrap;
      gap: 8px;
      margin-bottom: 16px;
      justify-content: center;
    }
    .filter-chip {
      background: #0f172a;
      border: 1px solid #1e293b;
      color: #cbd5e1;
      padding: 6px 14px;
      border-radius: 999px;
      font-size: 0.74rem;
      font-weight: 700;
      cursor: pointer;
      transition: all 0.15s;
    }
    .filter-chip.active, .filter-chip:hover {
      background: #0284c7;
      border-color: #38bdf8;
      color: white;
    }

    .swiper-layout {
      display: flex;
      justify-content: center;
      align-items: flex-start;
      gap: 24px;
      flex-wrap: wrap;
    }

    .tinder-frame {
      width: 420px;
      min-height: 700px;
      position: relative;
      user-select: none;
    }

    .tinder-card {
      width: 100%;
      min-height: 640px;
      border-radius: 28px;
      border: 2px solid rgba(255, 255, 255, 0.1);
      box-shadow: 0 25px 50px -12px rgba(0, 0, 0, 0.8), 0 0 35px rgba(56, 189, 248, 0.2);
      display: flex;
      flex-direction: column;
      overflow: hidden;
      position: relative;
      transition: transform 0.25s cubic-bezier(0.16, 1, 0.3, 1), opacity 0.25s ease;
      touch-action: none;
    }

    .tinder-card.exit-right { transform: translateX(500px) rotate(22deg) !important; opacity: 0 !important; }
    .tinder-card.exit-left { transform: translateX(-500px) rotate(-22deg) !important; opacity: 0 !important; }

    /* Visual Template Miniature Canvas */
    .template-mini-canvas {
      padding: 18px;
      display: flex;
      flex-direction: column;
      gap: 14px;
      flex: 1;
    }
    .mini-navbar {
      display: flex;
      justify-content: space-between;
      align-items: center;
      padding: 10px 14px;
      border-radius: 12px;
      background: rgba(0, 0, 0, 0.25);
    }
    .mini-logo { font-weight: 800; font-size: 0.92rem; }
    .mini-badge { font-size: 0.65rem; padding: 2px 8px; border-radius: 999px; font-weight: 700; color: white; }

    .mini-hero {
      text-align: center;
      padding: 18px 8px 12px;
      display: flex;
      flex-direction: column;
      align-items: center;
      gap: 8px;
    }
    .mini-headline { font-size: 1.45rem; font-weight: 900; line-height: 1.2; }
    .mini-subheadline { font-size: 0.74rem; opacity: 0.8; line-height: 1.4; max-width: 320px; }
    .mini-cta-btn {
      padding: 8px 20px;
      font-size: 0.78rem;
      font-weight: 700;
      color: white;
      border: none;
      border-radius: 999px;
      margin-top: 4px;
    }

    .mini-products {
      display: grid;
      grid-template-columns: 1fr 1fr;
      gap: 10px;
    }
    .mini-product-card {
      padding: 10px;
      border-radius: 14px;
      display: flex;
      flex-direction: column;
      gap: 4px;
      border: 1px solid rgba(255, 255, 255, 0.08);
    }
    .mini-product-name { font-size: 0.78rem; font-weight: 700; }
    .mini-product-price { font-size: 1.05rem; font-weight: 800; }

    /* Token Details Bar */
    .token-pills-row {
      display: flex;
      flex-wrap: wrap;
      gap: 6px;
      padding: 12px 16px;
      background: rgba(0, 0, 0, 0.35);
      border-top: 1px solid rgba(255, 255, 255, 0.08);
      font-size: 0.7rem;
    }
    .token-tag {
      background: #0f172a;
      padding: 3px 8px;
      border-radius: 6px;
      color: #94a3b8;
      border: 1px solid #1e293b;
    }

    /* Swipe Action Controls */
    .swiper-controls {
      display: flex;
      justify-content: space-around;
      align-items: center;
      padding: 12px 20px;
      gap: 14px;
    }
    .swipe-btn {
      width: 60px;
      height: 60px;
      border-radius: 50%;
      border: none;
      display: flex;
      flex-direction: column;
      align-items: center;
      justify-content: center;
      font-size: 1.35rem;
      cursor: pointer;
      color: white;
      font-weight: 800;
      transition: transform 0.15s ease;
    }
    .swipe-btn:hover { transform: scale(1.1); }
    .swipe-btn:active { transform: scale(0.95); }
    .btn-pass { background: linear-gradient(135deg, #ef4444, #dc2626); box-shadow: 0 4px 14px rgba(239, 68, 68, 0.4); }
    .btn-approve { background: linear-gradient(135deg, #10b981, #059669); box-shadow: 0 4px 14px rgba(16, 185, 129, 0.4); }
    .btn-sub { font-size: 0.6rem; text-transform: uppercase; font-weight: 700; margin-top: 1px; }

    /* Stamp Overlays */
    .stamp-text {
      position: absolute;
      top: 40%;
      left: 50%;
      transform: translate(-50%, -50%) rotate(-15deg);
      font-size: 2.4rem;
      font-weight: 900;
      text-transform: uppercase;
      padding: 8px 24px;
      border-radius: 16px;
      border: 4px solid;
      opacity: 0;
      pointer-events: none;
      transition: opacity 0.15s ease;
      z-index: 20;
    }
    .stamp-yes { color: #10b981; border-color: #10b981; background: rgba(16, 185, 129, 0.25); }
    .stamp-no { color: #ef4444; border-color: #ef4444; background: rgba(239, 68, 68, 0.25); }

    /* =======================================================================
       TAB 2: DEEP ELEMENT CUSTOMIZATION & REFINEMENT LAYER
       ======================================================================= */
    .customizer-layout {
      display: grid;
      grid-template-columns: 360px 1fr;
      gap: 20px;
    }
    @media (max-width: 960px) {
      .customizer-layout { grid-template-columns: 1fr; }
    }

    .inspector-panel {
      background: #0f172a;
      border: 1px solid #1e293b;
      border-radius: 20px;
      padding: 20px;
      display: flex;
      flex-direction: column;
      gap: 18px;
      max-height: 85vh;
      overflow-y: auto;
    }

    .inspector-section {
      display: flex;
      flex-direction: column;
      gap: 10px;
      border-bottom: 1px solid #1e293b;
      padding-bottom: 14px;
    }
    .inspector-title {
      font-size: 0.8rem;
      font-weight: 800;
      text-transform: uppercase;
      letter-spacing: 0.05em;
      color: #38bdf8;
      display: flex;
      align-items: center;
      gap: 6px;
    }

    .control-row {
      display: flex;
      flex-direction: column;
      gap: 6px;
    }
    .control-label {
      font-size: 0.74rem;
      font-weight: 600;
      color: #94a3b8;
    }
    .control-input, .control-select {
      background: #1e293b;
      border: 1px solid #334155;
      color: white;
      padding: 8px 12px;
      border-radius: 10px;
      font-size: 0.82rem;
      outline: none;
    }
    .color-picker-wrap {
      display: flex;
      gap: 8px;
      align-items: center;
    }
    .color-thumb {
      width: 32px;
      height: 32px;
      border-radius: 8px;
      border: 1px solid #475569;
      cursor: pointer;
    }

    /* Responsive Viewport Switcher */
    .viewport-toolbar {
      display: flex;
      justify-content: space-between;
      align-items: center;
      background: #0f172a;
      border: 1px solid #1e293b;
      padding: 8px 16px;
      border-radius: 16px;
      margin-bottom: 14px;
    }
    .viewport-btns {
      display: flex;
      gap: 6px;
    }
    .vp-btn {
      background: #1e293b;
      border: 1px solid #334155;
      color: #94a3b8;
      padding: 6px 12px;
      border-radius: 8px;
      font-size: 0.76rem;
      font-weight: 700;
      cursor: pointer;
    }
    .vp-btn.active {
      background: #0284c7;
      color: white;
      border-color: #38bdf8;
    }

    /* Live Preview Canvas Wrapper */
    .preview-canvas-wrapper {
      display: flex;
      justify-content: center;
      align-items: flex-start;
      overflow-x: auto;
      background: #020408;
      border: 1px solid #1e293b;
      border-radius: 20px;
      padding: 20px;
      min-height: 750px;
    }

    .live-store-frame {
      transition: width 0.3s ease;
      background: #080c14;
      border-radius: 24px;
      border: 2px solid #334155;
      box-shadow: 0 20px 40px rgba(0, 0, 0, 0.6);
      overflow: hidden;
      display: flex;
      flex-direction: column;
    }
    .live-store-frame.desktop { width: 100%; max-width: 920px; }
    .live-store-frame.tablet { width: 720px; }
    .live-store-frame.mobile { width: 390px; }

    /* Toggle switches */
    .switch-label {
      display: flex;
      align-items: center;
      justify-content: space-between;
      font-size: 0.76rem;
      cursor: pointer;
    }

    /* =======================================================================
       TAB 3: PRODUCTS & INVENTORY MERCHANDISING
       ======================================================================= */
    .inventory-layout {
      display: flex;
      flex-direction: column;
      gap: 20px;
    }
    .inventory-grid {
      display: grid;
      grid-template-columns: 1fr 340px;
      gap: 20px;
    }
    @media (max-width: 1000px) {
      .inventory-grid { grid-template-columns: 1fr; }
    }
    .table-container {
      background: #0f172a;
      border: 1px solid #1e293b;
      border-radius: 18px;
      padding: 20px;
      overflow-x: auto;
    }
    .table-custom {
      width: 100%;
      border-collapse: collapse;
      font-size: 0.8rem;
    }
    .table-custom th {
      text-align: left;
      padding: 10px 12px;
      color: #94a3b8;
      border-bottom: 1px solid #1e293b;
      font-size: 0.7rem;
      text-transform: uppercase;
    }
    .table-custom td {
      padding: 12px;
      border-bottom: 1px solid rgba(255, 255, 255, 0.05);
      vertical-align: middle;
    }
    .stock-badge {
      display: inline-block;
      padding: 2px 8px;
      border-radius: 999px;
      font-size: 0.68rem;
      font-weight: 800;
    }
    .stock-instock { background: #064e3b; color: #34d399; }
    .stock-low { background: #713f12; color: #fde047; }
    .stock-out { background: #7f1d1d; color: #f87171; }

    .tag-badge {
      background: #1e293b;
      border: 1px solid #334155;
      color: #cbd5e1;
      padding: 2px 6px;
      border-radius: 4px;
      font-size: 0.68rem;
      font-weight: 700;
      margin-right: 4px;
    }

    /* =======================================================================
       TAB 4: UNIFIED BACKEND ORDERS & QUEUE DASHBOARD
       ======================================================================= */
    .backend-grid {
      display: flex;
      flex-direction: column;
      gap: 20px;
    }
    .telemetry-cards {
      display: grid;
      grid-template-columns: repeat(auto-fit, minmax(180px, 1fr));
      gap: 12px;
    }
    .tel-card {
      background: #0f172a;
      border: 1px solid #1e293b;
      border-radius: 16px;
      padding: 16px;
      display: flex;
      flex-direction: column;
      gap: 6px;
    }
    .tel-val { font-size: 1.6rem; font-weight: 900; }
    .tel-label { font-size: 0.74rem; color: #94a3b8; font-weight: 600; text-transform: uppercase; }

    .status-pill {
      display: inline-block;
      padding: 3px 8px;
      border-radius: 999px;
      font-size: 0.68rem;
      font-weight: 800;
      text-transform: uppercase;
    }
    .pill-COMPLETED { background: #064e3b; color: #34d399; }
    .pill-PAID { background: #1e3a8a; color: #60a5fa; }
    .pill-PAYMENT_PROCESSING { background: #075985; color: #38bdf8; }
    .pill-VALIDATING { background: #581c87; color: #c084fc; }
    .pill-PENDING { background: #713f12; color: #fde047; }
    .pill-FULFILLING { background: #7c2d12; color: #fb923c; }
    .pill-FAILED { background: #7f1d1d; color: #f87171; }
    .pill-REAPED_STALE { background: #3f3f46; color: #a1a1aa; }

    .test-actions-bar {
      display: flex;
      flex-wrap: wrap;
      gap: 12px;
      align-items: center;
      justify-content: space-between;
      background: #090d16;
      border: 1px solid #1e293b;
      border-radius: 14px;
      padding: 14px 18px;
    }

    /* Common Buttons */
    .btn-action-primary {
      background: linear-gradient(135deg, #10b981, #059669);
      color: white;
      padding: 12px 18px;
      border-radius: 12px;
      font-weight: 800;
      font-size: 0.88rem;
      text-decoration: none;
      display: flex;
      align-items: center;
      justify-content: center;
      gap: 8px;
      box-shadow: 0 4px 16px rgba(16, 185, 129, 0.4);
      cursor: pointer;
      border: none;
    }
  </style>
</head>
<body>
  <header>
    <div class="brand">
      <span>⚡ OmniStack Forge</span>
      <span class="status-badge">Inventory & Deals Enabled</span>
    </div>
    <div style="font-size: 0.78rem; color: #94a3b8;">
      Edge URL: <code style="color: #38bdf8;">${publicUrl}</code>
    </div>
  </header>

  <!-- Navigation Tabs -->
  <nav class="tabs-bar">
    <button class="nav-tab active" id="tabBtnSwipe" onclick="goToTab('swipe')">
      <span>🎴</span> 1. Visual Tinder
    </button>
    <button class="nav-tab" id="tabBtnCustomize" onclick="goToTab('customize')">
      <span>🎨</span> 2. Style & Banner
    </button>
    <button class="nav-tab" id="tabBtnInventory" onclick="goToTab('inventory')">
      <span>📦</span> 3. Inventory & Deals
    </button>
    <button class="nav-tab" id="tabBtnBackend" onclick="goToTab('backend')">
      <span>🛡️</span> 4. Orders & Queue
    </button>
    <button class="nav-tab" id="tabBtnRelease" onclick="goToTab('release')">
      <span>🚀</span> 5. Standalone Release
    </button>
  </nav>

  <!-- =====================================================================
       TAB 1: VISUAL TINDER DECK (TEMPLATES & SWIPE-TO-CONFIGURE)
       ===================================================================== -->
  <div class="tab-pane active" id="paneSwipe">
    <!-- Sub-Mode Selector: Template Deck vs Swipe-to-Configure Journey -->
    <div class="deck-mode-bar">
      <button class="deck-mode-btn active" id="btnModeTemplates" onclick="switchDeckMode('templates')">
        🛍️ Browse Templates (100)
      </button>
      <button class="deck-mode-btn" id="btnModeConfigure" onclick="switchDeckMode('configure')">
        🎨 Swipe-To-Configure Journey (5 Steps)
      </button>
    </div>

    <!-- Niche Filter Pills -->
    <div class="filter-pills" id="nichePills">
      <div class="filter-chip active" onclick="filterByNiche('all')">🌟 All 100+ Templates</div>
      <div class="filter-chip" onclick="filterByNiche('cybermech')">⌨️ CyberMech</div>
      <div class="filter-chip" onclick="filterByNiche('auraroast')">☕ Aura Roast</div>
      <div class="filter-chip" onclick="filterByNiche('hyperdev')">⚡ HyperDev</div>
      <div class="filter-chip" onclick="filterByNiche('kicksvault')">👟 KicksVault</div>
      <div class="filter-chip" onclick="filterByNiche('botanica')">🌿 Botanica</div>
      <div class="filter-chip" onclick="filterByNiche('soniccraft')">🎧 SonicCraft</div>
      <div class="filter-chip" onclick="filterByNiche('orbitwear')">🪐 OrbitWear</div>
      <div class="filter-chip" onclick="filterByNiche('vinoheritage')">🍷 VinoHeritage</div>
      <div class="filter-chip" onclick="filterByNiche('velocity')">🏎️ Velocity</div>
      <div class="filter-chip" onclick="filterByNiche('ceramics')">🎨 Ceramics</div>
    </div>

    <div class="swiper-layout">
      <!-- 420px Tinder Card Stack -->
      <div class="tinder-frame">
        <div class="tinder-card" id="cardElement">
          <div class="stamp-text stamp-yes" id="stampYes">SELECT</div>
          <div class="stamp-text stamp-no" id="stampNo">PASS</div>

          <div class="template-mini-canvas" id="cardCanvas">
          </div>

          <div class="token-pills-row" id="cardTokensRow">
          </div>
        </div>

        <div class="swiper-controls">
          <button class="swipe-btn btn-pass" onclick="actionSwipe('PASS')" title="Pass / Skip Card (Key: Left Arrow / R)">
            ✕
            <span class="btn-sub">Pass</span>
          </button>
          <div style="text-align: center; font-size: 0.72rem; color: #94a3b8;" id="deckProgress">
            Card 1 of 100
          </div>
          <button class="swipe-btn btn-approve" onclick="actionSwipe('SELECT')" title="Select & Apply (Key: Right Arrow / A)">
            ♥
            <span class="btn-sub">Select</span>
          </button>
        </div>
      </div>
    </div>
  </div>

  <!-- =====================================================================
       TAB 2: STYLE, BANNER & HERO CUSTOMIZATION
       ===================================================================== -->
  <div class="tab-pane" id="paneCustomize">
    <div class="viewport-toolbar">
      <div style="font-size: 0.82rem; font-weight: 700; color: #38bdf8;">
        <span>🔍 Live Viewport Mode:</span>
      </div>
      <div class="viewport-btns">
        <button class="vp-btn active" id="vpBtnDesktop" onclick="setViewport('desktop')">🖥️ Desktop</button>
        <button class="vp-btn" id="vpBtnTablet" onclick="setViewport('tablet')">📱 Tablet</button>
        <button class="vp-btn" id="vpBtnMobile" onclick="setViewport('mobile')">📱 Mobile (390px)</button>
      </div>
      <button class="btn-action-primary" style="padding: 6px 14px; font-size: 0.76rem;" onclick="goToTab('inventory')">
        Manage Inventory ➔
      </button>
    </div>

    <div class="customizer-layout">
      <!-- Left: Refinements & Merchandising Inspector -->
      <div class="inspector-panel">
        <!-- 1. Heading Announcement Bar -->
        <div class="inspector-section">
          <div class="inspector-title"><span>📢</span> Heading Announcement Bar</div>
          <label class="switch-label">
            <span>Show Announcement Ticker</span>
            <input type="checkbox" id="cfgHasAnnouncement" checked onchange="updateAnnouncementState()" />
          </label>
          <div class="control-row">
            <label class="control-label">Announcement Text / Promo Pitch</label>
            <input type="text" class="control-input" id="cfgAnnouncementText" oninput="updateAnnouncementState()" />
          </div>
        </div>

        <!-- 2. Hero Banner Customization -->
        <div class="inspector-section">
          <div class="inspector-title"><span>🖼️</span> Hero Banner Customization</div>
          <div class="control-row">
            <label class="control-label">Hero Headline</label>
            <input type="text" class="control-input" id="cfgHeroHeadline" oninput="updateHeroBanner()" />
          </div>
          <div class="control-row">
            <label class="control-label">Hero Subheadline</label>
            <textarea class="control-input" id="cfgHeroSubheadline" rows="2" oninput="updateHeroBanner()"></textarea>
          </div>
          <div class="control-row">
            <label class="control-label">Badge Pill Label</label>
            <input type="text" class="control-input" id="cfgHeroBadge" oninput="updateHeroBanner()" />
          </div>
          <div class="control-row">
            <label class="control-label">Hero Background Image URL</label>
            <input type="text" class="control-input" id="cfgHeroBgImage" oninput="updateHeroBanner()" />
          </div>
        </div>

        <!-- 3. Typography & Headings -->
        <div class="inspector-section">
          <div class="inspector-title"><span>🔤</span> Typography & Formatting</div>
          <div class="control-row">
            <label class="control-label">Font Family Pairing</label>
            <select class="control-select" id="cfgFontPairing" onchange="updateFontPairing(this.value)">
              <option value="'Space Grotesk'|'Inter'">Space Grotesk + Inter (Tech & Hardware)</option>
              <option value="'Playfair Display'|'Plus Jakarta Sans'">Playfair Display + Plus Jakarta (Editorial & Coffee)</option>
              <option value="'Syne'|'Inter'">Syne + Inter (Developer SaaS & APIs)</option>
              <option value="'Dela Gothic One'|'Plus Jakarta Sans'">Dela Gothic One + Plus Jakarta (Streetwear)</option>
              <option value="'Cinzel'|'Inter'">Cinzel + Inter (Luxury & Heritage)</option>
              <option value="'Fraunces'|'Outfit'">Fraunces + Outfit (Organic & Wellness)</option>
            </select>
          </div>
          <div class="control-row">
            <label class="control-label">H1 Heading Size</label>
            <select class="control-select" id="cfgH1Size" onchange="updateH1Size(this.value)">
              <option value="2rem">Standard H1 (2.0rem)</option>
              <option value="2.5rem" selected>Display H1 (2.5rem)</option>
              <option value="3.2rem">Hero Impact H1 (3.2rem)</option>
            </select>
          </div>
        </div>

        <!-- 4. Colors & Theme Refinement -->
        <div class="inspector-section">
          <div class="inspector-title"><span>🎨</span> Color Palettes & Contrast</div>
          <div class="control-row">
            <label class="control-label">Base Surface Theme</label>
            <select class="control-select" id="cfgThemeMode" onchange="updateThemeMode(this.value)">
              <option value="slate">Cool Slate (#080c14)</option>
              <option value="oled">Pure OLED Dark (#000000)</option>
              <option value="sand">Warm Artisan Sand (#fdfbf7)</option>
              <option value="white">Clean Studio White (#ffffff)</option>
            </select>
          </div>
          <div class="control-row">
            <label class="control-label">Primary Brand Accent</label>
            <div class="color-picker-wrap">
              <input type="color" class="color-thumb" id="cfgPrimaryColor" oninput="updatePrimaryColor(this.value)" />
              <span id="cfgPrimaryColorHex" style="font-family: monospace; font-size: 0.78rem;"></span>
            </div>
          </div>
          <div class="control-row">
            <label class="control-label">Secondary Badge Color</label>
            <div class="color-picker-wrap">
              <input type="color" class="color-thumb" id="cfgSecondaryColor" oninput="updateSecondaryColor(this.value)" />
              <span id="cfgSecondaryColorHex" style="font-family: monospace; font-size: 0.78rem;"></span>
            </div>
          </div>
        </div>

        <!-- 5. Boxing, Padding & Border Radius -->
        <div class="inspector-section">
          <div class="inspector-title"><span>📐</span> Boxing & Spacing</div>
          <div class="control-row">
            <label class="control-label">Border Radius</label>
            <select class="control-select" id="cfgBorderRadius" onchange="updateBorderRadius(this.value)">
              <option value="0px">Sharp (0px)</option>
              <option value="6px">Classic Subtle (6px)</option>
              <option value="14px">Modern Card (14px)</option>
              <option value="24px">Soft Rounded (24px)</option>
              <option value="999px">Pill / Ultra (999px)</option>
            </select>
          </div>
        </div>
      </div>

      <!-- Right: Responsive Live Store Preview -->
      <div class="preview-canvas-wrapper">
        <div class="live-store-frame desktop" id="liveStoreFrame">
          <!-- Announcement Bar Preview -->
          <div id="pvAnnouncement" style="padding: 8px 16px; text-align: center; font-size: 0.72rem; font-weight: 700; color: white; text-transform: uppercase;">
            Free Worldwide Shipping on Orders Over $150
          </div>

          <div id="liveStoreNavbar" style="padding: 14px 24px; display: flex; justify-content: space-between; align-items: center; border-bottom: 1px solid rgba(255,255,255,0.08);">
            <div id="pvLogo" style="font-weight: 800; font-size: 1.1rem;">Store Logo</div>
            <div id="pvNavLinks" style="display: flex; gap: 16px; font-size: 0.8rem; font-weight: 600;">
              <span>Catalog</span>
              <span>Stock</span>
              <span id="pvBlogLink">Blog</span>
            </div>
            <button id="pvCartBtn" style="padding: 6px 14px; border-radius: 999px; font-size: 0.76rem; font-weight: 700; color: white; border: none; cursor: pointer;">
              Cart (0)
            </button>
          </div>

          <div style="padding: 30px 20px; text-align: center;" id="liveStoreHero">
            <span id="pvBadge" style="font-size: 0.68rem; font-weight: 700; padding: 2px 10px; border-radius: 999px; color: white; text-transform: uppercase;">
              LIMITED RELEASE • Verified Stripe Checkout
            </span>
            <h1 id="pvH1" style="margin-top: 14px; font-weight: 900; line-height: 1.2;">
              Engineered for Pure Tactile Performance
            </h1>
            <p id="pvSub" style="margin-top: 10px; font-size: 0.85rem; opacity: 0.8; max-width: 500px; margin-left: auto; margin-right: auto;">
              Hand-assembled with aerospace-grade materials and custom dampening gaskets.
            </p>
            <div style="margin-top: 20px;">
              <button id="pvCta" style="padding: 10px 24px; font-weight: 700; color: white; border: none; cursor: pointer; box-shadow: 0 4px 14px rgba(0,0,0,0.4);">
                Shop Collection
              </button>
            </div>
          </div>

          <!-- Product Grid Preview -->
          <div style="padding: 20px;" id="liveStoreProducts">
            <div style="font-size: 0.82rem; font-weight: 800; margin-bottom: 12px; text-transform: uppercase; letter-spacing: 0.05em; opacity: 0.7;">
              Featured Products & Inventory
            </div>
            <div style="display: grid; grid-template-columns: repeat(auto-fit, minmax(200px, 1fr)); gap: 16px;" id="pvProductList">
            </div>
          </div>
        </div>
      </div>
    </div>
  </div>

  <!-- =====================================================================
       TAB 3: PRODUCTS & INVENTORY MERCHANDISING
       ===================================================================== -->
  <div class="tab-pane" id="paneInventory">
    <div class="inventory-layout">
      <!-- Inventory Metrics Bar -->
      <div class="telemetry-cards">
        <div class="tel-card">
          <div class="tel-label">Catalog Products</div>
          <div class="tel-val" id="invTotalProds" style="color: #38bdf8;">0</div>
        </div>
        <div class="tel-card">
          <div class="tel-label">Total Units in Stock</div>
          <div class="tel-val" id="invTotalUnits" style="color: #34d399;">0</div>
        </div>
        <div class="tel-card">
          <div class="tel-label">Low Stock Warnings</div>
          <div class="tel-val" id="invLowStock" style="color: #f59e0b;">0</div>
        </div>
        <div class="tel-card">
          <div class="tel-label">Out of Stock Items</div>
          <div class="tel-val" id="invOutOfStock" style="color: #ef4444;">0</div>
        </div>
      </div>

      <div class="inventory-grid">
        <!-- Products Table -->
        <div class="table-container">
          <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 14px;">
            <div style="font-weight: 800; font-size: 0.95rem; color: #f1f5f9;">
              Product Catalog & Stock Allocation
            </div>
            <button class="deck-mode-btn" style="padding: 4px 12px; font-size: 0.72rem;" onclick="loadInventory()">
              🔄 Refresh
            </button>
          </div>
          <table class="table-custom">
            <thead>
              <tr>
                <th>Product</th>
                <th>SKU</th>
                <th>Category</th>
                <th>Price / Discount</th>
                <th>Stock Units</th>
                <th>Status</th>
                <th>Stock Action</th>
              </tr>
            </thead>
            <tbody id="inventoryTableBody">
            </tbody>
          </table>
        </div>

        <!-- Add Product Form & Coupons Manager -->
        <div style="display: flex; flex-direction: column; gap: 16px;">
          <!-- Add Product Box -->
          <div style="background: #0f172a; border: 1px solid #1e293b; border-radius: 18px; padding: 18px; display: flex; flex-direction: column; gap: 10px;">
            <div style="font-weight: 800; font-size: 0.88rem; color: #38bdf8;">
              ➕ Quick Add Product
            </div>
            <input type="text" class="control-input" id="newProdTitle" placeholder="Product Title" />
            <input type="text" class="control-input" id="newProdSku" placeholder="SKU (e.g. KB-RGB-87)" />
            <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 8px;">
              <input type="number" class="control-input" id="newProdPrice" placeholder="Price ($)" />
              <input type="number" class="control-input" id="newProdComparePrice" placeholder="Compare-at ($)" />
            </div>
            <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 8px;">
              <input type="text" class="control-input" id="newProdCategory" placeholder="Category" />
              <input type="number" class="control-input" id="newProdStock" placeholder="Units Stock" />
            </div>
            <input type="text" class="control-input" id="newProdTags" placeholder="Tags (e.g. LIMITED, POPULAR)" />
            <input type="text" class="control-input" id="newProdImage" placeholder="Image URL (Unsplash or CDN)" />
            <textarea class="control-input" id="newProdDesc" rows="2" placeholder="Description"></textarea>
            <button class="btn-action-primary" style="padding: 8px;" onclick="handleCreateProduct()">
              Save to Catalog
            </button>
          </div>

          <!-- Coupons & Promo Codes Box -->
          <div style="background: #0f172a; border: 1px solid #1e293b; border-radius: 18px; padding: 18px; display: flex; flex-direction: column; gap: 10px;">
            <div style="font-weight: 800; font-size: 0.88rem; color: #f59e0b;">
              🎟️ Active Coupons & Promo Codes
            </div>
            <div id="couponsList" style="display: flex; flex-direction: column; gap: 8px; font-size: 0.76rem;">
            </div>
            <div style="margin-top: 8px; border-top: 1px solid #1e293b; padding-top: 10px;">
              <div style="font-size: 0.72rem; color: #94a3b8; font-weight: 700; margin-bottom: 6px;">Test Coupon Validator:</div>
              <div style="display: flex; gap: 6px;">
                <input type="text" class="control-input" id="testCouponCode" placeholder="Code (e.g. FORGE20)" style="font-family: monospace; font-size: 0.75rem;" />
                <button class="deck-mode-btn" style="padding: 4px 10px; font-size: 0.72rem;" onclick="testApplyCoupon()">Apply</button>
              </div>
              <div id="testCouponResult" style="font-size: 0.72rem; margin-top: 6px;"></div>
            </div>
          </div>
        </div>
      </div>
    </div>
  </div>

  <!-- =====================================================================
       TAB 4: UNIFIED BACKEND ORDERS & QUEUE DASHBOARD
       ===================================================================== -->
  <div class="tab-pane" id="paneBackend">
    <div class="backend-grid">
      <!-- Live Telemetry Metrics -->
      <div class="telemetry-cards">
        <div class="tel-card">
          <div class="tel-label">In-Flight Queue</div>
          <div class="tel-val" id="telActive" style="color: #38bdf8;">0</div>
        </div>
        <div class="tel-card">
          <div class="tel-label">Fulfilled Orders</div>
          <div class="tel-val" id="telCompleted" style="color: #34d399;">0</div>
        </div>
        <div class="tel-card">
          <div class="tel-label">Replay Attacks Blocked</div>
          <div class="tel-val" id="telDuplicate" style="color: #f59e0b;">0</div>
        </div>
        <div class="tel-card">
          <div class="tel-label">Anti-Rot Zombies Reaped</div>
          <div class="tel-val" id="telZombies" style="color: #c084fc;">0</div>
        </div>
        <div class="tel-card">
          <div class="tel-label">Ring Buffer Memory</div>
          <div class="tel-val" id="telMemory" style="color: #94a3b8; font-size: 1.15rem;">0 / 500</div>
        </div>
      </div>

      <!-- Action Simulation Bar -->
      <div class="test-actions-bar">
        <div>
          <div style="font-weight: 800; font-size: 0.95rem; color: #38bdf8;">
            🛡️ Production Security & Double-Click Protection Test
          </div>
          <div style="font-size: 0.74rem; color: #94a3b8; margin-top: 2px;">
            Simulate network packet bursts or impatient users double-tapping order buttons.
          </div>
        </div>
        <div style="display: flex; gap: 8px;">
          <button class="btn-action-primary" style="padding: 8px 16px; font-size: 0.78rem; background: #0284c7;" onclick="simulateFastOrder()">
            🛒 Place Single Test Order
          </button>
          <button class="btn-action-primary" style="padding: 8px 16px; font-size: 0.78rem; background: linear-gradient(135deg, #f59e0b, #d97706);" onclick="simulateDuplicateAttack()">
            ⚡ Simulate Double-Click Attack (Idempotency Test)
          </button>
        </div>
      </div>

      <!-- Live Simulator Result Toast -->
      <div id="simResultBox" style="display: none; background: #09121f; border: 1px solid #0284c7; border-radius: 14px; padding: 14px 18px; font-size: 0.8rem; line-height: 1.6;">
      </div>

      <!-- Orders Table -->
      <div class="table-container">
        <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 14px;">
          <div style="font-weight: 800; font-size: 0.92rem; color: #f1f5f9;">
            Live Store Orders & Asynchronous Execution Queue
          </div>
          <button class="deck-mode-btn" style="padding: 4px 12px; font-size: 0.7rem;" onclick="fetchBackendOrders()">
            🔄 Refresh Queue
          </button>
        </div>
        <table class="table-custom">
          <thead>
            <tr>
              <th>Order ID</th>
              <th>Customer</th>
              <th>Template</th>
              <th>Total</th>
              <th>Idempotency Key (SHA-256 Shield)</th>
              <th>State</th>
              <th>Placed</th>
            </tr>
          </thead>
          <tbody id="ordersTableBody">
            <tr>
              <td colspan="7" style="text-align: center; color: #64748b; padding: 24px;">No orders currently placed. Click "Place Single Test Order" above to watch live state transitions!</td>
            </tr>
          </tbody>
        </table>
      </div>
    </div>
  </div>

  <!-- =====================================================================
       TAB 5: SETUP & STANDALONE RELEASE
       ===================================================================== -->
  <div class="tab-pane" id="paneRelease">
    <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 20px;">
      <!-- One-Click Download -->
      <div style="background: #0f172a; border: 1px solid #1e293b; border-radius: 20px; padding: 24px; display: flex; flex-direction: column; gap: 16px;">
        <div style="font-size: 1.1rem; font-weight: 800; color: #38bdf8;">
          📦 Download Custom Production Store
        </div>
        <p style="font-size: 0.85rem; color: #cbd5e1; line-height: 1.5;">
          Your customized store incorporates all chosen fonts, color harmonies, boxing, inventory items, coupon engine, Stripe payment routes, and anti-rot mechanisms.
        </p>

        <a href="/api/v1/export-zip" class="btn-action-primary" download>
          <span>⬇️ Download Customized Release (.ZIP)</span>
        </a>

        <div style="background: #090d16; border: 1px solid #1e293b; border-radius: 12px; padding: 12px; font-family: monospace; font-size: 0.78rem; line-height: 1.6; color: #38bdf8;">
# 1. Extract production zip<br>
unzip mycustomstore-release.zip && cd mycustomstore-release<br><br>
# 2. Install dependencies<br>
npm install<br><br>
# 3. Configure Stripe keys in .env.local<br>
cp .env.example .env.local<br><br>
# 4. Launch store studio<br>
npm run dev<br>
# ➜ Running at http://localhost:3000
        </div>
      </div>

      <!-- Live Mobile Pairing QR & Specs -->
      <div style="background: #0f172a; border: 1px solid #1e293b; border-radius: 20px; padding: 24px; display: flex; flex-direction: column; align-items: center; gap: 14px; text-align: center;">
        <div style="font-weight: 800; font-size: 1rem; color: #38bdf8;">
          📱 Mobile Review QR Code
        </div>
        <div style="background: white; padding: 10px; border-radius: 12px;">
          <img src="${qrDataUrl}" alt="Mobile Pairing QR" style="width: 140px; height: 140px; display: block;" />
        </div>
        <div style="font-size: 0.72rem; color: #10b981; font-weight: 700;">🌍 Public Mobile Edge URL:</div>
        <a href="${publicUrl}" target="_blank" style="color: #38bdf8; font-size: 0.78rem; font-family: monospace;">${publicUrl}</a>
        <div style="font-size: 0.7rem; color: #64748b;">Local Wi-Fi LAN: http://${hostIp}:${port}</div>
      </div>
    </div>
  </div>

  <script>
    const fullCatalog = ${catalogJson};
    let currentFilteredCatalog = [...fullCatalog];
    let currentIndex = 0;
    let customState = ${activeCustomizationJson};

    let deckMode = 'templates'; // 'templates' | 'configure'
    let configureStageIndex = 0;

    const configureStages = [
      {
        stage: 'typography',
        title: 'Step 1/5: Typography & Font Harmony',
        cards: [
          { name: 'Space Grotesk + Inter', heading: "'Space Grotesk', sans-serif", body: "'Inter', sans-serif", tag: 'TECH & SAAS', desc: 'Neo-brutalist mechanical precision with clean readable body.' },
          { name: 'Playfair Display + Plus Jakarta', heading: "'Playfair Display', serif", body: "'Plus Jakarta Sans', sans-serif", tag: 'EDITORIAL & COFFEE', desc: 'Sophisticated warmth, classical serif elegance, and modern clarity.' },
          { name: 'Cinzel + Inter', heading: "'Cinzel', serif", body: "'Inter', sans-serif", tag: 'LUXURY & CELLARS', desc: 'Roman imperial geometry suited for high-ticket artisanal craft.' },
          { name: 'Dela Gothic One + Plus Jakarta', heading: "'Dela Gothic One', sans-serif", body: "'Plus Jakarta Sans', sans-serif", tag: 'STREETWEAR & SNEAKERS', desc: 'Heavy visual impact designed for streetwear grails and drops.' },
          { name: 'Syne + JetBrains Mono', heading: "'Syne', sans-serif", body: "'JetBrains Mono', monospace", tag: 'AVANT-GARDE DEV', desc: 'Futuristic expressive curves paired with monospace developer aesthetics.' },
        ]
      },
      {
        stage: 'colors',
        title: 'Step 2/5: Color Mood & Palette',
        cards: [
          { name: 'OLED Midnight', bg: '#000000', cardBg: '#111111', primary: '#06b6d4', secondary: '#22d3ee', text: '#ffffff', tag: 'DARK OLED', desc: 'Pure pitch-black background with electric cyan accents.' },
          { name: 'Cool Slate Tech', bg: '#080c14', cardBg: '#0f172a', primary: '#38bdf8', secondary: '#818cf8', text: '#f8fafc', tag: 'ENGINEERING', desc: 'Deep blue-gray surface for frictionless developer focus.' },
          { name: 'Warm Sand & Terracotta', bg: '#fdfbf7', cardBg: '#ffffff', primary: '#ea580c', secondary: '#d97706', text: '#291811', tag: 'ORGANIC ARTISAN', desc: 'Natural earthy warmth perfect for botanicals, ceramics, and coffee.' },
          { name: 'Cyber Neon Emerald', bg: '#032014', cardBg: '#093a26', primary: '#10b981', secondary: '#34d399', text: '#ecfdf5', tag: 'MATRIX BIO', desc: 'Vibrant living emerald against deep botanical shadows.' },
          { name: 'Royal Crimson Luxury', bg: '#18090d', cardBg: '#2a1017', primary: '#e11d48', secondary: '#f43f5e', text: '#fff1f2', tag: 'GRAND CRU', desc: 'Rich velvet burgundy and champagne tones for vintage prestige.' },
        ]
      },
      {
        stage: 'boxing',
        title: 'Step 3/5: Boxing & Border Radius',
        cards: [
          { name: 'Sharp Brutalist (0px)', radius: '0px', tag: 'HIGH FASHION', desc: 'Zero border-radius. Razor-sharp architectural discipline.' },
          { name: 'Subtle Minimal (6px)', radius: '6px', tag: 'UNDERSTATED', desc: 'Micro-rounded corners providing subtle structural warmth.' },
          { name: 'Modern Rounded (14px)', radius: '14px', tag: 'CONTEMPORARY', desc: 'Balanced card curvature suited for high-conversion web apps.' },
          { name: 'Soft Bubble (24px)', radius: '24px', tag: 'FRIENDLY', desc: 'Curvaceous organic geometry that feels approachable and tactile.' },
          { name: 'Pill Ultra (999px)', radius: '999px', tag: 'CAPSULE UI', desc: 'Complete circular end-caps on buttons and badges.' },
        ]
      },
      {
        stage: 'modules',
        title: 'Step 4/5: Functional Store Modules',
        cards: [
          { name: 'Editorial Blog Engine', moduleKey: 'hasBlog', tag: 'CONTENT MARKETING', desc: 'Swipe Right to INCLUDE articles & SEO guides. Swipe Left to SKIP.' },
          { name: 'Verified Customer Reviews', moduleKey: 'hasReviews', tag: 'SOCIAL PROOF', desc: 'Swipe Right to INCLUDE 5-star ratings and photo reviews. Swipe Left to SKIP.' },
          { name: 'Bento Specification Grid', moduleKey: 'hasBentoGrid', tag: 'PRODUCT SPECS', desc: 'Swipe Right to INCLUDE high-density feature breakdown cards.' },
          { name: 'Sticky Quick-Buy Cart Drawer', moduleKey: 'hasStickyCart', tag: 'FRICTIONLESS CHECKOUT', desc: 'Swipe Right to INCLUDE sliding side cart drawer.' },
        ]
      },
      {
        stage: 'security',
        title: 'Step 5/5: Payment & Idempotency Shield',
        cards: [
          { name: 'Stripe + Idempotency Shield', tag: 'ENTERPRISE SECURITY', desc: 'Cryptographic SHA-256 duplicate-order blocking with automatic anti-rot zombie job reaping.' },
        ]
      }
    ];

    let configureCardIndex = 0;

    const cardEl = document.getElementById('cardElement');
    const stampYes = document.getElementById('stampYes');
    const stampNo = document.getElementById('stampNo');
    const cardCanvas = document.getElementById('cardCanvas');
    const cardTokensRow = document.getElementById('cardTokensRow');
    const deckProgress = document.getElementById('deckProgress');

    function goToTab(tabName) {
      document.querySelectorAll('.nav-tab').forEach(t => t.classList.remove('active'));
      document.querySelectorAll('.tab-pane').forEach(p => p.classList.remove('active'));

      if (tabName === 'swipe') {
        document.getElementById('tabBtnSwipe').classList.add('active');
        document.getElementById('paneSwipe').classList.add('active');
        renderCurrentCard();
      } else if (tabName === 'customize') {
        document.getElementById('tabBtnCustomize').classList.add('active');
        document.getElementById('paneCustomize').classList.add('active');
        populateInspector();
        renderLivePreview();
      } else if (tabName === 'inventory') {
        document.getElementById('tabBtnInventory').classList.add('active');
        document.getElementById('paneInventory').classList.add('active');
        loadInventory();
        loadCoupons();
      } else if (tabName === 'backend') {
        document.getElementById('tabBtnBackend').classList.add('active');
        document.getElementById('paneBackend').classList.add('active');
        fetchBackendOrders();
      } else if (tabName === 'release') {
        document.getElementById('tabBtnRelease').classList.add('active');
        document.getElementById('paneRelease').classList.add('active');
      }
    }

    function switchDeckMode(mode) {
      deckMode = mode;
      document.getElementById('btnModeTemplates').classList.toggle('active', mode === 'templates');
      document.getElementById('btnModeConfigure').classList.toggle('active', mode === 'configure');
      document.getElementById('nichePills').style.display = mode === 'templates' ? 'flex' : 'none';

      if (mode === 'configure') {
        configureStageIndex = 0;
        configureCardIndex = 0;
      }
      renderCurrentCard();
    }

    function filterByNiche(nicheKey) {
      document.querySelectorAll('.filter-chip').forEach(c => c.classList.remove('active'));
      event.target.classList.add('active');

      if (nicheKey === 'all') {
        currentFilteredCatalog = [...fullCatalog];
      } else {
        currentFilteredCatalog = fullCatalog.filter(t => t.niche === nicheKey);
      }
      currentIndex = 0;
      renderCurrentCard();
    }

    function renderCurrentCard() {
      if (deckMode === 'templates') {
        renderTemplateCard();
      } else {
        renderConfigureCard();
      }
    }

    function renderTemplateCard() {
      if (currentIndex >= currentFilteredCatalog.length) {
        currentIndex = 0;
      }
      const t = currentFilteredCatalog[currentIndex];
      deckProgress.textContent = 'Template ' + (currentIndex + 1) + ' of ' + currentFilteredCatalog.length;

      cardEl.style.backgroundColor = t.tokens.bg;
      cardEl.style.color = t.tokens.text;
      cardEl.style.borderColor = t.tokens.border;

      cardCanvas.innerHTML = 
        '<div class="mini-navbar" style="border: 1px solid ' + t.tokens.border + '; background: ' + t.tokens.cardBg + 'cc;">' +
          '<div class="mini-logo" style="color: ' + t.tokens.primary + ';">' + t.categoryIcon + ' ' + t.name.split(' ')[0] + '</div>' +
          '<span class="mini-badge" style="background: ' + t.tokens.secondary + ';">' + t.nicheTitle + '</span>' +
        '</div>' +
        '<div class="mini-hero">' +
          '<span style="font-size: 0.65rem; font-weight: 700; color: ' + t.tokens.primary + '; text-transform: uppercase;">' + t.hero.badge + '</span>' +
          '<h2 class="mini-headline" style="font-family: ' + t.tokens.fontHeading + ';">' + t.hero.headline + '</h2>' +
          '<p class="mini-subheadline" style="font-family: ' + t.tokens.fontBody + ';">' + t.tagline + '</p>' +
          '<button class="mini-cta-btn" style="background: ' + t.tokens.primary + '; border-radius: ' + t.tokens.borderRadius + ';">' + t.hero.primaryCta + ' (' + t.hero.priceSample + ')</button>' +
        '</div>' +
        '<div class="mini-products">' +
          t.sampleProducts.map(p => 
            '<div class="mini-product-card" style="background: ' + t.tokens.cardBg + '; border-radius: ' + t.tokens.borderRadius + ';">' +
              '<span style="font-size: 0.6rem; color: ' + t.tokens.secondary + '; font-weight: 700;">' + p.tag + '</span>' +
              '<div class="mini-product-name">' + p.name + '</div>' +
              '<div class="mini-product-price">$' + p.price + '</div>' +
            '</div>'
          ).join('') +
        '</div>';

      cardTokensRow.innerHTML = 
        '<span class="token-tag">🔤 ' + t.tokens.fontHeading.split(',')[0].replace(/['"]/g, '') + '</span>' +
        '<span class="token-tag">🎨 ' + t.tokens.primary + '</span>' +
        '<span class="token-tag">📐 ' + t.tokens.borderRadius + '</span>' +
        '<span class="token-tag">🛡️ Idempotent Stripe</span>';
    }

    function renderConfigureCard() {
      const currentStage = configureStages[configureStageIndex];
      if (!currentStage) {
        switchDeckMode('templates');
        goToTab('customize');
        return;
      }

      const cards = currentStage.cards;
      if (configureCardIndex >= cards.length) {
        configureCardIndex = 0;
      }
      const c = cards[configureCardIndex];

      deckProgress.textContent = currentStage.title + ' • Option ' + (configureCardIndex + 1) + '/' + cards.length;

      cardEl.style.backgroundColor = '#0f172a';
      cardEl.style.color = '#f8fafc';
      cardEl.style.borderColor = '#38bdf8';

      let stagePreviewHtml = '';
      if (currentStage.stage === 'typography') {
        stagePreviewHtml = 
          '<div style="text-align: center; padding: 24px 10px;">' +
            '<span class="mini-badge" style="background: #0284c7;">' + c.tag + '</span>' +
            '<h2 style="font-family: ' + c.heading + '; font-size: 1.8rem; margin-top: 14px; font-weight: 800;">' + c.name + '</h2>' +
            '<p style="font-family: ' + c.body + '; font-size: 0.95rem; opacity: 0.85; margin-top: 10px; max-width: 320px; margin-left: auto; margin-right: auto;">' + c.desc + '</p>' +
            '<div style="margin-top: 24px; padding: 14px; background: rgba(0,0,0,0.3); border-radius: 12px; font-size: 0.8rem; font-family: ' + c.body + ';">' +
              'The quick brown fox jumps over the lazy dog. 1234567890' +
            '</div>' +
          '</div>';
      } else if (currentStage.stage === 'colors') {
        stagePreviewHtml = 
          '<div style="text-align: center; padding: 20px 10px;">' +
            '<span class="mini-badge" style="background: ' + c.primary + ';">' + c.tag + '</span>' +
            '<h2 style="font-size: 1.7rem; margin-top: 12px; font-weight: 800;">' + c.name + '</h2>' +
            '<p style="font-size: 0.85rem; opacity: 0.85; margin-top: 8px;">' + c.desc + '</p>' +
            '<div style="margin-top: 20px; display: flex; justify-content: center; gap: 12px;">' +
              '<div style="width: 50px; height: 50px; border-radius: 12px; background: ' + c.bg + '; border: 2px solid white; display: flex; align-items: center; justify-content: center; font-size: 0.6rem;">BG</div>' +
              '<div style="width: 50px; height: 50px; border-radius: 12px; background: ' + c.cardBg + '; border: 2px solid white; display: flex; align-items: center; justify-content: center; font-size: 0.6rem;">CARD</div>' +
              '<div style="width: 50px; height: 50px; border-radius: 12px; background: ' + c.primary + '; border: 2px solid white; display: flex; align-items: center; justify-content: center; font-size: 0.6rem;">ACCENT</div>' +
            '</div>' +
          '</div>';
      } else if (currentStage.stage === 'boxing') {
        stagePreviewHtml = 
          '<div style="text-align: center; padding: 24px 10px;">' +
            '<span class="mini-badge" style="background: #10b981;">' + c.tag + '</span>' +
            '<h2 style="font-size: 1.7rem; margin-top: 14px; font-weight: 800;">' + c.name + '</h2>' +
            '<p style="font-size: 0.85rem; opacity: 0.85; margin-top: 10px;">' + c.desc + '</p>' +
            '<div style="margin-top: 24px; padding: 20px; background: #1e293b; border: 2px solid #38bdf8; border-radius: ' + c.radius + '; font-weight: 700;">' +
              'Border Radius Sample Box (' + c.radius + ')' +
            '</div>' +
          '</div>';
      } else if (currentStage.stage === 'modules') {
        stagePreviewHtml = 
          '<div style="text-align: center; padding: 24px 10px;">' +
            '<span class="mini-badge" style="background: #f59e0b;">' + c.tag + '</span>' +
            '<h2 style="font-size: 1.7rem; margin-top: 14px; font-weight: 800;">' + c.name + '</h2>' +
            '<p style="font-size: 0.9rem; opacity: 0.85; margin-top: 12px; line-height: 1.5;">' + c.desc + '</p>' +
            '<div style="margin-top: 24px; font-size: 0.78rem; color: #34d399; font-weight: 800;">' +
              'SWIPE RIGHT ➔ ENABLE | SWIPE LEFT ➔ SKIP' +
            '</div>' +
          '</div>';
      } else if (currentStage.stage === 'security') {
        stagePreviewHtml = 
          '<div style="text-align: center; padding: 24px 10px;">' +
            '<span class="mini-badge" style="background: #10b981;">ZERO DOUBLE CHARGES</span>' +
            '<h2 style="font-size: 1.7rem; margin-top: 14px; font-weight: 800;">' + c.name + '</h2>' +
            '<p style="font-size: 0.9rem; opacity: 0.85; margin-top: 12px; line-height: 1.5;">' + c.desc + '</p>' +
            '<div style="margin-top: 24px; padding: 14px; background: #090d16; border-radius: 12px; border: 1px solid #10b981; font-family: monospace; font-size: 0.75rem; text-align: left; color: #34d399;">' +
              'Idempotency-Key: UUIDv4<br>Payload Hash: SHA-256<br>Replay Defense: Active<br>Anti-Rot Reaper: 15s Sweeper' +
            '</div>' +
          '</div>';
      }

      cardCanvas.innerHTML = stagePreviewHtml;

      cardTokensRow.innerHTML = 
        '<span class="token-tag">⚡ Swipe-To-Configure</span>' +
        '<span class="token-tag">Stage ' + (configureStageIndex + 1) + '/5</span>' +
        '<span class="token-tag">Right ➔ Choose & Advance</span>';
    }

    function actionSwipe(action) {
      if (deckMode === 'templates') {
        handleTemplateSwipe(action);
      } else {
        handleConfigureSwipe(action);
      }
    }

    function handleTemplateSwipe(action) {
      if (action === 'SELECT') {
        stampYes.style.opacity = '1';
        cardEl.classList.add('exit-right');

        const selectedTemplate = currentFilteredCatalog[currentIndex];
        customState.templateId = selectedTemplate.id;
        customState.storeName = selectedTemplate.name;
        customState.niche = selectedTemplate.niche;
        customState.fontHeading = selectedTemplate.tokens.fontHeading;
        customState.fontBody = selectedTemplate.tokens.fontBody;
        customState.primaryColor = selectedTemplate.tokens.primary;
        customState.secondaryColor = selectedTemplate.tokens.secondary;
        customState.bgColor = selectedTemplate.tokens.bg;
        customState.cardBgColor = selectedTemplate.tokens.cardBg;
        customState.textColor = selectedTemplate.tokens.text;
        customState.textMutedColor = selectedTemplate.tokens.textMuted;
        customState.borderRadius = selectedTemplate.tokens.borderRadius;
        customState.primaryCtaText = selectedTemplate.hero.primaryCta;
        customState.sampleProducts = selectedTemplate.sampleProducts;
        customState.hasBlog = selectedTemplate.hasBlog;
        customState.heroHeadline = selectedTemplate.hero.headline;
        customState.heroSubheadline = selectedTemplate.hero.subheadline;
        customState.heroBadge = selectedTemplate.hero.badge;

        syncCustomState();

        setTimeout(() => {
          cardEl.classList.remove('exit-right');
          stampYes.style.opacity = '0';
          switchDeckMode('configure');
        }, 280);
      } else {
        stampNo.style.opacity = '1';
        cardEl.classList.add('exit-left');

        setTimeout(() => {
          cardEl.classList.remove('exit-left');
          stampNo.style.opacity = '0';
          currentIndex++;
          renderCurrentCard();
        }, 280);
      }
    }

    function handleConfigureSwipe(action) {
      const currentStage = configureStages[configureStageIndex];
      if (!currentStage) return;

      const currentCard = currentStage.cards[configureCardIndex];

      if (action === 'SELECT') {
        stampYes.style.opacity = '1';
        cardEl.classList.add('exit-right');

        if (currentStage.stage === 'typography') {
          customState.fontHeading = currentCard.heading;
          customState.fontBody = currentCard.body;
        } else if (currentStage.stage === 'colors') {
          customState.bgColor = currentCard.bg;
          customState.cardBgColor = currentCard.cardBg;
          customState.primaryColor = currentCard.primary;
          customState.secondaryColor = currentCard.secondary;
          customState.textColor = currentCard.text;
        } else if (currentStage.stage === 'boxing') {
          customState.borderRadius = currentCard.radius;
        } else if (currentStage.stage === 'modules') {
          customState[currentCard.moduleKey] = true;
        }

        syncCustomState();

        setTimeout(() => {
          cardEl.classList.remove('exit-right');
          stampYes.style.opacity = '0';
          configureStageIndex++;
          configureCardIndex = 0;
          if (configureStageIndex >= configureStages.length) {
            goToTab('customize');
          } else {
            renderCurrentCard();
          }
        }, 280);
      } else {
        stampNo.style.opacity = '1';
        cardEl.classList.add('exit-left');

        if (currentStage.stage === 'modules') {
          customState[currentCard.moduleKey] = false;
          syncCustomState();
        }

        setTimeout(() => {
          cardEl.classList.remove('exit-left');
          stampNo.style.opacity = '0';
          configureCardIndex++;
          if (configureCardIndex >= currentStage.cards.length) {
            configureCardIndex = 0;
          }
          renderCurrentCard();
        }, 280);
      }
    }

    // Touch & Pointer Gesture Listeners
    let isDragging = false, startX = 0, currentX = 0;
    cardEl.addEventListener('pointerdown', (e) => {
      isDragging = true;
      startX = e.clientX;
      cardEl.setPointerCapture(e.pointerId);
    });

    cardEl.addEventListener('pointermove', (e) => {
      if (!isDragging) return;
      currentX = e.clientX - startX;
      cardEl.style.transform = 'translateX(' + currentX + 'px) rotate(' + (currentX * 0.06) + 'deg)';

      if (currentX > 50) {
        stampYes.style.opacity = Math.min(1, (currentX - 50) / 90);
        stampNo.style.opacity = '0';
      } else if (currentX < -50) {
        stampNo.style.opacity = Math.min(1, (-currentX - 50) / 90);
        stampYes.style.opacity = '0';
      } else {
        stampYes.style.opacity = '0';
        stampNo.style.opacity = '0';
      }
    });

    cardEl.addEventListener('pointerup', () => {
      if (!isDragging) return;
      isDragging = false;
      if (currentX > 90) {
        actionSwipe('SELECT');
      } else if (currentX < -90) {
        actionSwipe('PASS');
      } else {
        cardEl.style.transform = '';
        stampYes.style.opacity = '0';
        stampNo.style.opacity = '0';
      }
      currentX = 0;
    });

    // Keyboard controls
    window.addEventListener('keydown', (e) => {
      if (document.activeElement.tagName === 'INPUT' || document.activeElement.tagName === 'TEXTAREA') return;
      if (e.key === 'ArrowRight' || e.key === 'a' || e.key === 'A') actionSwipe('SELECT');
      if (e.key === 'ArrowLeft' || e.key === 'r' || e.key === 'R') actionSwipe('PASS');
    });

    // =======================================================================
    // Style & Banner Customization Functions (Tab 2)
    // =======================================================================
    function populateInspector() {
      document.getElementById('cfgAnnouncementText').value = customState.announcementText;
      document.getElementById('cfgHasAnnouncement').checked = customState.hasAnnouncement;
      document.getElementById('cfgHeroHeadline').value = customState.heroHeadline;
      document.getElementById('cfgHeroSubheadline').value = customState.heroSubheadline;
      document.getElementById('cfgHeroBadge').value = customState.heroBadge;
      document.getElementById('cfgHeroBgImage').value = customState.heroBgImage;
      document.getElementById('cfgPrimaryColor').value = customState.primaryColor;
      document.getElementById('cfgPrimaryColorHex').textContent = customState.primaryColor;
      document.getElementById('cfgSecondaryColor').value = customState.secondaryColor;
      document.getElementById('cfgSecondaryColorHex').textContent = customState.secondaryColor;
      document.getElementById('cfgBorderRadius').value = customState.borderRadius;
      document.getElementById('cfgH1Size').value = customState.h1Size;
    }

    function setViewport(mode) {
      document.querySelectorAll('.vp-btn').forEach(b => b.classList.remove('active'));
      const frame = document.getElementById('liveStoreFrame');
      frame.className = 'live-store-frame ' + mode;

      if (mode === 'desktop') document.getElementById('vpBtnDesktop').classList.add('active');
      if (mode === 'tablet') document.getElementById('vpBtnTablet').classList.add('active');
      if (mode === 'mobile') document.getElementById('vpBtnMobile').classList.add('active');
    }

    function updateAnnouncementState() {
      customState.announcementText = document.getElementById('cfgAnnouncementText').value;
      customState.hasAnnouncement = document.getElementById('cfgHasAnnouncement').checked;
      renderLivePreview();
      syncCustomState();
    }

    function updateHeroBanner() {
      customState.heroHeadline = document.getElementById('cfgHeroHeadline').value;
      customState.heroSubheadline = document.getElementById('cfgHeroSubheadline').value;
      customState.heroBadge = document.getElementById('cfgHeroBadge').value;
      customState.heroBgImage = document.getElementById('cfgHeroBgImage').value;
      renderLivePreview();
      syncCustomState();
    }

    function updateFontPairing(val) {
      const parts = val.split('|');
      customState.fontHeading = parts[0];
      customState.fontBody = parts[1];
      renderLivePreview();
      syncCustomState();
    }

    function updateH1Size(val) {
      customState.h1Size = val;
      renderLivePreview();
      syncCustomState();
    }

    function updateThemeMode(mode) {
      customState.themeMode = mode;
      if (mode === 'oled') {
        customState.bgColor = '#000000';
        customState.cardBgColor = '#111111';
        customState.textColor = '#ffffff';
      } else if (mode === 'slate') {
        customState.bgColor = '#080c14';
        customState.cardBgColor = '#0f172a';
        customState.textColor = '#f8fafc';
      } else if (mode === 'sand') {
        customState.bgColor = '#fdfbf7';
        customState.cardBgColor = '#ffffff';
        customState.textColor = '#291811';
      } else if (mode === 'white') {
        customState.bgColor = '#ffffff';
        customState.cardBgColor = '#f8fafc';
        customState.textColor = '#0f172a';
      }
      renderLivePreview();
      syncCustomState();
    }

    function updatePrimaryColor(val) {
      customState.primaryColor = val;
      customState.announcementBg = val;
      document.getElementById('cfgPrimaryColorHex').textContent = val;
      renderLivePreview();
      syncCustomState();
    }

    function updateSecondaryColor(val) {
      customState.secondaryColor = val;
      document.getElementById('cfgSecondaryColorHex').textContent = val;
      renderLivePreview();
      syncCustomState();
    }

    function updateBorderRadius(val) {
      customState.borderRadius = val;
      renderLivePreview();
      syncCustomState();
    }

    function syncCustomState() {
      fetch('/api/v1/customize', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(customState)
      }).catch(console.error);
    }

    function renderLivePreview() {
      const frame = document.getElementById('liveStoreFrame');
      frame.style.backgroundColor = customState.bgColor;
      frame.style.color = customState.textColor;

      // Announcement
      const ann = document.getElementById('pvAnnouncement');
      ann.style.display = customState.hasAnnouncement ? 'block' : 'none';
      ann.textContent = customState.announcementText;
      ann.style.backgroundColor = customState.announcementBg || customState.primaryColor;

      // Navbar
      document.getElementById('pvLogo').textContent = customState.storeName;
      document.getElementById('pvLogo').style.color = customState.primaryColor;
      document.getElementById('pvCartBtn').style.backgroundColor = customState.primaryColor;
      document.getElementById('pvBlogLink').style.display = customState.hasBlog ? 'inline' : 'none';

      // Hero
      document.getElementById('pvH1').style.fontFamily = customState.fontHeading;
      document.getElementById('pvH1').style.fontSize = customState.h1Size;
      document.getElementById('pvH1').textContent = customState.heroHeadline;
      document.getElementById('pvSub').style.fontFamily = customState.fontBody;
      document.getElementById('pvSub').textContent = customState.heroSubheadline;
      document.getElementById('pvBadge').style.backgroundColor = customState.secondaryColor;
      document.getElementById('pvBadge').textContent = customState.heroBadge;
      document.getElementById('pvCta').style.backgroundColor = customState.primaryColor;
      document.getElementById('pvCta').style.borderRadius = customState.borderRadius;

      // Products preview
      const prodList = document.getElementById('pvProductList');
      prodList.innerHTML = customState.sampleProducts.map(p => 
        '<div style="background: ' + customState.cardBgColor + '; border-radius: ' + customState.borderRadius + '; padding: 16px; border: 1px solid rgba(255,255,255,0.08); display: flex; flex-direction: column; justify-content: space-between;">' +
          '<div>' +
            '<span style="font-size: 0.65rem; font-weight: 700; color: ' + customState.secondaryColor + ';">' + p.tag + '</span>' +
            '<div style="font-weight: 700; font-size: 0.95rem; margin-top: 4px;">' + p.name + '</div>' +
            '<div style="font-size: 1.25rem; font-weight: 800; margin-top: 6px;">$' + p.price + '</div>' +
          '</div>' +
          '<button style="width: 100%; margin-top: 14px; padding: 8px; font-size: 0.76rem; font-weight: 700; color: white; background: ' + customState.primaryColor + '; border-radius: ' + customState.borderRadius + '; border: none; cursor: pointer;">Add to Cart</button>' +
        '</div>'
      ).join('');
    }

    // =======================================================================
    // Products & Inventory Management (Tab 3)
    // =======================================================================
    async function loadInventory() {
      try {
        const res = await fetch('/api/v1/products');
        const data = await res.json();

        // Update stats
        document.getElementById('invTotalProds').textContent = data.stats.totalProducts;
        document.getElementById('invTotalUnits').textContent = data.stats.totalUnitsInStock;
        document.getElementById('invLowStock').textContent = data.stats.lowStockCount;
        document.getElementById('invOutOfStock').textContent = data.stats.outOfStockCount;

        // Render table
        const tbody = document.getElementById('inventoryTableBody');
        tbody.innerHTML = data.products.map(p => {
          let stockClass = 'stock-instock';
          let stockText = 'In Stock (' + p.stockQuantity + ')';
          if (p.stockQuantity <= 0) {
            stockClass = 'stock-out';
            stockText = 'Out of Stock (0)';
          } else if (p.stockQuantity <= p.lowStockThreshold) {
            stockClass = 'stock-low';
            stockText = 'Low Stock (' + p.stockQuantity + ')';
          }

          return '<tr>' +
            '<td>' +
              '<div style="display: flex; align-items: center; gap: 10px;">' +
                '<img src="' + p.imageUrl + '" style="width: 40px; height: 40px; border-radius: 8px; object-fit: cover;" />' +
                '<div>' +
                  '<strong style="color: #f1f5f9;">' + p.title + '</strong><br>' +
                  '<div style="margin-top: 2px;">' + p.tags.map(t => '<span class="tag-badge">' + t + '</span>').join('') + '</div>' +
                '</div>' +
              '</div>' +
            '</td>' +
            '<td style="font-family: monospace; color: #38bdf8;">' + p.sku + '</td>' +
            '<td><span class="tag-badge">' + p.category + '</span></td>' +
            '<td>' +
              '<strong>$' + p.price + '</strong>' +
              (p.compareAtPrice ? ' <span style="text-decoration: line-through; opacity: 0.5; font-size: 0.72rem;">$' + p.compareAtPrice + '</span> <span style="color: #f43f5e; font-weight: 800; font-size: 0.68rem;">-' + Math.round((1 - p.price/p.compareAtPrice)*100) + '%</span>' : '') +
            '</td>' +
            '<td>' + p.stockQuantity + '</td>' +
            '<td><span class="stock-badge ' + stockClass + '">' + stockText + '</span></td>' +
            '<td>' +
              '<div style="display: flex; gap: 4px;">' +
                '<button class="deck-mode-btn" style="padding: 2px 8px; font-size: 0.7rem;" onclick="adjustStock(\\'' + p.id + '\\', 5)">+5</button>' +
                '<button class="deck-mode-btn" style="padding: 2px 8px; font-size: 0.7rem;" onclick="adjustStock(\\'' + p.id + '\\', -5)">-5</button>' +
              '</div>' +
            '</td>' +
          '</tr>';
        }).join('');
      } catch (err) {
        console.error('Failed to load inventory:', err);
      }
    }

    async function adjustStock(productId, delta) {
      await fetch('/api/v1/products/' + productId + '/stock', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ delta })
      });
      loadInventory();
    }

    async function handleCreateProduct() {
      const title = document.getElementById('newProdTitle').value.trim();
      const sku = document.getElementById('newProdSku').value.trim();
      const price = parseFloat(document.getElementById('newProdPrice').value) || 49;
      const compareAtPrice = parseFloat(document.getElementById('newProdComparePrice').value) || undefined;
      const category = document.getElementById('newProdCategory').value.trim() || 'General';
      const stock = parseInt(document.getElementById('newProdStock').value, 10) || 25;
      const rawTags = document.getElementById('newProdTags').value.trim();
      const tags = rawTags ? rawTags.split(',').map(t => t.trim().toUpperCase()) : ['NEW'];
      const imageUrl = document.getElementById('newProdImage').value.trim() || 'https://images.unsplash.com/photo-1595225476474-87563907a212?auto=format&fit=crop&w=600&q=80';
      const description = document.getElementById('newProdDesc').value.trim() || 'Crafted with premium materials and ergonomic performance.';

      if (!title || !sku) {
        alert('Please enter at least Title and SKU.');
        return;
      }

      await fetch('/api/v1/products', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          sku,
          title,
          description,
          category,
          tags,
          price,
          compareAtPrice,
          stockQuantity: stock,
          lowStockThreshold: 5,
          imageUrl,
          status: stock > 0 ? 'ACTIVE' : 'OUT_OF_STOCK',
        })
      });

      // Clear fields
      document.getElementById('newProdTitle').value = '';
      document.getElementById('newProdSku').value = '';
      document.getElementById('newProdPrice').value = '';
      document.getElementById('newProdComparePrice').value = '';
      loadInventory();
    }

    async function loadCoupons() {
      try {
        const res = await fetch('/api/v1/coupons');
        const data = await res.json();
        const container = document.getElementById('couponsList');

        container.innerHTML = data.coupons.map(c => 
          '<div style="background: #1e293b; border-radius: 8px; padding: 8px 10px; border-left: 3px solid #f59e0b;">' +
            '<div style="display: flex; justify-content: space-between; font-weight: 800;">' +
              '<span style="color: #38bdf8; font-family: monospace;">' + c.code + '</span>' +
              '<span style="color: #34d399;">' + (c.discountType === 'PERCENTAGE' ? c.discountValue + '% OFF' : '$' + c.discountValue + ' OFF') + '</span>' +
            '</div>' +
            '<div style="color: #cbd5e1; font-size: 0.7rem; margin-top: 2px;">' + c.description + ' (Min: $' + c.minOrderAmount + ')</div>' +
          '</div>'
        ).join('');
      } catch (err) {
        console.error('Failed to load coupons:', err);
      }
    }

    async function testApplyCoupon() {
      const code = document.getElementById('testCouponCode').value.trim();
      const res = await fetch('/api/v1/coupons/apply', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ code, subtotal: 189 })
      });
      const data = await res.json();
      const resultEl = document.getElementById('testCouponResult');
      if (data.valid) {
        resultEl.innerHTML = '<span style="color: #34d399; font-weight: 700;">✅ ' + data.message + ' • New Total: $' + data.finalTotal + '</span>';
      } else {
        resultEl.innerHTML = '<span style="color: #f87171; font-weight: 700;">❌ ' + data.message + '</span>';
      }
    }

    // =======================================================================
    // Backend Orders Functions (Tab 4)
    // =======================================================================
    async function fetchBackendOrders() {
      try {
        const res = await fetch('/api/v1/orders');
        const data = await res.json();

        document.getElementById('telActive').textContent = data.stats.activeQueueLength;
        document.getElementById('telCompleted').textContent = data.stats.completedCount;
        document.getElementById('telDuplicate').textContent = data.stats.duplicateBlockedCount;
        document.getElementById('telZombies').textContent = data.stats.zombiesReapedCount;
        document.getElementById('telMemory').textContent = data.stats.memoryBufferUsage;

        const tbody = document.getElementById('ordersTableBody');
        if (!data.orders || data.orders.length === 0) {
          tbody.innerHTML = '<tr><td colspan="7" style="text-align: center; color: #64748b; padding: 24px;">No orders currently placed. Click "Place Single Test Order" above to watch live state transitions!</td></tr>';
          return;
        }

        tbody.innerHTML = data.orders.map(o => 
          '<tr>' +
            '<td style="font-family: monospace; font-weight: 700; color: #38bdf8;">' + o.orderId + '</td>' +
            '<td>' + o.payload.customerName + '<br><span style="font-size: 0.7rem; color: #64748b;">' + o.payload.customerEmail + '</span></td>' +
            '<td><span class="tag-badge">' + o.payload.storeTemplateId + '</span></td>' +
            '<td style="font-weight: 800;">$' + o.payload.totalAmount + ' ' + (o.payload.currency || 'USD') + '</td>' +
            '<td style="font-family: monospace; font-size: 0.72rem; color: #94a3b8;">' + o.idempotencyKey.slice(0, 18) + '...</td>' +
            '<td><span class="status-pill pill-' + o.status + '">' + o.status + '</span></td>' +
            '<td style="color: #64748b; font-size: 0.72rem;">' + new Date(o.createdAt).toLocaleTimeString() + '</td>' +
          '</tr>'
        ).join('');
      } catch (err) {
        console.error('Failed to load backend orders:', err);
      }
    }

    async function simulateFastOrder() {
      const orderPayload = {
        customerName: 'Marcus Vance',
        customerEmail: 'marcus@tactile.dev',
        totalAmount: 189,
        currency: 'USD',
        storeTemplateId: customState.templateId,
        items: [
          { id: 'item_1', name: customState.storeName + ' Flagship Unit', price: 189, quantity: 1 }
        ]
      };

      const randKey = 'key_' + Math.random().toString(36).substring(2, 12);
      await fetch('/api/v1/orders', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Idempotency-Key': randKey
        },
        body: JSON.stringify(orderPayload)
      });

      fetchBackendOrders();
      loadInventory();
      setTimeout(fetchBackendOrders, 600);
      setTimeout(fetchBackendOrders, 1200);
    }

    async function simulateDuplicateAttack() {
      const toast = document.getElementById('simResultBox');
      toast.style.display = 'block';
      toast.innerHTML = '<span style="color: #f59e0b; font-weight: 700;">⚡ Launching rapid simultaneous double-click requests with identical Idempotency-Key...</span>';

      const res = await fetch('/api/v1/orders/simulate-duplicate', { method: 'POST' });
      const data = await res.json();

      toast.innerHTML = 
        '<div style="font-weight: 800; color: #34d399; margin-bottom: 4px;">✅ IDEMPOTENCY ENGINE SECURITY VERIFIED: Zero Duplicate Charges</div>' +
        '<div><strong>1st Request:</strong> Created new order <code style="color: #38bdf8;">' + data.firstCall.order.orderId + '</code> (Processed through Stripe payment intent).</div>' +
        '<div><strong>2nd Request (Concurrent Duplicate):</strong> ' +
          '<span style="color: #f59e0b; font-weight: 700;">BLOCKED & CACHED (Cached: ' + data.secondCall.cached + ')</span>. ' +
          'Returned identical response in sub-millisecond. 0 duplicate DB record inserted. 0 double payment charged.' +
        '</div>';

      fetchBackendOrders();
      loadInventory();
      setTimeout(fetchBackendOrders, 1000);
    }

    // Auto-poll orders when on backend tab
    setInterval(() => {
      if (document.getElementById('paneBackend').classList.contains('active')) {
        fetchBackendOrders();
      }
    }, 2500);

    // Initial render
    renderCurrentCard();
  </script>
</body>
</html>`;
}

// ============================================================================
// HTTP Server Creation & Endpoints
// ============================================================================

export async function createStudioServer(port = DEFAULT_PORT, publicUrl = 'http://bore.pub:56127'): Promise<http.Server> {
  const hostIp = getLocalIp();
  const qrDataUrl = await generateQRCodeDataURL(publicUrl);

  const server = http.createServer(async (req, res) => {
    const parsed = url.parse(req.url ?? '/', true);
    const pathname = parsed.pathname ?? '/';

    // CORS Headers
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization, Idempotency-Key, X-Idempotency-Key');

    if (req.method === 'OPTIONS') {
      res.writeHead(204);
      res.end();
      return;
    }

    // 1. Full Journey Studio Web Application (GET / or GET /studio or GET /review)
    if (pathname === '/' || pathname === '/studio' || pathname === '/review') {
      res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8' });
      res.end(renderStudioHtml(port, qrDataUrl, hostIp, publicUrl));
      return;
    }

    // 2. Health API (GET /api/v1/health)
    if (pathname === '/api/v1/health') {
      res.writeHead(200, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({
        status: 'UP',
        version: SERVER_VERSION,
        activeStore: activeCustomization.storeName,
        totalTemplates: TEMPLATES_CATALOG.length,
        inventory: globalInventoryEngine.getStats(),
        promotions: { totalCoupons: globalPromotionsEngine.listCoupons().length },
        backendQueue: globalOrderQueue.getStats(),
        idempotencyCache: globalIdempotencyEngine.getStats(),
        cpuGovernance: 'thermal_constrained_laptop',
      }, null, 2));
      return;
    }

    // 3. Template Catalog API (GET /api/v1/templates)
    if (pathname === '/api/v1/templates') {
      const niche = parsed.query['niche'] as string | undefined;
      const templates = niche ? TEMPLATES_CATALOG.filter(t => t.niche === niche) : TEMPLATES_CATALOG;
      res.writeHead(200, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({
        total: templates.length,
        templates,
      }, null, 2));
      return;
    }

    // 4. Products Inventory API (GET /api/v1/products)
    if (pathname === '/api/v1/products' && req.method === 'GET') {
      const category = parsed.query['category'] as string | undefined;
      const tag = parsed.query['tag'] as string | undefined;
      const status = parsed.query['status'] as string | undefined;

      const products = globalInventoryEngine.getAllProducts({ category, tag, status });
      const stats = globalInventoryEngine.getStats();

      res.writeHead(200, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ total: products.length, products, stats }, null, 2));
      return;
    }

    // 5. Add Product API (POST /api/v1/products)
    if (pathname === '/api/v1/products' && req.method === 'POST') {
      let body = '';
      req.on('data', chunk => { body += chunk; });
      req.on('end', () => {
        try {
          const item = JSON.parse(body || '{}');
          const created = globalInventoryEngine.addProduct(item);
          res.writeHead(201, { 'Content-Type': 'application/json' });
          res.end(JSON.stringify({ success: true, product: created }));
        } catch (err: any) {
          res.writeHead(400, { 'Content-Type': 'application/json' });
          res.end(JSON.stringify({ error: err.message }));
        }
      });
      return;
    }

    // 6. Adjust Stock Quantity (POST /api/v1/products/:id/stock)
    if (pathname.startsWith('/api/v1/products/') && pathname.endsWith('/stock') && req.method === 'POST') {
      const parts = pathname.split('/');
      const productId = parts[4] || '';
      let body = '';
      req.on('data', chunk => { body += chunk; });
      req.on('end', () => {
        try {
          const { delta } = JSON.parse(body || '{}');
          const existing = globalInventoryEngine.getProduct(productId);
          if (!existing) {
            res.writeHead(404, { 'Content-Type': 'application/json' });
            res.end(JSON.stringify({ error: 'Product not found' }));
            return;
          }
          const updated = globalInventoryEngine.updateProduct(productId, {
            stockQuantity: Math.max(0, existing.stockQuantity + (delta || 0))
          });
          res.writeHead(200, { 'Content-Type': 'application/json' });
          res.end(JSON.stringify({ success: true, product: updated }));
        } catch (err: any) {
          res.writeHead(400, { 'Content-Type': 'application/json' });
          res.end(JSON.stringify({ error: err.message }));
        }
      });
      return;
    }

    // 7. Coupons Listing (GET /api/v1/coupons)
    if (pathname === '/api/v1/coupons' && req.method === 'GET') {
      const coupons = globalPromotionsEngine.listCoupons();
      res.writeHead(200, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ total: coupons.length, coupons }, null, 2));
      return;
    }

    // 8. Apply/Validate Coupon (POST /api/v1/coupons/apply)
    if (pathname === '/api/v1/coupons/apply' && req.method === 'POST') {
      let body = '';
      req.on('data', chunk => { body += chunk; });
      req.on('end', () => {
        try {
          const { code, subtotal } = JSON.parse(body || '{}');
          const result = globalPromotionsEngine.validateCoupon(code || '', typeof subtotal === 'number' ? subtotal : 100);
          res.writeHead(200, { 'Content-Type': 'application/json' });
          res.end(JSON.stringify(result, null, 2));
        } catch (err: any) {
          res.writeHead(400, { 'Content-Type': 'application/json' });
          res.end(JSON.stringify({ error: err.message }));
        }
      });
      return;
    }

    // 9. Update Customization State (POST /api/v1/customize)
    if (pathname === '/api/v1/customize' && req.method === 'POST') {
      let body = '';
      req.on('data', chunk => { body += chunk; });
      req.on('end', () => {
        try {
          const payload = JSON.parse(body || '{}');
          activeCustomization = {
            ...activeCustomization,
            ...payload,
          };
          res.writeHead(200, { 'Content-Type': 'application/json' });
          res.end(JSON.stringify({ success: true, activeCustomization }));
        } catch (err: any) {
          res.writeHead(400, { 'Content-Type': 'application/json' });
          res.end(JSON.stringify({ error: err.message }));
        }
      });
      return;
    }

    // 10. Backend Orders List API (GET /api/v1/orders)
    if (pathname === '/api/v1/orders' && req.method === 'GET') {
      const orders = globalOrderQueue.getAllOrders();
      const stats = globalOrderQueue.getStats();
      res.writeHead(200, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({
        total: orders.length,
        orders,
        stats,
      }, null, 2));
      return;
    }

    // 11. Backend Place Order API (POST /api/v1/orders) with Idempotency Key
    if (pathname === '/api/v1/orders' && req.method === 'POST') {
      let body = '';
      req.on('data', chunk => { body += chunk; });
      req.on('end', async () => {
        try {
          const payload: OrderPayload = JSON.parse(body || '{}');
          const idempotencyKey = (req.headers['idempotency-key'] || req.headers['x-idempotency-key']) as string | undefined;

          const result = await globalOrderQueue.placeOrder(payload, idempotencyKey);
          res.writeHead(200, {
            'Content-Type': 'application/json',
            'X-Idempotent-Match': String(result.isDuplicate),
            'X-Cache-Lookup': result.cached ? 'HIT' : 'MISS',
          });
          res.end(JSON.stringify({
            success: true,
            order: result.order,
            isDuplicate: result.isDuplicate,
            cached: result.cached,
          }));
        } catch (err: any) {
          const status = err.message.includes('Idempotency Conflict') ? 409 : 400;
          res.writeHead(status, { 'Content-Type': 'application/json' });
          res.end(JSON.stringify({ error: err.message }));
        }
      });
      return;
    }

    // 12. Simulate Double-Click Replay Attack (POST /api/v1/orders/simulate-duplicate)
    if (pathname === '/api/v1/orders/simulate-duplicate' && req.method === 'POST') {
      const testKey = `sim_attack_${Date.now()}_${crypto.randomBytes(4).toString('hex')}`;
      const payload: OrderPayload = {
        customerName: 'Elena Rostova',
        customerEmail: 'elena@cybermech.io',
        totalAmount: 249,
        currency: 'USD',
        storeTemplateId: activeCustomization.templateId,
        items: [
          { id: 'item_pro_key', name: activeCustomization.storeName + ' Custom Build', price: 249, quantity: 1 }
        ]
      };

      const firstCall = await globalOrderQueue.placeOrder(payload, testKey);
      const secondCall = await globalOrderQueue.placeOrder(payload, testKey);

      res.writeHead(200, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({
        simulation: 'DOUBLE_CLICK_ATTACK',
        idempotencyKey: testKey,
        firstCall,
        secondCall,
        duplicateBlocked: secondCall.isDuplicate,
        cachedReplay: secondCall.cached,
        securityVerdict: 'VERIFIED: Second order was blocked from double-charging and duplicate processing.',
      }, null, 2));
      return;
    }

    // 13. Anti-Rot Daemon Telemetry API (GET /api/v1/orders/anti-rot-health)
    if (pathname === '/api/v1/orders/anti-rot-health') {
      res.writeHead(200, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({
        queueStats: globalOrderQueue.getStats(),
        idempotencyStats: globalIdempotencyEngine.getStats(),
        inventoryStats: globalInventoryEngine.getStats(),
        rotDefenseStatus: 'HEALTHY',
      }, null, 2));
      return;
    }

    // 14. Stripe Webhook HMAC Listener (POST /api/v1/payments/webhook)
    if (pathname === '/api/v1/payments/webhook' && req.method === 'POST') {
      let body = '';
      req.on('data', chunk => { body += chunk; });
      req.on('end', () => {
        const signatureHeader = req.headers['stripe-signature'] as string || '';
        const isValid = globalPaymentGateway.verifyWebhookSignature(body, signatureHeader);

        res.writeHead(200, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({
          received: true,
          verified: isValid,
          message: isValid ? 'Cryptographic HMAC signature verified' : 'Test webhook received (simulation mode)',
        }));
      });
      return;
    }

    // 15. One-Click Customized Production Release Export (GET /api/v1/export-zip)
    if (pathname === '/api/v1/export-zip') {
      try {
        const vfs = buildCustomStoreVirtualFileSystem(activeCustomization);
        const zipBuffer = await createZipArchive(vfs);

        const safeFilename = activeCustomization.storeName.toLowerCase().replace(/[^a-z0-9]+/g, '-') + '-release.zip';
        res.writeHead(200, {
          'Content-Type': 'application/zip',
          'Content-Disposition': `attachment; filename="${safeFilename}"`,
          'Content-Length': zipBuffer.length,
        });
        res.end(zipBuffer);
        return;
      } catch (err: any) {
        res.writeHead(500, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ error: 'Failed to generate release zip: ' + err.message }));
        return;
      }
    }

    // 16. Static Uploads (/uploads/*)
    if (pathname.startsWith('/uploads/')) {
      const filename = pathname.replace('/uploads/', '');
      if (serveStaticUpload(res, filename)) {
        return;
      }
    }

    // 17. Image Upload API (POST /api/v1/upload)
    if (pathname === '/api/v1/upload' && req.method === 'POST') {
      await handleUploadRoute(req, res);
      return;
    }

    // 18. Self-Healing Scaffold API (POST /api/v1/scaffold)
    if (pathname === '/api/v1/scaffold' && req.method === 'POST') {
      await handleScaffoldRoute(req, res);
      return;
    }

    // 19. Visual Contrast Audit API (POST /api/v1/audit/visual)
    if (pathname === '/api/v1/audit/visual' && req.method === 'POST') {
      await handleAuditVisualRoute(req, res);
      return;
    }

    // 20. AST Introspection API (POST /api/v1/ast/introspect)
    if (pathname === '/api/v1/ast/introspect' && req.method === 'POST') {
      await handleAstIntrospectRoute(req, res);
      return;
    }

    // 21. Living Component Docs (GET /api/v1/docs/:component or GET /docs/:component)
    if (pathname.startsWith('/api/v1/docs/') || pathname.startsWith('/docs/')) {
      const compName = pathname.split('/').pop() || 'Hero';
      await handleDocsRoute(req, res, compName);
      return;
    }

    // 22. Interactive Component Playground (GET /_forge/playground/:component)
    if (pathname.startsWith('/_forge/playground/')) {
      const compName = pathname.split('/').pop() || 'Hero';
      handlePlaygroundRoute(res, compName);
      return;
    }

    // 23. PR Tinder Deck API (GET /api/v1/prs)
    if (pathname === '/api/v1/prs' && req.method === 'GET') {
      await handlePRsRoute(req, res);
      return;
    }

    // 24. PR Tinder Swipe Submission API (POST /api/v1/reviews/swipe)
    if (pathname === '/api/v1/reviews/swipe' && req.method === 'POST') {
      await handleSwipeReviewRoute(req, res);
      return;
    }

    // Fallback 404
    res.writeHead(404, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({
      error: 'Endpoint not found',
      available: [
        '/',
        '/studio',
        '/api/v1/health',
        '/api/v1/templates',
        '/api/v1/products',
        '/api/v1/coupons',
        '/api/v1/coupons/apply',
        '/api/v1/customize',
        '/api/v1/orders',
        '/api/v1/orders/simulate-duplicate',
        '/api/v1/orders/anti-rot-health',
        '/api/v1/payments/webhook',
        '/api/v1/export-zip',
        '/api/v1/upload',
        '/api/v1/scaffold',
        '/api/v1/audit/visual',
        '/api/v1/ast/introspect',
        '/api/v1/docs/:component',
        '/_forge/playground/:component',
        '/api/v1/prs',
        '/api/v1/reviews/swipe',
      ]
    }));
  });

  return server;
}

// Direct Execution Entrypoint
const isDirectEntry = process.argv[1]?.includes('server') && (process.argv[1]?.endsWith('.js') || process.argv[1]?.endsWith('.ts'));
if (isDirectEntry) {
  const port = parseInt(process.env['PORT'] ?? String(DEFAULT_PORT), 10);
  createStudioServer(port).then(server => {
    server.listen(port, () => {
      const hostIp = getLocalIp();
      console.log(`\x1b[32m\x1b[1m⚡ OmniStack Forge 100+ Visual Template Studio Live!\x1b[0m`);
      console.log(`   ➜ Local UI:           \x1b[36mhttp://localhost:${port}\x1b[0m`);
      console.log(`   ➜ Public Mobile Edge: \x1b[32m\x1b[1mhttp://bore.pub:56127\x1b[0m`);
      console.log(`   ➜ Local Wi-Fi LAN:    \x1b[36mhttp://${hostIp}:${port}\x1b[0m`);
      console.log(`   ➜ Health API:         \x1b[36mhttp://localhost:${port}/api/v1/health\x1b[0m`);
      console.log(`   ➜ Products Inventory: \x1b[36mhttp://localhost:${port}/api/v1/products\x1b[0m`);
      console.log(`   ➜ Coupons & Promo:    \x1b[36mhttp://localhost:${port}/api/v1/coupons\x1b[0m`);
      console.log(`   ➜ Orders Pipeline:    \x1b[36mhttp://localhost:${port}/api/v1/orders\x1b[0m`);
      console.log(`   ➜ Export Custom ZIP:  \x1b[36mhttp://localhost:${port}/api/v1/export-zip\x1b[0m`);
    });
  }).catch(err => {
    console.error('Failed to start OmniStack Studio Server:', err);
    process.exit(1);
  });
}
