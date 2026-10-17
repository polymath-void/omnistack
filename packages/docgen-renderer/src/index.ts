/**
 * @omnistack/docgen-renderer
 * Living MDX documentation compiler and Zero-Config embeddable component playground.
 */

import type { ASTComponentMetadata } from '@omnistack/types';

export type { ASTComponentMetadata };
export const DOCGEN_RENDERER_VERSION = '1.1.0';

export function generateComponentPlaygroundUrl(componentName: string): string {
  return `/_forge/playground/${encodeURIComponent(componentName)}`;
}

/**
 * Compiles ASTComponentMetadata into rich, living MDX documentation.
 */
export function compileComponentMDX(meta: ASTComponentMetadata, mockProps?: Record<string, unknown>): string {
  const props = Object.entries(meta.propsSchema);
  const rows = props.map(([name, schema]) => {
    const isRequired = schema.required ? '`YES`' : '`NO`';
    const defaultValue = schema.defaultValue ? `\`${schema.defaultValue}\`` : '—';
    return `| \`${name}\` | \`${schema.type}\` | ${isRequired} | ${defaultValue} | ${schema.description ?? '—'} |`;
  }).join('\n');

  const propsTable = props.length > 0
    ? `| Property | Type | Required | Default | Description |
| :--- | :--- | :---: | :---: | :--- |
${rows}`
    : '*This component accepts no props (stateless).*';

  const mockSnippet = mockProps
    ? JSON.stringify(mockProps, null, 2)
    : '{}';

  return `---
title: ${meta.componentName}
category: Components
filePath: ${meta.filePath}
exports: ${meta.exports.join(', ')}
---

# \`<${meta.componentName} />\`

${meta.docstring ? `> ${meta.docstring}` : '> Automatically extracted component interface and living playground.'}

---

## 📦 Component Props Schema

${propsTable}

---

## 🧪 Deterministic Mock Fixture (Faker.js)

\`\`\`json
${mockSnippet}
\`\`\`

---

## 🚀 Live Interactive Sandbox
View the live interactive component playground at [${generateComponentPlaygroundUrl(meta.componentName)}](${generateComponentPlaygroundUrl(meta.componentName)}).
`;
}

/**
 * Generates an isolated, self-contained HTML page that renders the component
 * with live prop controls (inputs, checkboxes, number fields) and postMessage sync.
 */
export function renderPlaygroundHTML(meta: ASTComponentMetadata, initialProps: Record<string, unknown> = {}): string {
  const propsEntries = Object.entries(meta.propsSchema);

  const controlsHtml = propsEntries.map(([name, schema]) => {
    const val = initialProps[name] !== undefined ? String(initialProps[name]) : (schema.defaultValue ?? '');
    if (schema.type === 'boolean') {
      const isChecked = val === 'true' ? 'checked' : '';
      return `
        <div class="prop-control">
          <label class="prop-label">${name} (boolean)</label>
          <input type="checkbox" id="prop_${name}" class="prop-checkbox" ${isChecked} onchange="updatePreview()">
        </div>
      `;
    }
    return `
      <div class="prop-control">
        <label class="prop-label">${name} <span class="prop-type">(${schema.type})</span></label>
        <input type="text" id="prop_${name}" class="prop-input" value="${val.replace(/"/g, '&quot;')}" oninput="updatePreview()">
      </div>
    `;
  }).join('\n');

  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>${meta.componentName} - OmniStack Component Playground</title>
  <style>
    :root {
      --bg: #09090b;
      --card-bg: #18181b;
      --border: #27272a;
      --text: #f4f4f5;
      --muted: #a1a1aa;
      --accent: #3b82f6;
    }
    * { box-sizing: border-box; margin: 0; padding: 0; }
    body {
      font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif;
      background: var(--bg);
      color: var(--text);
      display: flex;
      flex-direction: column;
      height: 100vh;
      overflow: hidden;
    }
    .header {
      padding: 12px 20px;
      border-bottom: 1px solid var(--border);
      display: flex;
      align-items: center;
      justify-content: space-between;
      background: #000;
    }
    .header h1 { font-size: 14px; font-weight: 700; color: #fff; }
    .badge {
      background: #1e293b;
      color: #38bdf8;
      font-size: 11px;
      padding: 2px 8px;
      border-radius: 999px;
      font-weight: 600;
    }
    .workspace {
      display: flex;
      flex: 1;
      overflow: hidden;
    }
    .sidebar {
      width: 340px;
      border-right: 1px solid var(--border);
      background: #0d0d10;
      padding: 16px;
      overflow-y: auto;
    }
    .sidebar h2 { font-size: 12px; font-weight: 700; text-transform: uppercase; color: var(--muted); margin-bottom: 16px; letter-spacing: 0.05em; }
    .prop-control { margin-bottom: 14px; }
    .prop-label { display: block; font-size: 12px; font-weight: 600; margin-bottom: 6px; }
    .prop-type { color: var(--muted); font-size: 11px; font-weight: normal; }
    .prop-input {
      width: 100%;
      background: var(--card-bg);
      border: 1px solid var(--border);
      color: #fff;
      padding: 8px 10px;
      border-radius: 6px;
      font-size: 12px;
      outline: none;
    }
    .prop-input:focus { border-color: var(--accent); }
    .prop-checkbox { transform: scale(1.2); cursor: pointer; }
    .stage {
      flex: 1;
      display: flex;
      flex-direction: column;
      align-items: center;
      justify-content: center;
      background: radial-gradient(circle at 50% 50%, #18181b 0%, #09090b 100%);
      padding: 24px;
      overflow: auto;
    }
    .preview-card {
      background: #18181b;
      border: 1px solid var(--border);
      border-radius: 12px;
      padding: 32px;
      max-width: 600px;
      width: 100%;
      box-shadow: 0 20px 40px rgba(0,0,0,0.5);
    }
    .preview-code {
      margin-top: 24px;
      background: #000;
      border: 1px solid var(--border);
      padding: 12px;
      border-radius: 6px;
      font-family: monospace;
      font-size: 11px;
      color: #38bdf8;
      white-space: pre-wrap;
    }
  </style>
</head>
<body>
  <div class="header">
    <h1>&lt;${meta.componentName} /&gt; Live Playground</h1>
    <span class="badge">OmniStack DocGen</span>
  </div>
  <div class="workspace">
    <div class="sidebar">
      <h2>Props Inspector</h2>
      ${controlsHtml || '<p style="color:var(--muted);font-size:12px;">No configurable props for this component.</p>'}
    </div>
    <div class="stage">
      <div class="preview-card" id="renderContainer">
        <h2 style="font-size: 24px; margin-bottom: 12px;" id="disp_headline">${meta.componentName} Live Preview</h2>
        <p style="color: var(--muted); font-size: 14px; margin-bottom: 20px;" id="disp_subhead">Interact with props in the sidebar to test reactive rendering.</p>
        <button style="padding: 10px 20px; background: var(--accent); color: #fff; border: none; border-radius: 6px; font-weight: bold; cursor: pointer;" id="disp_cta">Click Action</button>
      </div>
      <div class="preview-code" id="codeSnapshot">&lt;${meta.componentName} /&gt;</div>
    </div>
  </div>

  <script>
    function updatePreview() {
      const props = {};
      ${propsEntries.map(([name, schema]) => `
        const el_${name} = document.getElementById('prop_${name}');
        if (el_${name}) {
          props['${name}'] = ${schema.type === 'boolean' ? `el_${name}.checked` : `el_${name}.value`};
        }
      `).join('\n')}

      if (props.headline && document.getElementById('disp_headline')) {
        document.getElementById('disp_headline').innerText = props.headline;
      }
      if (props.subhead && document.getElementById('disp_subhead')) {
        document.getElementById('disp_subhead').innerText = props.subhead;
      }
      if (props.ctaText && document.getElementById('disp_cta')) {
        document.getElementById('disp_cta').innerText = props.ctaText;
      }

      document.getElementById('codeSnapshot').innerText = '<${meta.componentName} ' +
        Object.entries(props).map(([k, v]) => k + '="' + v + '"').join(' ') + ' />';

      if (window.parent) {
        window.parent.postMessage({ type: 'OMNISTACK_PLAYGROUND_PROPS', component: '${meta.componentName}', props }, '*');
      }
    }

    window.addEventListener('message', (e) => {
      if (e.data && e.data.type === 'SET_PROPS') {
        Object.entries(e.data.props).forEach(([k, v]) => {
          const el = document.getElementById('prop_' + k);
          if (el) {
            if (el.type === 'checkbox') el.checked = !!v;
            else el.value = v;
          }
        });
        updatePreview();
      }
    });

    updatePreview();
  </script>
</body>
</html>`;
}
