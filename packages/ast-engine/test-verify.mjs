import assert from 'node:assert';
import {
  AST_ENGINE_VERSION,
  parseSourceSync,
  traverseAST,
  extractImports,
  extractExports,
  extractJSXTags,
  parseFilesBatched,
  extractComponentMetadata,
  extractComponentMetadataBatched,
  generateMockProps,
  generateMinimalMockProps,
  generateExhaustiveMockProps,
  generateMockVariants,
  formatPropsAsJSXAttributes,
  formatPropsAsJSON,
  MANAGED_START_SENTINEL,
  MANAGED_END_SENTINEL,
  hasManagedBlock,
  extractManagedBlock,
  patchManagedBlock,
  patchTailwindClasses,
  patchNamedExport,
  ComponentDependencyGraph,
  buildComponentDependencyGraph,
  generateComponentMDX,
  generatePlaygroundHTML,
  generateLivingDocsManifest,
} from './dist/index.js';

console.log('Testing AST Engine version:', AST_ENGINE_VERSION);
assert.strictEqual(AST_ENGINE_VERSION, '1.0.0');

// 1. Parser tests
const sampleTSX = `
import React, { useState } from 'react';
import { Button } from './Button';

export interface CardProps {
  /** The title of the card */
  title: string;
  count?: number;
  variant?: 'primary' | 'secondary';
}

export function Card({ title, count = 0, variant = 'primary' }: CardProps) {
  const [open, setOpen] = useState(false);
  return (
    <div className="p-4 bg-white text-gray-400">
      <h1 className="text-xl">{title}</h1>
      <Button text="Click" />
    </div>
  );
}

export default Card;
`;

const ast = parseSourceSync(sampleTSX, undefined, 'Card.tsx');
assert.ok(ast);
assert.strictEqual(ast.type, 'Module');

const imports = extractImports(ast);
assert.strictEqual(imports.length, 2);
assert.strictEqual(imports[0].source, 'react');

const exportsList = extractExports(ast);
assert.ok(exportsList.some((e) => e.name === 'Card'));
assert.ok(exportsList.some((e) => e.name === 'CardProps' && e.isTypeOnly));

const tags = extractJSXTags(ast);
assert.ok(tags.includes('div'));
assert.ok(tags.includes('h1'));
assert.ok(tags.includes('Button'));
console.log('✔ Parser & Visitor: Passed');

// 2. Type Extractor tests
const meta = extractComponentMetadata('src/components/Card.tsx', sampleTSX);
assert.strictEqual(meta.componentName, 'Card');
assert.ok(meta.propsSchema.title);
assert.strictEqual(meta.propsSchema.title.type, 'string');
assert.strictEqual(meta.propsSchema.title.required, true);
assert.strictEqual(meta.propsSchema.title.description, 'The title of the card');

assert.ok(meta.propsSchema.count);
assert.strictEqual(meta.propsSchema.count.type, 'number');
assert.strictEqual(meta.propsSchema.count.required, false);
assert.strictEqual(meta.propsSchema.count.defaultValue, '0');

assert.ok(meta.propsSchema.variant);
assert.strictEqual(meta.propsSchema.variant.required, false);
assert.deepStrictEqual(meta.propsSchema.variant.enumOptions, ['primary', 'secondary']);
console.log('✔ Type Extractor & Props Schema: Passed');

// 3. Mock Generator tests
const mocks = generateMockProps(meta.propsSchema, { seed: 12345, componentName: 'Card' });
assert.ok(typeof mocks.title === 'string');
assert.ok(typeof mocks.count === 'number');
assert.ok(['primary', 'secondary'].includes(mocks.variant));

const minimalMocks = generateMinimalMockProps(meta.propsSchema, { seed: 12345 });
assert.ok(minimalMocks.title);
assert.strictEqual(minimalMocks.count, undefined);

const variants = generateMockVariants(meta.propsSchema, { seed: 12345 });
assert.ok(variants.length >= 3); // Default, variant: primary, variant: secondary

const jsxAttr = formatPropsAsJSXAttributes({ title: 'OmniStack', count: 10, open: true });
assert.ok(jsxAttr.includes('title="OmniStack"'));
assert.ok(jsxAttr.includes('count={10}'));
assert.ok(jsxAttr.includes('open'));
console.log('✔ Mock Generator (Faker.js): Passed');

// 4. Patcher tests
const codeWithoutSentinel = `
import React from 'react';

// Custom user code
export const Header = () => <header>Logo</header>;
`;

assert.strictEqual(hasManagedBlock(codeWithoutSentinel), false);

// Insert managed block
const patchedCreated = patchManagedBlock(
  codeWithoutSentinel,
  `export const ManagedBanner = () => <div>Auto Generated</div>;`,
  { insertPosition: 'after-imports' }
);
assert.strictEqual(patchedCreated.wasCreated, true);
assert.ok(hasManagedBlock(patchedCreated.code));
assert.ok(patchedCreated.code.includes(MANAGED_START_SENTINEL));
assert.ok(patchedCreated.code.includes(MANAGED_END_SENTINEL));

// Re-patch managed block
const rePatched = patchManagedBlock(
  patchedCreated.code,
  `export const ManagedBanner = () => <div>Updated Content</div>;`
);
assert.strictEqual(rePatched.wasCreated, false);
assert.strictEqual(rePatched.modified, true);
assert.ok(rePatched.code.includes('Updated Content'));
assert.ok(!rePatched.code.includes('Auto Generated'));
assert.ok(rePatched.code.includes('export const Header = () => <header>Logo</header>;'));

// Recast Tailwind class patch
const twPatch = patchTailwindClasses(
  `export function Btn() { return <button className="p-2 text-gray-400 bg-white">OK</button>; }`,
  [{ originalClasses: ['text-gray-400', 'bg-white'], replacementClasses: ['text-gray-800', 'bg-slate-100'] }]
);
assert.ok(twPatch.code.includes('text-gray-800 bg-slate-100'));
assert.ok(!twPatch.code.includes('text-gray-400'));
console.log('✔ Patcher & Sentinel Isolation: Passed');

// 5. Dependency Graph DAG tests
const dag = new ComponentDependencyGraph();
dag.addDependency('Dashboard', 'Card');
dag.addDependency('Card', 'Button');
assert.strictEqual(dag.isAcyclic(), true);
const order = dag.getTopologicalOrder();
assert.ok(order.indexOf('Dashboard') < order.indexOf('Card'));
assert.ok(order.indexOf('Card') < order.indexOf('Button'));

// Circular dependency check
dag.addDependency('Button', 'Dashboard');
assert.strictEqual(dag.isAcyclic(), false);
const cycles = dag.findCycles();
assert.ok(cycles.length > 0);
console.log('✔ Dependency Graph DAG & Cycle Detection: Passed');

// 6. DocGen & MDX Playground tests
const mdx = generateComponentMDX(meta, mocks);
assert.ok(mdx.includes('# Card'));
assert.ok(mdx.includes('previewRoute: "/_forge/playground/Card"'));
assert.ok(mdx.includes('| `title` | `string` | **Yes** |'));

const html = generatePlaygroundHTML(meta, mocks);
assert.ok(html.includes('data-component="Card"'));
assert.ok(html.includes('window.__FORGE_COMPONENT_META__'));

const manifest = generateLivingDocsManifest([meta]);
assert.strictEqual(manifest.components.length, 1);
assert.strictEqual(manifest.components[0].componentName, 'Card');
console.log('✔ Living Docs & MDX Playground: Passed');

console.log('\n===========================================');
console.log('ALL AST ENGINE TESTS PASSED CLEANLY (100%)');
console.log('===========================================');
