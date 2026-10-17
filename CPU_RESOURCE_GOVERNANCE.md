# OmniStack Forge: Laptop Resource Governance & CPU Throttling Policy
## Thermal, Compute & Memory Constraints for Autonomous Swarm Execution

---

## 1. Executive Context
OmniStack Forge operates on a **thermal- and compute-constrained laptop environment**.
Autonomous agents and background engines must actively prevent:
* 100% CPU core saturation leading to thermal throttling or system freezes.
* RAM exhaustion from orphaned headless Chromium or node processes.
* Excessive battery and fan strain caused by unthrottled build loops.

---

## 2. Mandatory Swarm Governance Rules

### Rule 1: Build & Task Concurrency Ceilings
* **Turborepo**: Never run unconstrained parallel builds. Always execute with concurrency caps:
  ```bash
  turbo run build --concurrency=1
  # or max 2 when CPU load is below 50%
  turbo run build --concurrency=2
  ```
* **Package Managers (`npm`, `bun`)**: Use `--prefer-offline` where possible and avoid parallel sub-package installations across monorepo packages simultaneously.

### Rule 2: Headless Browser & CDP Resource Hygiene (`Agent-Vision`)
* **Browser Pool Limit**: Max **1 active browser instance** with **1 active page** at any given time. Multi-tab concurrency is strictly prohibited.
* **Launch Arguments**: Must include low-overhead hardware acceleration bypasses:
  ```javascript
  const browser = await puppeteer.launch({
    headless: 'new',
    args: [
      '--no-sandbox',
      '--disable-setuid-sandbox',
      '--disable-gpu',
      '--disable-dev-shm-usage',
      '--disable-software-rasterizer',
      '--disable-extensions',
      '--single-process', // Low-overhead single process mode
      '--no-zygote'
    ]
  });
  ```
* **Aggressive PID Reaping**: Always wrap browser interactions in `try/finally` blocks ensuring `await page.close()` and `await browser.close()` are executed immediately after capturing the required screenshot. Never leave orphan Chromium processes running in the background.

### Rule 3: Docker & Ephemeral Sandbox Quotas (`Agent-Sandbox`)
* Every spawned compilation container must run under strict resource cgroups:
  ```bash
  docker run --rm \
    --cpus=1.5 \
    --memory=1536m \
    --memory-swap=2048m \
    --network none \
    omnistack-sandbox
  ```
* Sandboxed compiler runs must have a hard timeout (max 45 seconds). If a build hangs, the process is reaped immediately.

### Rule 4: AST Engine Batching (`Agent-ASTDoc`)
* Do not parse thousands of AST files simultaneously.
* Process files sequentially or in micro-batches of $\le 5$ files with a 50ms cooperative yield interval (`await new Promise(r => setTimeout(r, 50))`) to allow the event loop to breathe.

### Rule 5: ZeroMQ & Background Daemon Polling Hygiene
* **No Tight Loops**: Polling loops are strictly forbidden. Any loop checking task state must include an exponential backoff sleep (e.g. `sleep 1s`, `sleep 2s`, `sleep 5s`).
* When idle, daemons must sleep on blocking socket reads or system event interrupts rather than burning CPU cycles.

---

*Policy activated for all OmniStack Forge subagents, daemons, and task pipelines.*
