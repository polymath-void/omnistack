import { sqliteTable, text, integer } from 'drizzle-orm/sqlite-core';

/**
 * Projects table: Stores top-level metadata for generated codebases
 */
export const projects = sqliteTable('projects', {
  id: text('id').primaryKey(),
  name: text('name').notNull(),
  slug: text('slug').notNull().unique(),
  description: text('description'),
  prompt: text('prompt').notNull(),
  stackType: text('stack_type').notNull(), // 'nextjs_fastapi' | 'prompt_to_store' | 'custom'
  localPath: text('local_path').notNull(),
  gitRepoUrl: text('git_repo_url'),
  status: text('status').notNull().default('pending'), // 'pending' | 'scaffolding' | 'auditing' | 'ready' | 'failed'
  createdAt: integer('created_at', { mode: 'timestamp' }).notNull(),
  updatedAt: integer('updated_at', { mode: 'timestamp' }).notNull(),
});

/**
 * Scaffold Jobs table: Tracks asynchronous generation and verification jobs
 */
export const scaffoldJobs = sqliteTable('scaffold_jobs', {
  id: text('id').primaryKey(),
  projectId: text('project_id')
    .notNull()
    .references(() => projects.id),
  currentStep: text('current_step').notNull(), // 'spec' | 'template' | 'ast' | 'compile' | 'vision' | 'done'
  progressPercent: integer('progress_percent').notNull().default(0),
  compilationErrors: text('compilation_errors'),
  healingAttempts: integer('healing_attempts').notNull().default(0),
  artifactZipPath: text('artifact_zip_path'),
  logs: text('logs'),
  createdAt: integer('created_at', { mode: 'timestamp' }).notNull(),
  completedAt: integer('completed_at', { mode: 'timestamp' }),
});

/**
 * AST Components table: Living catalog of components extracted via static analysis
 */
export const astComponents = sqliteTable('ast_components', {
  id: text('id').primaryKey(),
  projectId: text('project_id')
    .notNull()
    .references(() => projects.id),
  filePath: text('file_path').notNull(),
  componentName: text('component_name').notNull(),
  propsSchemaJson: text('props_schema_json').notNull(), // JSON-serialized prop types
  exports: text('exports').notNull(), // JSON array
  dependencies: text('dependencies').notNull(), // JSON array of imports
  docstring: text('docstring'),
  previewRoute: text('preview_route'),
});

/**
 * UI Audits table: Visual regression and accessibility audit results
 */
export const uiAudits = sqliteTable('ui_audits', {
  id: text('id').primaryKey(),
  projectId: text('project_id')
    .notNull()
    .references(() => projects.id),
  viewport: text('viewport').notNull(), // 'mobile' | 'tablet' | 'desktop'
  screenshotPath: text('screenshot_path').notNull(),
  contrastScore: integer('contrast_score').notNull(), // 0 - 100
  responsiveScore: integer('responsive_score').notNull(), // 0 - 100
  a11yViolationsCount: integer('a11y_violations_count').notNull(),
  violationsJson: text('violations_json').notNull(),
  patchesAppliedJson: text('patches_applied_json'),
  createdAt: integer('created_at', { mode: 'timestamp' }).notNull(),
});

/**
 * PR Reviews table: Tracks mobile PR review states, swipe gestures, and verdicts
 */
export const prReviews = sqliteTable('pr_reviews', {
  id: text('id').primaryKey(),
  projectId: text('project_id')
    .notNull()
    .references(() => projects.id),
  prNumber: integer('pr_number').notNull(),
  title: text('title').notNull(),
  author: text('author').notNull(),
  diffSummaryJson: text('diff_summary_json').notNull(),
  screenshotBefore: text('screenshot_before'),
  screenshotAfter: text('screenshot_after'),
  verdict: text('verdict'), // 'APPROVED' | 'CHANGES_REQUESTED' | 'DISMISSED'
  feedbackText: text('feedback_text'),
  reviewedAt: integer('reviewed_at', { mode: 'timestamp' }),
});

/**
 * Swarm Blackboard table: Shared memory and 2PC AST lock coordinator across agents
 */
export const swarmBlackboard = sqliteTable('swarm_blackboard', {
  key: text('key').primaryKey(),
  ownerAgent: text('owner_agent').notNull(),
  revision: integer('revision').notNull().default(1),
  astTreeJson: text('ast_tree_json'),
  diagnosticsJson: text('diagnostics_json'),
  lockStatus: text('lock_status').notNull().default('UNLOCKED'), // 'UNLOCKED' | 'LOCKED'
  lockedBy: text('locked_by'),
  lockExpiresAt: integer('lock_expires_at', { mode: 'timestamp' }),
  updatedAt: integer('updated_at', { mode: 'timestamp' }).notNull(),
});

// Type helpers for inference
export type Project = typeof projects.$inferSelect;
export type NewProject = typeof projects.$inferInsert;

export type ScaffoldJob = typeof scaffoldJobs.$inferSelect;
export type NewScaffoldJob = typeof scaffoldJobs.$inferInsert;

export type ASTComponent = typeof astComponents.$inferSelect;
export type NewASTComponent = typeof astComponents.$inferInsert;

export type UIAudit = typeof uiAudits.$inferSelect;
export type NewUIAudit = typeof uiAudits.$inferInsert;

export type PRReview = typeof prReviews.$inferSelect;
export type NewPRReview = typeof prReviews.$inferInsert;

export type SwarmBlackboardEntry = typeof swarmBlackboard.$inferSelect;
export type NewSwarmBlackboardEntry = typeof swarmBlackboard.$inferInsert;
