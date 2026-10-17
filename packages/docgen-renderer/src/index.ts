/**
 * @omnistack/docgen-renderer
 * Living MDX documentation compiler and Zero-Config embeddable component playground.
 */

import type { ASTComponentMetadata, ASTPropDefinition } from '@omnistack/types';

export type { ASTComponentMetadata, ASTPropDefinition };
export const DOCGEN_RENDERER_VERSION = '1.2.0';

/**
 * Generates the preview route URL for a given component playground.
 */
export function generateComponentPlaygroundUrl(componentName: string): string {
  return `/_forge/playground/${encodeURIComponent(componentName)}`;
}

/**
 * Synthesizes deterministic fallback mock props when none are provided.
 */
function synthesizeFallbackMockProps(propsSchema: Record<string, ASTPropDefinition>): Record<string, unknown> {
  const result: Record<string, unknown> = {};
  for (const [name, def] of Object.entries(propsSchema)) {
    if (def.defaultValue !== undefined) {
      const cleanVal = def.defaultValue.replace(/^['"]|['"]$/g, '');
      if (def.type === 'boolean') {
        result[name] = cleanVal === 'true';
      } else if (def.type === 'number') {
        const num = Number(cleanVal);
        result[name] = isNaN(num) ? 0 : num;
      } else {
        result[name] = cleanVal;
      }
    } else if (def.enumOptions && def.enumOptions.length > 0) {
      result[name] = def.enumOptions[0];
    } else if (def.type === 'boolean') {
      result[name] = true;
    } else if (def.type === 'number') {
      result[name] = 42;
    } else if (def.type.includes('=>') || def.type.includes('()')) {
      result[name] = `() => console.log('${name} called')`;
    } else {
      result[name] = `${name.charAt(0).toUpperCase() + name.slice(1)} Value`;
    }
  }
  return result;
}

/**
 * Compiles ASTComponentMetadata into rich, living MDX documentation.
 * Escapes markdown table pipes, embeds responsive iframe sandboxes, and outputs deterministic fixtures.
 */
export function compileComponentMDX(meta: ASTComponentMetadata, mockProps?: Record<string, unknown>): string {
  const props = Object.entries(meta.propsSchema ?? {});

  const rows = props.map(([name, schema]) => {
    const isRequired = schema.required ? '**Yes**' : 'No';
    const defaultValue = schema.defaultValue ? `\`${schema.defaultValue}\`` : '—';
    const escapedType = schema.enumOptions && schema.enumOptions.length > 0
      ? schema.enumOptions.map((opt) => `\`"${opt}"\``).join(' \\| ')
      : `\`${schema.type.replace(/\|/g, '\\|')}\``;
    const description = schema.description ? schema.description.replace(/\|/g, '\\|').replace(/\n/g, ' ') : '—';
    return `| \`${name}\` | ${escapedType} | ${isRequired} | ${defaultValue} | ${description} |`;
  }).join('\n');

  const propsTable = props.length > 0
    ? `| Prop | Type | Required | Default | Description |
| :--- | :--- | :---: | :--- | :--- |
${rows}`
    : '*This component accepts no props (stateless / zero-props).*';

  const resolvedMockProps = mockProps ?? synthesizeFallbackMockProps(meta.propsSchema ?? {});
  const mockSnippet = JSON.stringify(resolvedMockProps, null, 2);

  const jsxAttrs = Object.entries(resolvedMockProps)
    .filter(([_, v]) => typeof v !== 'function')
    .map(([k, v]) => {
      if (typeof v === 'string') return `${k}="${v}"`;
      if (typeof v === 'boolean') return v ? k : `${k}={false}`;
      return `${k}={${JSON.stringify(v)}}`;
    })
    .join(' ');

  const previewUrl = generateComponentPlaygroundUrl(meta.componentName);
  const exportsList = (meta.exports && meta.exports.length > 0) ? meta.exports.join(', ') : meta.componentName;
  const depsList = (meta.dependencies && meta.dependencies.length > 0) ? meta.dependencies.join(', ') : 'react';

  return `---
title: "${meta.componentName}"
category: "Components"
filePath: "${meta.filePath}"
previewRoute: "${previewUrl}"
exports: [${exportsList}]
dependencies: [${depsList}]
---

# \`<${meta.componentName} />\`

${meta.docstring ? `> ${meta.docstring}\n` : '> Living interactive documentation automatically compiled from component AST.\n'}

---

## 🚀 Live Interactive Playground

<div className="forge-playground-container" style={{ margin: '24px 0', border: '1px solid #27272a', borderRadius: '12px', overflow: 'hidden', background: '#09090b' }}>
  <iframe
    src="${previewUrl}"
    title="${meta.componentName} Live Interactive Playground"
    style={{ width: '100%', height: '520px', border: 0 }}
    loading="lazy"
  />
</div>

> Open isolated fullscreen sandbox: [${previewUrl}](${previewUrl})

---

## 💻 Usage Example

\`\`\`tsx
import { ${meta.componentName} } from '${meta.filePath}';

export default function Example() {
  return (
    <${meta.componentName}${jsxAttrs ? ` ${jsxAttrs}` : ''} />
  );
}
\`\`\`

---

## 📦 Component Props Specification

${propsTable}

---

## 🧪 Deterministic Mock Fixture

\`\`\`json
${mockSnippet}
\`\`\`
`;
}

/**
 * Generates an isolated, self-contained HTML page that renders the component
 * with live responsive prop controls (inputs, checkboxes, selects, number steppers),
 * mobile/tablet/desktop viewport switcher, and bidirectional postMessage sync.
 */
export function renderPlaygroundHTML(meta: ASTComponentMetadata, initialProps: Record<string, unknown> = {}): string {
  const resolvedProps = {
    ...synthesizeFallbackMockProps(meta.propsSchema ?? {}),
    ...initialProps,
  };
  const propsEntries = Object.entries(meta.propsSchema ?? {});

  const controlsHtml = propsEntries.map(([name, schema]) => {
    const rawVal = resolvedProps[name] !== undefined ? resolvedProps[name] : (schema.defaultValue ?? '');
    const val = String(rawVal);
    const escapedVal = val.replace(/"/g, '&quot;');

    // 1. Enum options or string union dropdown
    if (schema.enumOptions && schema.enumOptions.length > 0) {
      const optionsHtml = schema.enumOptions.map((opt) => {
        const isSelected = String(rawVal) === opt ? 'selected' : '';
        return `<option value="${opt}" ${isSelected}>${opt}</option>`;
      }).join('');

      return `
        <div class="prop-control">
          <div class="prop-label-row">
            <label class="prop-label" for="prop_${name}">${name}</label>
            <span class="prop-badge">select</span>
          </div>
          <select id="prop_${name}" class="prop-select" onchange="updatePreview()">
            ${optionsHtml}
          </select>
          ${schema.description ? `<p class="prop-desc">${schema.description}</p>` : ''}
        </div>
      `;
    }

    // 2. Boolean checkbox/toggle
    if (schema.type === 'boolean') {
      const isChecked = rawVal === true || val === 'true' ? 'checked' : '';
      return `
        <div class="prop-control">
          <div class="prop-label-row">
            <label class="prop-label" for="prop_${name}">${name}</label>
            <span class="prop-badge">boolean</span>
          </div>
          <label class="toggle-switch">
            <input type="checkbox" id="prop_${name}" ${isChecked} onchange="updatePreview()">
            <span class="toggle-slider"></span>
          </label>
          ${schema.description ? `<p class="prop-desc">${schema.description}</p>` : ''}
        </div>
      `;
    }

    // 3. Number input
    if (schema.type === 'number') {
      return `
        <div class="prop-control">
          <div class="prop-label-row">
            <label class="prop-label" for="prop_${name}">${name}</label>
            <span class="prop-badge">number</span>
          </div>
          <input type="number" id="prop_${name}" class="prop-input" value="${escapedVal}" oninput="updatePreview()">
          ${schema.description ? `<p class="prop-desc">${schema.description}</p>` : ''}
        </div>
      `;
    }

    // 4. Function / Callback trigger
    if (schema.type.includes('=>') || schema.type.includes('()')) {
      return `
        <div class="prop-control">
          <div class="prop-label-row">
            <label class="prop-label">${name}</label>
            <span class="prop-badge">callback</span>
          </div>
          <button type="button" class="btn-action" onclick="triggerCallback('${name}')">Trigger ${name}()</button>
          ${schema.description ? `<p class="prop-desc">${schema.description}</p>` : ''}
        </div>
      `;
    }

    // 5. Default text input
    return `
      <div class="prop-control">
        <div class="prop-label-row">
          <label class="prop-label" for="prop_${name}">${name}</label>
          <span class="prop-type">(${schema.type})</span>
        </div>
        <input type="text" id="prop_${name}" class="prop-input" value="${escapedVal}" oninput="updatePreview()">
        ${schema.description ? `<p class="prop-desc">${schema.description}</p>` : ''}
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
      --surface: #121215;
      --border: #27272a;
      --text: #f4f4f5;
      --muted: #a1a1aa;
      --accent: #3b82f6;
      --accent-hover: #2563eb;
      --success: #10b981;
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
      padding: 10px 16px;
      border-bottom: 1px solid var(--border);
      display: flex;
      align-items: center;
      justify-content: space-between;
      background: #000;
      flex-wrap: wrap;
      gap: 8px;
    }
    .header-left { display: flex; align-items: center; gap: 10px; }
    .header h1 { font-size: 14px; font-weight: 700; color: #fff; }
    .badge {
      background: #1e293b;
      color: #38bdf8;
      font-size: 11px;
      padding: 2px 8px;
      border-radius: 999px;
      font-weight: 600;
    }
    .viewport-toolbar {
      display: flex;
      align-items: center;
      background: var(--card-bg);
      border: 1px solid var(--border);
      border-radius: 6px;
      overflow: hidden;
    }
    .vp-btn {
      background: transparent;
      border: none;
      color: var(--muted);
      padding: 5px 10px;
      font-size: 11px;
      font-weight: 600;
      cursor: pointer;
      display: flex;
      align-items: center;
      gap: 4px;
      transition: all 0.15s ease;
    }
    .vp-btn:hover { color: #fff; background: rgba(255,255,255,0.05); }
    .vp-btn.active { background: var(--accent); color: #fff; }
    .status-indicator {
      display: flex;
      align-items: center;
      gap: 6px;
      font-size: 11px;
      color: var(--success);
      font-weight: 500;
    }
    .status-dot {
      width: 7px;
      height: 7px;
      border-radius: 50%;
      background: var(--success);
      box-shadow: 0 0 8px var(--success);
    }
    .workspace {
      display: flex;
      flex: 1;
      overflow: hidden;
    }
    .sidebar {
      width: 320px;
      border-right: 1px solid var(--border);
      background: var(--surface);
      padding: 16px;
      overflow-y: auto;
      flex-shrink: 0;
    }
    .sidebar-header {
      display: flex;
      align-items: center;
      justify-content: space-between;
      margin-bottom: 16px;
    }
    .sidebar h2 {
      font-size: 11px;
      font-weight: 700;
      text-transform: uppercase;
      color: var(--muted);
      letter-spacing: 0.05em;
    }
    .btn-reset {
      background: transparent;
      border: 1px solid var(--border);
      color: var(--muted);
      border-radius: 4px;
      font-size: 10px;
      padding: 3px 6px;
      cursor: pointer;
    }
    .btn-reset:hover { color: #fff; border-color: var(--muted); }
    .prop-control { margin-bottom: 14px; }
    .prop-label-row {
      display: flex;
      align-items: center;
      justify-content: space-between;
      margin-bottom: 5px;
    }
    .prop-label { font-size: 12px; font-weight: 600; color: #fff; }
    .prop-type { color: var(--muted); font-size: 10px; }
    .prop-badge {
      font-size: 10px;
      padding: 1px 5px;
      border-radius: 4px;
      background: #27272a;
      color: #38bdf8;
      font-family: monospace;
    }
    .prop-desc { font-size: 10px; color: var(--muted); margin-top: 4px; }
    .prop-input, .prop-select {
      width: 100%;
      background: var(--card-bg);
      border: 1px solid var(--border);
      color: #fff;
      padding: 7px 10px;
      border-radius: 6px;
      font-size: 12px;
      outline: none;
      transition: border-color 0.15s ease;
    }
    .prop-input:focus, .prop-select:focus { border-color: var(--accent); }
    .toggle-switch {
      position: relative;
      display: inline-block;
      width: 38px;
      height: 20px;
    }
    .toggle-switch input { opacity: 0; width: 0; height: 0; }
    .toggle-slider {
      position: absolute;
      cursor: pointer;
      top: 0; left: 0; right: 0; bottom: 0;
      background-color: var(--border);
      transition: 0.2s;
      border-radius: 20px;
    }
    .toggle-slider:before {
      position: absolute;
      content: "";
      height: 14px;
      width: 14px;
      left: 3px;
      bottom: 3px;
      background-color: white;
      transition: 0.2s;
      border-radius: 50%;
    }
    input:checked + .toggle-slider { background-color: var(--accent); }
    input:checked + .toggle-slider:before { transform: translateX(18px); }
    .btn-action {
      width: 100%;
      padding: 6px 12px;
      background: #27272a;
      border: 1px solid var(--border);
      border-radius: 6px;
      color: #38bdf8;
      font-size: 11px;
      font-weight: 600;
      cursor: pointer;
      transition: background 0.15s ease;
    }
    .btn-action:hover { background: #3f3f46; color: #fff; }
    .stage {
      flex: 1;
      display: flex;
      flex-direction: column;
      align-items: center;
      justify-content: center;
      background: radial-gradient(circle at 50% 50%, #18181b 0%, #09090b 100%);
      padding: 24px;
      overflow: auto;
      transition: all 0.25s ease;
    }
    .stage-container {
      width: 100%;
      max-width: 680px;
      display: flex;
      flex-direction: column;
      align-items: center;
      transition: max-width 0.3s ease;
    }
    .preview-card {
      background: var(--card-bg);
      border: 1px solid var(--border);
      border-radius: 12px;
      padding: 28px;
      width: 100%;
      box-shadow: 0 20px 40px rgba(0,0,0,0.5);
      position: relative;
    }
    .preview-header-row {
      display: flex;
      align-items: center;
      justify-content: space-between;
      margin-bottom: 8px;
    }
    .preview-tag {
      font-size: 10px;
      text-transform: uppercase;
      letter-spacing: 0.05em;
      font-weight: 700;
      color: var(--accent);
      background: rgba(59, 130, 246, 0.1);
      padding: 2px 8px;
      border-radius: 4px;
    }
    .preview-card h2 { font-size: 20px; font-weight: 700; color: #fff; margin-bottom: 8px; }
    .preview-card p { color: var(--muted); font-size: 13px; line-height: 1.5; margin-bottom: 18px; }
    .preview-btn {
      padding: 9px 18px;
      background: var(--accent);
      color: #fff;
      border: none;
      border-radius: 6px;
      font-size: 13px;
      font-weight: 600;
      cursor: pointer;
      transition: background 0.15s ease, opacity 0.15s ease;
    }
    .preview-btn:hover { background: var(--accent-hover); }
    .preview-btn:disabled { opacity: 0.4; cursor: not-allowed; }
    .props-badge-grid {
      display: flex;
      flex-wrap: wrap;
      gap: 6px;
      margin-top: 18px;
      padding-top: 14px;
      border-top: 1px solid var(--border);
    }
    .prop-pill {
      font-family: monospace;
      font-size: 11px;
      background: #09090b;
      border: 1px solid var(--border);
      padding: 2px 7px;
      border-radius: 4px;
      color: #a1a1aa;
    }
    .prop-pill strong { color: #38bdf8; font-weight: 600; }
    .preview-code-wrap {
      width: 100%;
      margin-top: 16px;
      position: relative;
    }
    .preview-code {
      background: #000;
      border: 1px solid var(--border);
      padding: 10px 14px;
      border-radius: 8px;
      font-family: "SF Mono", Monaco, Consolas, monospace;
      font-size: 11px;
      color: #38bdf8;
      overflow-x: auto;
      white-space: pre-wrap;
      word-break: break-all;
    }
    .event-log {
      width: 100%;
      margin-top: 10px;
      background: rgba(0,0,0,0.4);
      border: 1px dashed var(--border);
      border-radius: 6px;
      padding: 6px 10px;
      font-size: 10px;
      font-family: monospace;
      color: var(--muted);
      max-height: 50px;
      overflow-y: auto;
    }

    /* Responsive adjustments for mobile/tablet */
    @media (max-width: 860px) {
      body {
        height: auto;
        min-height: 100vh;
        overflow-y: auto;
      }
      .workspace {
        flex-direction: column-reverse;
        overflow: visible;
      }
      .sidebar {
        width: 100%;
        border-right: none;
        border-top: 1px solid var(--border);
        max-height: 400px;
      }
      .stage {
        padding: 16px;
        min-height: 380px;
      }
      .preview-card {
        padding: 20px;
      }
      .stage-container {
        max-width: 100% !important;
      }
    }
  </style>
</head>
<body>
  <div class="header">
    <div class="header-left">
      <h1>&lt;${meta.componentName} /&gt;</h1>
      <span class="badge">OmniStack Playground</span>
    </div>
    <div class="viewport-toolbar">
      <button class="vp-btn" id="vp_mobile" onclick="setViewport('mobile')">📱 390px</button>
      <button class="vp-btn" id="vp_tablet" onclick="setViewport('tablet')">📱 768px</button>
      <button class="vp-btn active" id="vp_desktop" onclick="setViewport('desktop')">💻 100%</button>
    </div>
    <div class="status-indicator">
      <span class="status-dot"></span>
      <span>Live Sync</span>
    </div>
  </div>

  <div class="workspace">
    <div class="sidebar">
      <div class="sidebar-header">
        <h2>Props Inspector</h2>
        <button class="btn-reset" onclick="resetProps()">Reset</button>
      </div>
      ${controlsHtml || '<p style="color:var(--muted);font-size:12px;">No configurable props for this component.</p>'}
    </div>

    <div class="stage">
      <div class="stage-container" id="stageContainer">
        <div class="preview-card" id="renderContainer">
          <div class="preview-header-row">
            <span class="preview-tag">${meta.componentName}</span>
            <span style="font-size:11px;color:var(--muted);" id="disp_status">Mounted</span>
          </div>
          <h2 id="disp_headline">${meta.componentName} Live Preview</h2>
          <p id="disp_subhead">Interact with props in the sidebar to test reactive rendering.</p>
          <button class="preview-btn" id="disp_cta" onclick="handleComponentClick()">Action</button>
          <div class="props-badge-grid" id="disp_pills"></div>
        </div>

        <div class="preview-code-wrap">
          <div class="preview-code" id="codeSnapshot">&lt;${meta.componentName} /&gt;</div>
        </div>

        <div class="event-log" id="eventLog">Ready: Listening for interaction events...</div>
      </div>
    </div>
  </div>

  <script>
    const defaultProps = ${JSON.stringify(resolvedProps)};
    let activeProps = { ...defaultProps };

    function logEvent(msg) {
      const el = document.getElementById('eventLog');
      if (el) {
        const time = new Date().toLocaleTimeString();
        el.innerText = '[' + time + '] ' + msg;
      }
    }

    function setViewport(mode) {
      const stage = document.getElementById('stageContainer');
      document.querySelectorAll('.vp-btn').forEach(b => b.classList.remove('active'));

      if (mode === 'mobile') {
        stage.style.maxWidth = '390px';
        document.getElementById('vp_mobile').classList.add('active');
        logEvent('Viewport changed to Mobile (390px)');
      } else if (mode === 'tablet') {
        stage.style.maxWidth = '768px';
        document.getElementById('vp_tablet').classList.add('active');
        logEvent('Viewport changed to Tablet (768px)');
      } else {
        stage.style.maxWidth = '100%';
        document.getElementById('vp_desktop').classList.add('active');
        logEvent('Viewport changed to Desktop (100% Fluid)');
      }
    }

    function triggerCallback(cbName) {
      logEvent('Triggered callback: ' + cbName + '()');
      if (window.parent) {
        window.parent.postMessage({
          type: 'OMNISTACK_PLAYGROUND_EVENT',
          component: '${meta.componentName}',
          event: cbName,
          timestamp: new Date().toISOString()
        }, '*');
      }
    }

    function handleComponentClick() {
      logEvent('Component Action Clicked: ' + (activeProps.ctaText || activeProps.label || 'Action'));
      if (window.parent) {
        window.parent.postMessage({
          type: 'OMNISTACK_PLAYGROUND_CLICK',
          component: '${meta.componentName}',
          props: activeProps
        }, '*');
      }
    }

    function updatePreview() {
      const props = {};
      ${propsEntries.map(([name, schema]) => {
        if (schema.enumOptions && schema.enumOptions.length > 0) {
          return `
            const el_${name} = document.getElementById('prop_${name}');
            if (el_${name}) props['${name}'] = el_${name}.value;
          `;
        }
        if (schema.type === 'boolean') {
          return `
            const el_${name} = document.getElementById('prop_${name}');
            if (el_${name}) props['${name}'] = el_${name}.checked;
          `;
        }
        if (schema.type === 'number') {
          return `
            const el_${name} = document.getElementById('prop_${name}');
            if (el_${name}) props['${name}'] = Number(el_${name}.value);
          `;
        }
        if (schema.type.includes('=>') || schema.type.includes('()')) {
          return `props['${name}'] = defaultProps['${name}'] || '[Function]';`;
        }
        return `
          const el_${name} = document.getElementById('prop_${name}');
          if (el_${name}) props['${name}'] = el_${name}.value;
        `;
      }).join('\n')}

      activeProps = props;

      // Dynamic reactive binding for common prop semantics
      const headline = props.headline || props.title || props.header || '${meta.componentName} Live Preview';
      const subhead = props.subhead || props.subtitle || props.description || props.caption || 'Interact with props in the sidebar to test reactive rendering.';
      const cta = props.ctaText || props.label || props.text || props.buttonText || 'Action';

      if (document.getElementById('disp_headline')) {
        document.getElementById('disp_headline').innerText = headline;
      }
      if (document.getElementById('disp_subhead')) {
        document.getElementById('disp_subhead').innerText = subhead;
      }
      if (document.getElementById('disp_cta')) {
        const btn = document.getElementById('disp_cta');
        btn.innerText = cta;
        btn.disabled = props.disabled === true || props.disabled === 'true';
      }

      // Render reactive prop pills
      const pillsContainer = document.getElementById('disp_pills');
      if (pillsContainer) {
        pillsContainer.innerHTML = Object.entries(props)
          .map(([k, v]) => '<span class="prop-pill"><strong>' + k + ':</strong> ' + (typeof v === 'object' ? JSON.stringify(v) : v) + '</span>')
          .join('');
      }

      // Render JSX snapshot
      const jsxAttrs = Object.entries(props)
        .map(([k, v]) => {
          if (typeof v === 'boolean') return v ? k : k + '={false}';
          if (typeof v === 'number') return k + '={' + v + '}';
          if (typeof v === 'string') return k + '="' + v + '"';
          return k + '={' + JSON.stringify(v) + '}';
        })
        .join(' ');

      document.getElementById('codeSnapshot').innerText = '<${meta.componentName}' + (jsxAttrs ? ' ' + jsxAttrs : '') + ' />';

      // Sync with parent frame
      if (window.parent) {
        window.parent.postMessage({
          type: 'OMNISTACK_PLAYGROUND_PROPS',
          component: '${meta.componentName}',
          props
        }, '*');
      }
    }

    function resetProps() {
      activeProps = { ...defaultProps };
      Object.entries(defaultProps).forEach(([k, v]) => {
        const el = document.getElementById('prop_' + k);
        if (el) {
          if (el.type === 'checkbox') el.checked = !!v;
          else el.value = v;
        }
      });
      updatePreview();
      logEvent('Props reset to defaults');
    }

    // Bidirectional postMessage listener
    window.addEventListener('message', (e) => {
      if (!e.data) return;
      if (e.data.type === 'SET_PROPS' && e.data.props) {
        Object.entries(e.data.props).forEach(([k, v]) => {
          const el = document.getElementById('prop_' + k);
          if (el) {
            if (el.type === 'checkbox') el.checked = !!v;
            else el.value = v;
          }
        });
        updatePreview();
        logEvent('Props synced via postMessage (SET_PROPS)');
      }
      if (e.data.type === 'SET_VIEWPORT' && e.data.viewport) {
        setViewport(e.data.viewport);
      }
    });

    // Initialize preview on mount
    updatePreview();
  </script>
</body>
</html>`;
}

// Aliases for unified interop with @omnistack/ast-engine
export const generateComponentMDX = compileComponentMDX;
export const generatePlaygroundHTML = renderPlaygroundHTML;
