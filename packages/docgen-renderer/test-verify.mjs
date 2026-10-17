import assert from 'node:assert';
import {
  DOCGEN_RENDERER_VERSION,
  generateComponentPlaygroundUrl,
  compileComponentMDX,
  renderPlaygroundHTML,
  generateComponentMDX,
  generatePlaygroundHTML,
} from './dist/index.js';

console.log('Testing @omnistack/docgen-renderer v' + DOCGEN_RENDERER_VERSION);
assert.ok(DOCGEN_RENDERER_VERSION);
assert.strictEqual(generateComponentMDX, compileComponentMDX);
assert.strictEqual(generatePlaygroundHTML, renderPlaygroundHTML);

// ---------------------------------------------------------------------------
// TEST 1: Playground URL Generation
// ---------------------------------------------------------------------------
const url = generateComponentPlaygroundUrl('HeroBanner');
assert.strictEqual(url, '/_forge/playground/HeroBanner');
const urlEncoded = generateComponentPlaygroundUrl('Fancy Button / Special');
assert.strictEqual(urlEncoded, '/_forge/playground/Fancy%20Button%20%2F%20Special');
console.log('✔ Test 1: generateComponentPlaygroundUrl Passed');

// ---------------------------------------------------------------------------
// TEST 2: compileComponentMDX with full props and enum pipes escaping
// ---------------------------------------------------------------------------
const buttonMeta = {
  id: 'comp_button',
  projectId: 'test_project',
  filePath: '/src/components/Button.tsx',
  componentName: 'Button',
  propsSchema: {
    label: { name: 'label', type: 'string', required: true, description: 'The text label displayed on button' },
    size: { name: 'size', type: "'sm' | 'md' | 'lg'", required: false, defaultValue: "'md'", enumOptions: ['sm', 'md', 'lg'], description: 'Button size variant' },
    disabled: { name: 'disabled', type: 'boolean', required: false, defaultValue: 'false', description: 'Disables user click interactions' },
    onClick: { name: 'onClick', type: '() => void', required: false, description: 'Click event handler' }
  },
  exports: ['Button', 'ButtonProps'],
  dependencies: ['react', 'clsx'],
  docstring: 'Universal atomic button component supporting variants and accessibility states.'
};

const mdx = compileComponentMDX(buttonMeta, {
  label: 'Get Started Today',
  size: 'lg',
  disabled: false
});

// Frontmatter verification
assert.ok(mdx.includes('title: "Button"'));
assert.ok(mdx.includes('category: "Components"'));
assert.ok(mdx.includes('filePath: "/src/components/Button.tsx"'));
assert.ok(mdx.includes('previewRoute: "/_forge/playground/Button"'));
assert.ok(mdx.includes('exports: [Button, ButtonProps]'));
assert.ok(mdx.includes('dependencies: [react, clsx]'));

// Docstring and Heading
assert.ok(mdx.includes('# `<Button />`'));
assert.ok(mdx.includes('> Universal atomic button component supporting variants and accessibility states.'));

// Embedded Responsive Sandbox iframe
assert.ok(mdx.includes('<div className="forge-playground-container"'));
assert.ok(mdx.includes('src="/_forge/playground/Button"'));
assert.ok(mdx.includes('title="Button Live Interactive Playground"'));

// Usage Example
assert.ok(mdx.includes("import { Button } from '/src/components/Button.tsx';"));
assert.ok(mdx.includes('<Button label="Get Started Today" size="lg" disabled={false} />'));

// Escaped pipes in Props Table (CRITICAL: markdown tables must not break on |)
assert.ok(mdx.includes('| `size` | `"sm"` \\| `"md"` \\| `"lg"` | No | `\'md\'` | Button size variant |'));
assert.ok(mdx.includes('| `label` | `string` | **Yes** | — | The text label displayed on button |'));
assert.ok(mdx.includes('| `disabled` | `boolean` | No | `false` | Disables user click interactions |'));

// Mock fixture JSON
assert.ok(mdx.includes('"label": "Get Started Today"'));
assert.ok(mdx.includes('"size": "lg"'));
assert.ok(mdx.includes('"disabled": false'));
console.log('✔ Test 2: compileComponentMDX (Full Props, Table Pipes Escaping, Embedded Sandbox) Passed');

// ---------------------------------------------------------------------------
// TEST 3: compileComponentMDX with stateless component and fallback mock synthesis
// ---------------------------------------------------------------------------
const statelessMeta = {
  id: 'comp_divider',
  projectId: 'test_project',
  filePath: '/src/components/Divider.tsx',
  componentName: 'Divider',
  propsSchema: {},
  exports: ['Divider'],
  dependencies: ['react'],
  docstring: 'Simple horizontal visual separator.'
};

const statelessMdx = compileComponentMDX(statelessMeta);
assert.ok(statelessMdx.includes('*This component accepts no props (stateless / zero-props).*'));
assert.ok(statelessMdx.includes('<Divider />'));

// Test fallback mock synthesis when mockProps is omitted
const autoMockMdx = compileComponentMDX(buttonMeta);
assert.ok(autoMockMdx.includes('"label": "Label Value"'));
assert.ok(autoMockMdx.includes('"size": "md"'));
assert.ok(autoMockMdx.includes('"disabled": false'));
console.log('✔ Test 3: compileComponentMDX (Stateless & Auto Fallback Mock Synthesis) Passed');

// ---------------------------------------------------------------------------
// TEST 4: renderPlaygroundHTML Responsive Structure & Viewport Controls
// ---------------------------------------------------------------------------
const heroMeta = {
  id: 'comp_hero',
  projectId: 'test_project',
  filePath: '/src/components/Hero.tsx',
  componentName: 'Hero',
  propsSchema: {
    headline: { name: 'headline', type: 'string', required: true, defaultValue: 'Apex Tactile Keyboards', description: 'Hero main title' },
    subhead: { name: 'subhead', type: 'string', required: false, defaultValue: 'Precision CNC Machined Aluminum.', description: 'Subtitle text' },
    ctaText: { name: 'ctaText', type: 'string', required: false, defaultValue: 'Explore Drop', description: 'Primary action CTA' },
    itemCount: { name: 'itemCount', type: 'number', required: false, defaultValue: '42', description: 'Available inventory units' },
    theme: { name: 'theme', type: "'dark' | 'light'", required: false, defaultValue: "'dark'", enumOptions: ['dark', 'light'] },
    isActive: { name: 'isActive', type: 'boolean', required: false, defaultValue: 'true' }
  },
  exports: ['Hero'],
  dependencies: ['react', 'framer-motion']
};

const html = renderPlaygroundHTML(heroMeta, {
  headline: 'Autonomous Mechanical Studio',
  itemCount: 150,
  isActive: true,
  theme: 'dark'
});

// HTML5 & Meta viewport
assert.ok(html.includes('<!DOCTYPE html>'));
assert.ok(html.includes('<meta name="viewport" content="width=device-width, initial-scale=1.0">'));
assert.ok(html.includes('<title>Hero - OmniStack Component Playground</title>'));

// Responsive CSS Media Query
assert.ok(html.includes('@media (max-width: 860px)'));
assert.ok(html.includes('flex-direction: column-reverse;'));

// Viewport Switcher Toolbar
assert.ok(html.includes('id="vp_mobile"'));
assert.ok(html.includes('id="vp_tablet"'));
assert.ok(html.includes('id="vp_desktop"'));
assert.ok(html.includes('setViewport(\'mobile\')'));
assert.ok(html.includes('setViewport(\'tablet\')'));

// Prop Controls Generated
// 1. Text input for headline
assert.ok(html.includes('id="prop_headline"'));
assert.ok(html.includes('value="Autonomous Mechanical Studio"'));
// 2. Number input for itemCount
assert.ok(html.includes('type="number" id="prop_itemCount"'));
assert.ok(html.includes('value="150"'));
// 3. Dropdown select for theme enum
assert.ok(html.includes('<select id="prop_theme"'));
assert.ok(html.includes('<option value="dark" selected>dark</option>'));
assert.ok(html.includes('<option value="light" >light</option>'));
// 4. Toggle switch for isActive boolean
assert.ok(html.includes('type="checkbox" id="prop_isActive" checked'));

// Live preview elements
assert.ok(html.includes('id="stageContainer"'));
assert.ok(html.includes('id="disp_headline"'));
assert.ok(html.includes('id="disp_subhead"'));
assert.ok(html.includes('id="disp_cta"'));
assert.ok(html.includes('id="disp_pills"'));
assert.ok(html.includes('id="codeSnapshot"'));
assert.ok(html.includes('id="eventLog"'));

// Bidirectional postMessage sync
assert.ok(html.includes('type: \'OMNISTACK_PLAYGROUND_PROPS\''));
assert.ok(html.includes('e.data.type === \'SET_PROPS\''));
assert.ok(html.includes('e.data.type === \'SET_VIEWPORT\''));
console.log('✔ Test 4: renderPlaygroundHTML (Responsive Layout, Viewports, Prop Controls, postMessage) Passed');

// ---------------------------------------------------------------------------
// TEST 5: Callback Controls in renderPlaygroundHTML
// ---------------------------------------------------------------------------
const callbackHtml = renderPlaygroundHTML(buttonMeta);
assert.ok(callbackHtml.includes("triggerCallback('onClick')"));
assert.ok(callbackHtml.includes("Trigger onClick()"));
console.log('✔ Test 5: renderPlaygroundHTML (Interactive Callback Buttons) Passed');

console.log('\n======================================================');
console.log('ALL DOCGEN-RENDERER TESTS PASSED CLEANLY (100% SUCCESS)');
console.log('======================================================');
