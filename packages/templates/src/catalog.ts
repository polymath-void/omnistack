/**
 * @omnistack/templates - Visual Store Design Catalog
 * 100 Distinct, High-Visual-Reasoning Production Store Templates
 * Separated into dedicated niche files under ./niches/
 */

export * from './types.js';
export * from './niches/index.js';
import { ALL_NICHE_TEMPLATES } from './niches/index.js';
import type { StoreTemplateItem } from './types.js';

/**
 * 100 High-Visual-Reasoning Templates Catalog
 */
export const TEMPLATES_CATALOG: StoreTemplateItem[] = ALL_NICHE_TEMPLATES;

// Backwards-compatibility alias
export const TEMPLATE_CATALOG = TEMPLATES_CATALOG;

/**
 * Get templates filtered by niche
 */
export function getTemplatesByNiche(nicheKey: string): StoreTemplateItem[] {
  return TEMPLATES_CATALOG.filter((t) => t.niche.toLowerCase() === nicheKey.toLowerCase());
}

/**
 * Get a specific template by ID
 */
export function getTemplateById(id: string): StoreTemplateItem | undefined {
  return TEMPLATES_CATALOG.find((t) => t.id === id);
}

/**
 * Search templates by name, tagline, or features
 */
export function searchTemplates(query: string): StoreTemplateItem[] {
  const q = query.toLowerCase();
  return TEMPLATES_CATALOG.filter(
    (t) =>
      t.name.toLowerCase().includes(q) ||
      t.tagline.toLowerCase().includes(q) ||
      t.nicheTitle.toLowerCase().includes(q) ||
      t.features.some((f) => f.toLowerCase().includes(q))
  );
}
