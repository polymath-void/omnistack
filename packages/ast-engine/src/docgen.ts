/**
 * @omnistack/ast-engine - docgen.ts
 * Interactive living MDX component documentation compiler.
 * Generates MDX documents, component prop tables, and isolated iframe sandbox templates
 * mounted at /_forge/playground/[componentName].
 */

import type { ASTComponentMetadata, ASTPropDefinition } from '@omnistack/types';
import { generateMockProps, formatPropsAsJSXAttributes, formatPropsAsJSON } from './mock-generator.js';

export interface LivingDocsManifestItem {
  id: string;
  componentName: string;
  filePath: string;
  previewRoute: string;
  docstring?: string;
  propsCount: number;
}

export interface LivingDocsManifest {
  projectId: string;
  generatedAt: string;
  components: LivingDocsManifestItem[];
}

/**
 * Formats props schema as a markdown table for MDX documentation.
 */
export function formatPropsTableMarkdown(propsSchema: Record<string, ASTPropDefinition>): string {
  const entries = Object.entries(propsSchema);
  if (entries.length === 0) {
    return '_This component does not accept any props (stateless / zero-props)._';
  }

  const rows: string[] = [
    '| Prop | Type | Required | Default | Description |',
    '| :--- | :--- | :---: | :--- | :--- |',
  ];

  for (const [name, def] of entries) {
    const requiredBadge = def.required ? '**Yes**' : 'No';
    const defaultValue = def.defaultValue ? `\`${def.defaultValue}\`` : '-';
    const description = def.description ? def.description.replace(/\n/g, ' ') : '-';
    let typeDisplay = `\`${def.type.replace(/\|/g, '\\|')}\``;

    if (def.enumOptions && def.enumOptions.length > 0) {
      typeDisplay = def.enumOptions.map((opt) => `\`"${opt}"\``).join(' \\| ');
    }

    rows.push(`| \`${name}\` | ${typeDisplay} | ${requiredBadge} | ${defaultValue} | ${description} |`);
  }

  return rows.join('\n');
}

/**
 * Compiles living MDX documentation for a component.
 */
export function generateComponentMDX(
  metadata: ASTComponentMetadata,
  customMockProps?: Record<string, unknown>
): string {
  const mockProps = customMockProps ?? generateMockProps(metadata.propsSchema, {
    componentName: metadata.componentName,
  });

  const jsxAttributes = formatPropsAsJSXAttributes(mockProps);
  const jsonFixtures = formatPropsAsJSON(mockProps, true);
  const propsTable = formatPropsTableMarkdown(metadata.propsSchema);
  const previewRoute = metadata.previewRoute ?? `/_forge/playground/${metadata.componentName}`;

  return `---
title: "${metadata.componentName}"
description: "${metadata.docstring ?? `Interactive living documentation for ${metadata.componentName}`}"
filePath: "${metadata.filePath}"
previewRoute: "${previewRoute}"
---

# ${metadata.componentName}

${metadata.docstring ? `> ${metadata.docstring}\n` : ''}

## Live Interactive Playground

<div className="forge-playground-container border rounded-xl overflow-hidden shadow-sm my-6">
  <iframe
    src="${previewRoute}"
    title="${metadata.componentName} Live Preview"
    className="w-full h-96 border-0 bg-background"
    loading="lazy"
  />
</div>

## Usage Example

\`\`\`tsx
import { ${metadata.componentName} } from '${metadata.filePath}';

export default function Example() {
  return (
    <${metadata.componentName} ${jsxAttributes} />
  );
}
\`\`\`

## Props Specification

${propsTable}

## Synthetic Mock Fixtures

\`\`\`json
${jsonFixtures}
\`\`\`
`;
}

/**
 * Generates an isolated iframe sandbox HTML template mounted at /_forge/playground/[componentName].
 */
export function generatePlaygroundHTML(
  metadata: ASTComponentMetadata,
  mockProps?: Record<string, unknown>
): string {
  const props = mockProps ?? generateMockProps(metadata.propsSchema, {
    componentName: metadata.componentName,
  });
  const serializedProps = JSON.stringify(props, null, 2);

  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>OmniStack Playground - ${metadata.componentName}</title>
  <script src="https://cdn.tailwindcss.com"></script>
  <style>
    body { margin: 0; font-family: ui-sans-serif, system-ui, sans-serif; }
    #playground-root { padding: 2rem; display: flex; justify-content: center; align-items: center; min-height: 100vh; }
    #props-inspector { position: fixed; bottom: 1rem; right: 1rem; background: rgba(0,0,0,0.85); color: #fff; padding: 0.75rem 1rem; border-radius: 0.5rem; font-size: 0.75rem; font-family: monospace; max-width: 320px; max-height: 200px; overflow: auto; }
  </style>
</head>
<body class="bg-slate-50 text-slate-900 antialiased">
  <div id="playground-root">
    <div id="component-mount" data-component="${metadata.componentName}">
      <!-- Component mounted by Forge runtime -->
    </div>
  </div>

  <div id="props-inspector">
    <div style="font-weight: bold; margin-bottom: 0.25rem;">Props Fixture</div>
    <pre id="props-json">${serializedProps}</pre>
  </div>

  <script>
    window.__FORGE_COMPONENT_META__ = ${JSON.stringify(metadata)};
    window.__FORGE_MOCK_PROPS__ = ${serializedProps};
  </script>
</body>
</html>`;
}

/**
 * Compiles a living docs catalog manifest for all components in the project.
 */
export function generateLivingDocsManifest(
  components: ASTComponentMetadata[],
  projectId = 'omnistack-project'
): LivingDocsManifest {
  const items: LivingDocsManifestItem[] = components.map((comp) => {
    const item: LivingDocsManifestItem = {
      id: comp.id,
      componentName: comp.componentName,
      filePath: comp.filePath,
      previewRoute: comp.previewRoute ?? `/_forge/playground/${comp.componentName}`,
      propsCount: Object.keys(comp.propsSchema).length,
    };
    if (comp.docstring !== undefined) {
      item.docstring = comp.docstring;
    }
    return item;
  });

  return {
    projectId,
    generatedAt: new Date().toISOString(),
    components: items,
  };
}
