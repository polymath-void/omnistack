/**
 * @omnistack/db - SQLite Database Client Factory
 * Built on native node:sqlite DatabaseSync for zero external native binary dependencies.
 */

import { DatabaseSync } from 'node:sqlite';
import * as fs from 'node:fs';
import * as path from 'node:path';

export interface DatabaseConfig {
  dbPath?: string;
  walMode?: boolean;
  verbose?: boolean;
}

export class OmniDatabase {
  public readonly db: DatabaseSync;
  public readonly dbPath: string;

  constructor(config: DatabaseConfig = {}) {
    const rawPath = config.dbPath ?? process.env['OMNISTACK_DB_PATH'] ?? 'omnistack.db';
    this.dbPath = path.isAbsolute(rawPath) ? rawPath : path.resolve(process.cwd(), rawPath);

    const dir = path.dirname(this.dbPath);
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true });
    }

    this.db = new DatabaseSync(this.dbPath);

    if (config.walMode !== false) {
      try {
        this.db.exec('PRAGMA journal_mode = WAL;');
        this.db.exec('PRAGMA synchronous = NORMAL;');
        this.db.exec('PRAGMA foreign_keys = ON;');
      } catch {
        // In-memory or fallback mode
      }
    }

    this.initTables();
  }

  private initTables(): void {
    this.db.exec(`
      CREATE TABLE IF NOT EXISTS projects (
        id TEXT PRIMARY KEY,
        name TEXT NOT NULL,
        slug TEXT NOT NULL UNIQUE,
        description TEXT,
        prompt TEXT NOT NULL,
        stack_type TEXT NOT NULL,
        local_path TEXT NOT NULL,
        git_repo_url TEXT,
        status TEXT NOT NULL DEFAULT 'pending',
        created_at INTEGER NOT NULL,
        updated_at INTEGER NOT NULL
      );

      CREATE TABLE IF NOT EXISTS scaffold_jobs (
        id TEXT PRIMARY KEY,
        project_id TEXT NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
        current_step TEXT NOT NULL,
        progress_percent INTEGER NOT NULL DEFAULT 0,
        compilation_errors TEXT,
        healing_attempts INTEGER NOT NULL DEFAULT 0,
        artifact_zip_path TEXT,
        logs TEXT,
        created_at INTEGER NOT NULL,
        completed_at INTEGER
      );

      CREATE TABLE IF NOT EXISTS ast_components (
        id TEXT PRIMARY KEY,
        project_id TEXT NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
        file_path TEXT NOT NULL,
        component_name TEXT NOT NULL,
        props_schema_json TEXT NOT NULL,
        exports TEXT NOT NULL,
        dependencies TEXT NOT NULL,
        docstring TEXT,
        preview_route TEXT
      );

      CREATE TABLE IF NOT EXISTS ui_audits (
        id TEXT PRIMARY KEY,
        project_id TEXT NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
        viewport TEXT NOT NULL,
        screenshot_path TEXT NOT NULL,
        contrast_score INTEGER NOT NULL,
        responsive_score INTEGER NOT NULL,
        a11y_violations_count INTEGER NOT NULL,
        violations_json TEXT NOT NULL,
        patches_applied_json TEXT,
        created_at INTEGER NOT NULL
      );

      CREATE TABLE IF NOT EXISTS pr_reviews (
        id TEXT PRIMARY KEY,
        project_id TEXT NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
        pr_number INTEGER NOT NULL,
        title TEXT NOT NULL,
        author TEXT NOT NULL,
        diff_summary_json TEXT NOT NULL,
        screenshot_before TEXT,
        screenshot_after TEXT,
        verdict TEXT,
        feedback_text TEXT,
        reviewed_at INTEGER
      );

      CREATE TABLE IF NOT EXISTS swarm_blackboard (
        key TEXT PRIMARY KEY,
        owner_agent TEXT NOT NULL,
        revision INTEGER NOT NULL DEFAULT 1,
        ast_tree_json TEXT,
        diagnostics_json TEXT,
        lock_status TEXT NOT NULL DEFAULT 'UNLOCKED',
        locked_by TEXT,
        lock_expires_at INTEGER,
        updated_at INTEGER NOT NULL
      );

      CREATE TABLE IF NOT EXISTS products (
        id TEXT PRIMARY KEY,
        sku TEXT NOT NULL UNIQUE,
        title TEXT NOT NULL,
        description TEXT NOT NULL,
        price REAL NOT NULL,
        compare_at_price REAL,
        category TEXT NOT NULL,
        tags TEXT NOT NULL,
        stock_count INTEGER NOT NULL DEFAULT 0,
        low_stock_threshold INTEGER NOT NULL DEFAULT 5,
        image_url TEXT NOT NULL,
        is_active INTEGER NOT NULL DEFAULT 1,
        created_at INTEGER NOT NULL,
        updated_at INTEGER NOT NULL
      );

      CREATE TABLE IF NOT EXISTS coupons (
        code TEXT PRIMARY KEY,
        discount_type TEXT NOT NULL,
        discount_value REAL NOT NULL,
        min_cart_amount REAL NOT NULL DEFAULT 0,
        usage_limit INTEGER,
        times_used INTEGER NOT NULL DEFAULT 0,
        is_active INTEGER NOT NULL DEFAULT 1,
        created_at INTEGER NOT NULL
      );

      CREATE TABLE IF NOT EXISTS orders (
        order_id TEXT PRIMARY KEY,
        idempotency_key TEXT NOT NULL UNIQUE,
        customer_name TEXT NOT NULL,
        customer_email TEXT NOT NULL,
        total_amount REAL NOT NULL,
        currency TEXT NOT NULL DEFAULT 'USD',
        status TEXT NOT NULL,
        store_template_id TEXT NOT NULL,
        items_json TEXT NOT NULL,
        timeline_json TEXT NOT NULL,
        shipping_address TEXT,
        retry_count INTEGER NOT NULL DEFAULT 0,
        created_at INTEGER NOT NULL,
        updated_at INTEGER NOT NULL
      );

      CREATE TABLE IF NOT EXISTS idempotency_records (
        idempotency_key TEXT PRIMARY KEY,
        payload_hash TEXT NOT NULL,
        status TEXT NOT NULL,
        order_id TEXT,
        response_json TEXT,
        created_at INTEGER NOT NULL,
        expires_at INTEGER NOT NULL
      );
    `);
  }

  public close(): void {
    this.db.close();
  }
}

let globalDbInstance: OmniDatabase | null = null;

export function getDatabase(config?: DatabaseConfig): OmniDatabase {
  if (!globalDbInstance) {
    globalDbInstance = new OmniDatabase(config);
  }
  return globalDbInstance;
}

export function resetDatabaseForTesting(): OmniDatabase {
  if (globalDbInstance) {
    try {
      globalDbInstance.close();
    } catch {
      // Ignore
    }
  }
  globalDbInstance = new OmniDatabase({ dbPath: ':memory:' });
  return globalDbInstance;
}
