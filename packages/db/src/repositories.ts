/**
 * @omnistack/db - Type-safe Repositories for OmniStack Forge
 */

import { OmniDatabase, getDatabase } from './client.js';

export interface ProjectRecord {
  id: string;
  name: string;
  slug: string;
  description?: string | null;
  prompt: string;
  stack_type: string;
  local_path: string;
  git_repo_url?: string | null;
  status: string;
  created_at: number;
  updated_at: number;
}

export interface ScaffoldJobRecord {
  id: string;
  project_id: string;
  current_step: string;
  progress_percent: number;
  compilation_errors?: string | null;
  healing_attempts: number;
  artifact_zip_path?: string | null;
  logs?: string | null;
  created_at: number;
  completed_at?: number | null;
}

export interface ASTComponentRecord {
  id: string;
  project_id: string;
  file_path: string;
  component_name: string;
  props_schema_json: string;
  exports: string;
  dependencies: string;
  docstring?: string | null;
  preview_route?: string | null;
}

export interface UIAuditRecord {
  id: string;
  project_id: string;
  viewport: string;
  screenshot_path: string;
  contrast_score: number;
  responsive_score: number;
  a11y_violations_count: number;
  violations_json: string;
  patches_applied_json?: string | null;
  created_at: number;
}

export interface PRReviewRecordDb {
  id: string;
  project_id: string;
  pr_number: number;
  title: string;
  author: string;
  diff_summary_json: string;
  screenshot_before?: string | null;
  screenshot_after?: string | null;
  verdict?: string | null;
  feedback_text?: string | null;
  reviewed_at?: number | null;
}

export interface ProductRecord {
  id: string;
  sku: string;
  title: string;
  description: string;
  price: number;
  compare_at_price?: number | null;
  category: string;
  tags: string;
  stock_count: number;
  low_stock_threshold: number;
  image_url: string;
  is_active: number;
  created_at: number;
  updated_at: number;
}

export interface CouponRecord {
  code: string;
  discount_type: 'PERCENTAGE' | 'FIXED';
  discount_value: number;
  min_cart_amount: number;
  usage_limit?: number | null;
  times_used: number;
  is_active: number;
  created_at: number;
}

export interface OrderRecord {
  order_id: string;
  idempotency_key: string;
  customer_name: string;
  customer_email: string;
  total_amount: number;
  currency: string;
  status: string;
  store_template_id: string;
  items_json: string;
  timeline_json: string;
  shipping_address?: string | null;
  retry_count: number;
  created_at: number;
  updated_at: number;
}

// ---------------------------------------------------------------------------
// Projects Repository
// ---------------------------------------------------------------------------
export class ProjectsRepository {
  constructor(private readonly db: OmniDatabase = getDatabase()) {}

  public create(proj: ProjectRecord): void {
    const stmt = this.db.db.prepare(`
      INSERT INTO projects (id, name, slug, description, prompt, stack_type, local_path, git_repo_url, status, created_at, updated_at)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `);
    stmt.run(
      proj.id,
      proj.name,
      proj.slug,
      proj.description ?? null,
      proj.prompt,
      proj.stack_type,
      proj.local_path,
      proj.git_repo_url ?? null,
      proj.status,
      proj.created_at,
      proj.updated_at
    );
  }

  public getById(id: string): ProjectRecord | null {
    const stmt = this.db.db.prepare('SELECT * FROM projects WHERE id = ?');
    return (stmt.get(id) as unknown as ProjectRecord) ?? null;
  }

  public getBySlug(slug: string): ProjectRecord | null {
    const stmt = this.db.db.prepare('SELECT * FROM projects WHERE slug = ?');
    return (stmt.get(slug) as unknown as ProjectRecord) ?? null;
  }

  public list(limit = 50): ProjectRecord[] {
    const stmt = this.db.db.prepare('SELECT * FROM projects ORDER BY created_at DESC LIMIT ?');
    return stmt.all(limit) as unknown as ProjectRecord[];
  }

  public updateStatus(id: string, status: string): void {
    const stmt = this.db.db.prepare('UPDATE projects SET status = ?, updated_at = ? WHERE id = ?');
    stmt.run(status, Date.now(), id);
  }

  public delete(id: string): void {
    const stmt = this.db.db.prepare('DELETE FROM projects WHERE id = ?');
    stmt.run(id);
  }
}

// ---------------------------------------------------------------------------
// Scaffold Jobs Repository
// ---------------------------------------------------------------------------
export class ScaffoldJobsRepository {
  constructor(private readonly db: OmniDatabase = getDatabase()) {}

  public create(job: ScaffoldJobRecord): void {
    const stmt = this.db.db.prepare(`
      INSERT INTO scaffold_jobs (id, project_id, current_step, progress_percent, compilation_errors, healing_attempts, artifact_zip_path, logs, created_at, completed_at)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `);
    stmt.run(
      job.id,
      job.project_id,
      job.current_step,
      job.progress_percent,
      job.compilation_errors ?? null,
      job.healing_attempts,
      job.artifact_zip_path ?? null,
      job.logs ?? null,
      job.created_at,
      job.completed_at ?? null
    );
  }

  public getById(id: string): ScaffoldJobRecord | null {
    const stmt = this.db.db.prepare('SELECT * FROM scaffold_jobs WHERE id = ?');
    return (stmt.get(id) as unknown as ScaffoldJobRecord) ?? null;
  }

  public updateProgress(id: string, step: string, progress: number, logs?: string): void {
    const stmt = this.db.db.prepare(`
      UPDATE scaffold_jobs
      SET current_step = ?, progress_percent = ?, logs = COALESCE(logs || '\n', '') || COALESCE(?, '')
      WHERE id = ?
    `);
    stmt.run(step, progress, logs ?? null, id);
  }

  public complete(id: string, artifactPath: string, errors?: string): void {
    const stmt = this.db.db.prepare(`
      UPDATE scaffold_jobs
      SET current_step = 'done', progress_percent = 100, artifact_zip_path = ?, compilation_errors = ?, completed_at = ?
      WHERE id = ?
    `);
    stmt.run(artifactPath, errors ?? null, Date.now(), id);
  }

  public listByProject(projectId: string): ScaffoldJobRecord[] {
    const stmt = this.db.db.prepare('SELECT * FROM scaffold_jobs WHERE project_id = ? ORDER BY created_at DESC');
    return stmt.all(projectId) as unknown as ScaffoldJobRecord[];
  }
}

// ---------------------------------------------------------------------------
// Inventory & Catalog Repository
// ---------------------------------------------------------------------------
export class InventoryRepository {
  constructor(private readonly db: OmniDatabase = getDatabase()) {}

  public saveProduct(p: ProductRecord): void {
    const stmt = this.db.db.prepare(`
      INSERT INTO products (id, sku, title, description, price, compare_at_price, category, tags, stock_count, low_stock_threshold, image_url, is_active, created_at, updated_at)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      ON CONFLICT(id) DO UPDATE SET
        title = excluded.title,
        description = excluded.description,
        price = excluded.price,
        compare_at_price = excluded.compare_at_price,
        category = excluded.category,
        tags = excluded.tags,
        stock_count = excluded.stock_count,
        low_stock_threshold = excluded.low_stock_threshold,
        image_url = excluded.image_url,
        is_active = excluded.is_active,
        updated_at = excluded.updated_at
    `);
    stmt.run(
      p.id,
      p.sku,
      p.title,
      p.description,
      p.price,
      p.compare_at_price ?? null,
      p.category,
      p.tags,
      p.stock_count,
      p.low_stock_threshold,
      p.image_url,
      p.is_active,
      p.created_at,
      p.updated_at
    );
  }

  public listProducts(): ProductRecord[] {
    const stmt = this.db.db.prepare('SELECT * FROM products ORDER BY created_at ASC');
    return stmt.all() as unknown as ProductRecord[];
  }

  public getProductById(id: string): ProductRecord | null {
    const stmt = this.db.db.prepare('SELECT * FROM products WHERE id = ?');
    return (stmt.get(id) as unknown as ProductRecord) ?? null;
  }

  public updateStock(id: string, delta: number): ProductRecord | null {
    const stmt = this.db.db.prepare(`
      UPDATE products
      SET stock_count = MAX(0, stock_count + ?), updated_at = ?
      WHERE id = ?
      RETURNING *
    `);
    return (stmt.get(delta, Date.now(), id) as unknown as ProductRecord) ?? null;
  }

  public saveCoupon(c: CouponRecord): void {
    const stmt = this.db.db.prepare(`
      INSERT INTO coupons (code, discount_type, discount_value, min_cart_amount, usage_limit, times_used, is_active, created_at)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?)
      ON CONFLICT(code) DO UPDATE SET
        discount_type = excluded.discount_type,
        discount_value = excluded.discount_value,
        min_cart_amount = excluded.min_cart_amount,
        usage_limit = excluded.usage_limit,
        times_used = excluded.times_used,
        is_active = excluded.is_active
    `);
    stmt.run(
      c.code,
      c.discount_type,
      c.discount_value,
      c.min_cart_amount,
      c.usage_limit ?? null,
      c.times_used,
      c.is_active,
      c.created_at
    );
  }

  public listCoupons(): CouponRecord[] {
    const stmt = this.db.db.prepare('SELECT * FROM coupons ORDER BY code ASC');
    return stmt.all() as unknown as CouponRecord[];
  }

  public getCoupon(code: string): CouponRecord | null {
    const stmt = this.db.db.prepare('SELECT * FROM coupons WHERE UPPER(code) = UPPER(?) AND is_active = 1');
    return (stmt.get(code) as unknown as CouponRecord) ?? null;
  }
}

// ---------------------------------------------------------------------------
// Orders Repository
// ---------------------------------------------------------------------------
export class OrdersRepository {
  constructor(private readonly db: OmniDatabase = getDatabase()) {}

  public saveOrder(order: OrderRecord): void {
    const stmt = this.db.db.prepare(`
      INSERT INTO orders (order_id, idempotency_key, customer_name, customer_email, total_amount, currency, status, store_template_id, items_json, timeline_json, shipping_address, retry_count, created_at, updated_at)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      ON CONFLICT(order_id) DO UPDATE SET
        status = excluded.status,
        timeline_json = excluded.timeline_json,
        retry_count = excluded.retry_count,
        updated_at = excluded.updated_at
    `);
    stmt.run(
      order.order_id,
      order.idempotency_key,
      order.customer_name,
      order.customer_email,
      order.total_amount,
      order.currency,
      order.status,
      order.store_template_id,
      order.items_json,
      order.timeline_json,
      order.shipping_address ?? null,
      order.retry_count,
      order.created_at,
      order.updated_at
    );
  }

  public getById(orderId: string): OrderRecord | null {
    const stmt = this.db.db.prepare('SELECT * FROM orders WHERE order_id = ?');
    return (stmt.get(orderId) as unknown as OrderRecord) ?? null;
  }

  public getByIdempotencyKey(key: string): OrderRecord | null {
    const stmt = this.db.db.prepare('SELECT * FROM orders WHERE idempotency_key = ?');
    return (stmt.get(key) as unknown as OrderRecord) ?? null;
  }

  public list(limit = 100): OrderRecord[] {
    const stmt = this.db.db.prepare('SELECT * FROM orders ORDER BY created_at DESC LIMIT ?');
    return stmt.all(limit) as unknown as OrderRecord[];
  }
}

// ---------------------------------------------------------------------------
// PR Reviews Repository
// ---------------------------------------------------------------------------
export class PRReviewsRepository {
  constructor(private readonly db: OmniDatabase = getDatabase()) {}

  public saveReview(r: PRReviewRecordDb): void {
    const stmt = this.db.db.prepare(`
      INSERT INTO pr_reviews (id, project_id, pr_number, title, author, diff_summary_json, screenshot_before, screenshot_after, verdict, feedback_text, reviewed_at)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      ON CONFLICT(id) DO UPDATE SET
        verdict = excluded.verdict,
        feedback_text = excluded.feedback_text,
        reviewed_at = excluded.reviewed_at
    `);
    stmt.run(
      r.id,
      r.project_id,
      r.pr_number,
      r.title,
      r.author,
      r.diff_summary_json,
      r.screenshot_before ?? null,
      r.screenshot_after ?? null,
      r.verdict ?? null,
      r.feedback_text ?? null,
      r.reviewed_at ?? null
    );
  }

  public listByProject(projectId: string): PRReviewRecordDb[] {
    const stmt = this.db.db.prepare('SELECT * FROM pr_reviews WHERE project_id = ? ORDER BY pr_number DESC');
    return stmt.all(projectId) as unknown as PRReviewRecordDb[];
  }

  public listAll(limit = 50): PRReviewRecordDb[] {
    const stmt = this.db.db.prepare('SELECT * FROM pr_reviews ORDER BY reviewed_at DESC LIMIT ?');
    return stmt.all(limit) as unknown as PRReviewRecordDb[];
  }
}

// ---------------------------------------------------------------------------
// UI Audits Repository
// ---------------------------------------------------------------------------
export class UIAuditsRepository {
  constructor(private readonly db: OmniDatabase = getDatabase()) {}

  public create(audit: UIAuditRecord): void {
    const stmt = this.db.db.prepare(`
      INSERT INTO ui_audits (id, project_id, viewport, screenshot_path, contrast_score, responsive_score, a11y_violations_count, violations_json, patches_applied_json, created_at)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `);
    stmt.run(
      audit.id,
      audit.project_id,
      audit.viewport,
      audit.screenshot_path,
      audit.contrast_score,
      audit.responsive_score,
      audit.a11y_violations_count,
      audit.violations_json,
      audit.patches_applied_json ?? null,
      audit.created_at
    );
  }

  public listByProject(projectId: string): UIAuditRecord[] {
    const stmt = this.db.db.prepare('SELECT * FROM ui_audits WHERE project_id = ? ORDER BY created_at DESC');
    return stmt.all(projectId) as unknown as UIAuditRecord[];
  }
}

// ---------------------------------------------------------------------------
// AST Components Repository
// ---------------------------------------------------------------------------
export class ASTComponentsRepository {
  constructor(private readonly db: OmniDatabase = getDatabase()) {}

  public create(comp: ASTComponentRecord): void {
    const stmt = this.db.db.prepare(`
      INSERT INTO ast_components (id, project_id, file_path, component_name, props_schema_json, exports, dependencies, docstring, preview_route)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
    `);
    stmt.run(
      comp.id,
      comp.project_id,
      comp.file_path,
      comp.component_name,
      comp.props_schema_json,
      comp.exports,
      comp.dependencies,
      comp.docstring ?? null,
      comp.preview_route ?? null
    );
  }

  public listByProject(projectId: string): ASTComponentRecord[] {
    const stmt = this.db.db.prepare('SELECT * FROM ast_components WHERE project_id = ?');
    return stmt.all(projectId) as unknown as ASTComponentRecord[];
  }
}

