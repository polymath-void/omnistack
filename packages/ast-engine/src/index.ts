/**
 * @omnistack/ast-engine
 * High-speed AST parsing, Props schema introspection, deterministic mock synthesis,
 * living MDX documentation compilation, and non-destructive Recast patching.
 */

import type { ASTComponentMetadata } from '@omnistack/types';
import { extractComponentMetadata } from './type-extractor.js';

export const AST_ENGINE_VERSION = '1.0.0';

// 1. SWC Parser & Visitor
export {
  type SWCParseOptions,
  type ImportSpecifierInfo,
  type ExtractedImport,
  type ExtractedExport,
  type ASTVisitor,
  resolveParseOptions,
  parseSourceSync,
  parseSource,
  traverseAST,
  extractImports,
  extractExports,
  extractJSXTags,
  parseFilesBatched,
} from './parser.js';

// 2. Type Extractor & React Props Introspection
export {
  type ExtractedComponentInfo,
  type TypeExtractorOptions,
  createInMemoryProject,
  extractComponentsFromSource,
  extractComponentMetadata,
  extractComponentMetadataBatched,
} from './type-extractor.js';

// 3. Deterministic Mock Generator (Faker.js)
export {
  type MockGeneratorOptions,
  type MockFixtureVariant,
  hashStringToSeed,
  seedFaker,
  generateMockValueForProp,
  generateMockProps,
  generateMinimalMockProps,
  generateExhaustiveMockProps,
  generateMockVariants,
  formatPropsAsJSXAttributes,
  formatPropsAsJSON,
} from './mock-generator.js';

// 4. Non-Destructive Recast Patcher & Sentinel Isolation
export {
  MANAGED_START_SENTINEL,
  MANAGED_END_SENTINEL,
  MANAGED_BLOCK_REGEX,
  type ManagedPatchOptions,
  type ManagedPatchResult,
  type TailwindPatchDirective,
  type RecastPatchResult,
  createBabelRecastParser,
  hasManagedBlock,
  extractManagedBlock,
  patchManagedBlock,
  patchWithRecast,
  patchTailwindClasses,
  patchNamedExport,
} from './patcher.js';

// 5. Component Dependency Graph (DAG & Cycles)
export {
  type DependencyGraphSummary,
  ComponentDependencyGraph,
  buildComponentDependencyGraph,
} from './dependency-graph.js';

// 6. Living Docs & Playground Generator
export {
  type LivingDocsManifestItem,
  type LivingDocsManifest,
  formatPropsTableMarkdown,
  generateComponentMDX,
  compileComponentMDX,
  generatePlaygroundHTML,
  renderPlaygroundHTML,
  generateLivingDocsManifest,
} from './docgen.js';

/**
 * Parses component outline returning full ASTComponentMetadata.
 */
export function parseComponentOutline(filePath: string, source = ''): ASTComponentMetadata {
  return extractComponentMetadata(filePath, source);
}
