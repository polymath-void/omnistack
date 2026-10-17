# OmniStack Forge: Missing Stacks & Gap Analysis

> Companion document to [merged_architectural_blueprints.md](file:///D:/ViralProject/merged_architectural_blueprints.md) — Blueprint #3

---

## What Currently Exists

| Layer | What's Present | Location |
| :--- | :--- | :--- |
| **Frontend Shell** | Barebones Next.js 16 + React 19 + Tailwind v4 + Zustand + Framer Motion | [antigravity-unified-engine](file:///D:/Projects/antigravity-unified-engine) |
| **UI Components** | 3 files total: `App.tsx` (chat), `MessageList.tsx` (desktop), `MobileApp.tsx` | [src/](file:///D:/Projects/antigravity-unified-engine/src) |
| **Server** | Empty `server/` directory — no backend code whatsoever | — |
| **Global Packages** | `@google/gemini-cli`, `puppeteer`, `polymath-jage` | npm global |
| **Runtime** | Node.js (LTS via Scoop), Python 3.12 (via `uv`), Git | System PATH |
| **Missing Entirely** | No Cargo/Rust, no Docker, no Pip, no tree-sitter CLI, no Typst, no Pandoc, no FastAPI, no SWC CLI, no Babel CLI, no ESLint (local only) | — |

---

## Complete Missing Stack Breakdown

### 1. 🔴 Backend API Layer — **Completely Missing**

The blueprint calls for a backend orchestration engine. Nothing exists.

| Missing Component | Purpose in Blueprint | Recommended Stack |
| :--- | :--- | :--- |
| **FastAPI / Hono Server** | Core API: receives prompts, dispatches scaffold jobs, returns generated project archives | FastAPI (Python) or Hono (TypeScript on Bun/Node) |
| **WebSocket Server** | Real-time progress streaming during scaffold generation, live doc preview updates | `ws` / `socket.io` or FastAPI WebSockets |
| **Job Queue / Task Runner** | Async scaffold generation, AST walks, screenshot audits running in background workers | BullMQ (Redis) or Celery (Python) or simple SQLite queue |
| **Auth & Session** | Multi-user project isolation, API key management | NextAuth.js v5 / Lucia Auth / Clerk |
| **Database** | Persist generated projects, scaffold templates, audit history, user data | SQLite (Turso/libSQL) or PostgreSQL |

---

### 2. 🔴 AST Walker & Code Intelligence Engine — **Completely Missing**

The blueprint's Dynamic DocGen requires parsing codebases into component trees. Nothing exists.

| Missing Component | Purpose in Blueprint | Recommended Stack |
| :--- | :--- | :--- |
| **Tree-sitter Bindings** | Universal multi-language AST parsing (JS/TS, Python, Rust, Go, etc.) | `tree-sitter` CLI + `node-tree-sitter` or `py-tree-sitter` |
| **SWC / Babel Transformer** | Fast JSX/TSX component extraction, prop table inference, export graph building | `@swc/core` (Rust-backed, ~20x faster than Babel) |
| **Component Dependency Graph** | Traces imports/exports to build interactive component relationship maps | Custom walker using SWC AST + `graphlib` or `d3-hierarchy` |
| **Docstring / JSDoc Extractor** | Pulls inline documentation, prop types, parameter descriptions | `ts-morph` (TypeScript Compiler API wrapper) or `typedoc` |
| **Live Documentation Renderer** | Transforms AST + extracted docs into interactive, executable React doc pages | `MDX` + `next-mdx-remote` or Storybook-like isolated component sandbox |

---

### 3. 🔴 Scaffold / Code Generation Engine — **Completely Missing**

The Instant Stack CLI + Prompt-to-Store concept has zero implementation.

| Missing Component | Purpose in Blueprint | Recommended Stack |
| :--- | :--- | :--- |
| **Template Registry** | Pre-built, composable project skeletons (Next.js, FastAPI, Stripe, Auth variants) | Handlebars / EJS templates or Plop.js generators |
| **LLM Code Synthesis Bridge** | Translates natural language prompts into template selection + variable injection | Gemini API / local model via `antigravity-core` |
| **File System Emitter** | Writes generated project files to disk or returns as downloadable tar/zip archive | `memfs` (in-memory FS) → `archiver` (zip) |
| **Stripe Integration Boilerplate** | Pre-wired checkout, webhook handlers, subscription management | Stripe SDK templates with env-var injection |
| **Auth Integration Boilerplate** | Pre-wired OAuth2, magic-link, session management | NextAuth.js / Supabase Auth / Firebase Auth templates |
| **Database Migration Seeds** | Auto-generated Prisma / Drizzle schema + seed data from prompt context | Drizzle ORM (lighter) or Prisma (richer) |

---

### 4. 🔴 Vision / DOM / UI Auditor ("Roast-My-UI") — **Completely Missing**

No screenshot capture, DOM analysis, or CSS patching pipeline exists.

| Missing Component | Purpose in Blueprint | Recommended Stack |
| :--- | :--- | :--- |
| **Screenshot Capture Engine** | Renders target URL/component to image for visual analysis | Puppeteer (already installed globally) or Playwright |
| **DOM / AXTree Snapshot** | Extracts accessibility tree, semantic structure, and CSS computed styles | Puppeteer CDP + `page.accessibility.snapshot()` |
| **Vision Model Integration** | Sends screenshot to multimodal LLM for design critique and improvement suggestions | Gemini 2.5 Pro Vision API or local CLIP-based scorer |
| **CSS Diff Generator** | Produces exact Tailwind utility class patches from audit findings | Custom mapper: computed CSS → nearest Tailwind class using `tailwindcss` resolver |
| **Contrast / A11y Checker** | WCAG 2.1 AA/AAA compliance: color contrast ratios, focus order, alt-text, ARIA roles | `axe-core` (Deque) headless auditor |
| **Design Token Extractor** | Pulls color palette, typography scale, spacing rhythm from existing site | Custom CSS variable / computed-style aggregator |

---

### 5. 🔴 Mobile PR Review Interface ("PR Tinder") — **Completely Missing**

The MobileApp.tsx is a shell with no PR or Git integration.

| Missing Component | Purpose in Blueprint | Recommended Stack |
| :--- | :--- | :--- |
| **GitHub / GitLab API Client** | Fetches open PRs, diffs, review comments, file change trees | Octokit (GitHub REST/GraphQL) or GitLab SDK |
| **Diff Renderer** | Mobile-optimized, syntax-highlighted, side-by-side or unified diff view | `react-diff-viewer-continued` or `monaco-editor` (lightweight) |
| **Swipe Gesture Engine** | Touch-based approve / reject / comment with haptic feedback | `react-native-gesture-handler` (if RN) or `framer-motion` drag gestures (web) |
| **Review Comment Composer** | Inline thread creation, suggestion blocks, emoji reactions | Custom component + GitHub GraphQL `addPullRequestReview` mutation |
| **Push Notification Service** | Alerts reviewers when PRs are assigned or reviews are requested | Web Push API + Service Worker or Firebase Cloud Messaging |

---

### 6. 🟡 DevOps / Infrastructure — **Partially Missing**

| Missing Component | Purpose in Blueprint | Recommended Stack |
| :--- | :--- | :--- |
| **Docker / Containerization** | Sandboxed scaffold generation, isolated build environments | Docker Desktop or Podman (not installed) |
| **CI/CD Pipeline** | Auto-test generated scaffolds, lint, build, deploy docs | GitHub Actions (repo exists) |
| **Monorepo Tooling** | Manage multiple packages (CLI, API, web, mobile) in unified repo | Turborepo or Nx |
| **Package Publishing** | Distribute CLI tool as `npx omnistack-forge` | npm publish pipeline |

---

### 7. 🟡 CLI Interface — **Completely Missing**

No command-line entry point exists for "Instant Stack CLI" behavior.

| Missing Component | Purpose in Blueprint | Recommended Stack |
| :--- | :--- | :--- |
| **CLI Framework** | Interactive terminal prompts, flag parsing, help generation | `commander` + `inquirer` (Node) or `clap` (Rust) or `typer` (Python) |
| **TUI Progress Dashboard** | Real-time scaffold progress with spinners, file tree preview | `ora` + `cli-progress` or `ink` (React for CLI) |
| **Config File Support** | `.omnistackrc` / `forge.config.ts` for project defaults and template preferences | `cosmiconfig` |

---

## Gap Summary Scorecard

| Blueprint Sub-System | Merged Concept | Implementation Status | Priority |
| :--- | :---: | :---: | :---: |
| Backend API & Orchestrator | #13 Instant Stack | 🔴 **0%** | **P0 — Critical** |
| AST Walker & DocGen | #6 Dynamic DocGen | 🔴 **0%** | **P0 — Critical** |
| Scaffold / Code Generator | #13 + #8 | 🔴 **0%** | **P0 — Critical** |
| Vision / UI Auditor | #14 Roast-My-UI | 🔴 **0%** | **P1 — High** |
| Mobile PR Review | #24 PR Tinder | 🔴 **0%** (shell only) | **P1 — High** |
| CLI Entry Point | #13 Instant Stack | 🔴 **0%** | **P1 — High** |
| Frontend Dashboard | All | 🟡 **~10%** (Next.js shell) | **P2 — Medium** |
| DevOps & Infra | All | 🟡 **~15%** (Git, Node, Python) | **P2 — Medium** |
| Auth & Multi-User | #8 | 🔴 **0%** | **P2 — Medium** |

> **Overall Completion: ~5%** — Only a Next.js 16 frontend shell with 3 component files and package dependencies exist. Every core subsystem (backend, AST engine, scaffold generator, vision auditor, PR interface, CLI) is entirely unbuilt.

---

## Recommended Build Order

```
Phase 1 (Foundation)          Phase 2 (Intelligence)       Phase 3 (Experience)
─────────────────────         ──────────────────────       ─────────────────────
│ Backend API (Hono/FastAPI)  │ AST Walker (SWC)           │ Mobile PR Tinder UI
│ SQLite Database             │ LLM Code Synth Bridge      │ Push Notifications
│ Template Registry           │ Dynamic DocGen Renderer     │ Design Token Extractor
│ CLI Framework               │ Vision/Screenshot Auditor   │ A11y WCAG Checker
│ File System Emitter         │ CSS Diff Generator          │ Monorepo + CI/CD
└─────────────────────        └──────────────────────       └─────────────────────
```

---

## System Toolchain Gaps (Must Install)

| Tool | Why Needed | Install Command |
| :--- | :--- | :--- |
| **Cargo / Rust** | SWC is Rust-backed; tree-sitter native bindings; terminal-browser already uses Rust | `scoop install rustup` → `rustup default stable` |
| **Docker** | Sandboxed scaffold builds, isolated template testing | `scoop install docker` or Docker Desktop |
| **tree-sitter CLI** | Multi-language AST parsing for DocGen | `cargo install tree-sitter-cli` or `npm i tree-sitter` |
| **Typst** | Fast, modern PDF/document generation from scaffold readmes | `scoop install typst` |
| **Bun** | Fast JS runtime for Hono server and monorepo scripts | `scoop install bun` |

---

*This analysis was generated without modifying any existing project files.*
