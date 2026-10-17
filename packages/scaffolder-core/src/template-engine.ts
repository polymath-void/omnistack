import { VirtualFileSystem, normalizeVirtualPath } from './virtual-fs.js';

export type TemplateHelperFn = (val: unknown, ...args: unknown[]) => string | boolean | unknown;

export interface TemplateEngineOptions {
  helpers?: Record<string, TemplateHelperFn> | undefined;
  slots?: Record<string, string> | undefined;
  delimiters?: [string, string] | undefined; // Default ['{{', '}}']
}

export interface RenderOptions {
  slots?: Record<string, string> | undefined;
  helpers?: Record<string, TemplateHelperFn> | undefined;
}

export interface VfsProcessOptions extends RenderOptions {
  pathFilter?: ((filePath: string) => boolean) | undefined;
  interpolateFileNames?: boolean | undefined;
}

// ---------------------------------------------------------------------------
// Case Helpers
// ---------------------------------------------------------------------------

export function toKebabCase(str: string): string {
  if (!str) return '';
  return str
    .replace(/([a-z0-9])([A-Z])/g, '$1-$2')
    .replace(/[_\s]+/g, '-')
    .toLowerCase()
    .replace(/^-+|-+$/g, '');
}

export function toCamelCase(str: string): string {
  if (!str) return '';
  const kebab = toKebabCase(str);
  return kebab.replace(/-([a-z0-9])/g, (_, ch) => ch.toUpperCase());
}

export function toPascalCase(str: string): string {
  if (!str) return '';
  const camel = toCamelCase(str);
  return camel.charAt(0).toUpperCase() + camel.slice(1);
}

export function toSnakeCase(str: string): string {
  if (!str) return '';
  return toKebabCase(str).replace(/-/g, '_');
}

export function toUpper(str: string): string {
  return String(str ?? '').toUpperCase();
}

export function toLower(str: string): string {
  return String(str ?? '').toLowerCase();
}

export function toJSON(val: unknown, space = 2): string {
  try {
    return JSON.stringify(val, null, space);
  } catch {
    return String(val);
  }
}

// ---------------------------------------------------------------------------
// AST Representation for Template Parsing
// ---------------------------------------------------------------------------

type AstNode =
  | { type: 'text'; value: string }
  | { type: 'var'; raw: string; helper?: string | undefined; path: string; fallback?: string | undefined }
  | { type: 'slot'; name: string; fallback: AstNode[] }
  | { type: 'if'; condition: string; isUnless: boolean; thenNodes: AstNode[]; elseNodes: AstNode[] }
  | { type: 'each'; listPath: string; itemName?: string | undefined; bodyNodes: AstNode[] };

/**
 * High-performance, zero-bloat template interpolation engine
 * Supporting dynamic variable replacement, conditional blocks, loops, and component slots.
 */
export class TemplateEngine {
  private helpers: Map<string, TemplateHelperFn> = new Map();
  private slots: Map<string, string> = new Map();

  constructor(options?: TemplateEngineOptions) {
    this.registerDefaultHelpers();

    if (options?.helpers) {
      for (const [name, fn] of Object.entries(options.helpers)) {
        this.helpers.set(name, fn);
      }
    }

    if (options?.slots) {
      for (const [name, content] of Object.entries(options.slots)) {
        this.slots.set(name, content);
      }
    }
  }

  private registerDefaultHelpers(): void {
    this.helpers.set('kebabCase', (val) => toKebabCase(String(val ?? '')));
    this.helpers.set('camelCase', (val) => toCamelCase(String(val ?? '')));
    this.helpers.set('pascalCase', (val) => toPascalCase(String(val ?? '')));
    this.helpers.set('snakeCase', (val) => toSnakeCase(String(val ?? '')));
    this.helpers.set('upper', (val) => toUpper(String(val ?? '')));
    this.helpers.set('lower', (val) => toLower(String(val ?? '')));
    this.helpers.set('json', (val) => toJSON(val));
    this.helpers.set('eq', (a, b) => a === b);
    this.helpers.set('ne', (a, b) => a !== b);
    this.helpers.set('not', (a) => !this.isTruthy(a));
  }

  /**
   * Registers a custom transformation helper function.
   */
  public registerHelper(name: string, fn: TemplateHelperFn): this {
    this.helpers.set(name, fn);
    return this;
  }

  /**
   * Registers a component slot content.
   */
  public registerSlot(name: string, content: string): this {
    this.slots.set(name, content);
    return this;
  }

  /**
   * Renders a template string against the provided data context and slots.
   */
  public render(
    template: string,
    context: Record<string, unknown> = {},
    options?: RenderOptions
  ): string {
    if (!template) return '';

    const effectiveSlots = new Map(this.slots);
    if (options?.slots) {
      for (const [k, v] of Object.entries(options.slots)) {
        effectiveSlots.set(k, v);
      }
    }

    const effectiveHelpers = new Map(this.helpers);
    if (options?.helpers) {
      for (const [k, v] of Object.entries(options.helpers)) {
        effectiveHelpers.set(k, v);
      }
    }

    const ast = this.parse(template);
    return this.evaluateNodes(ast, context, effectiveSlots, effectiveHelpers);
  }

  /**
   * Interpolates all files in a VirtualFileSystem using the template engine.
   * Also renames file paths if file paths contain variable placeholders (e.g. {{slug}}.tsx).
   */
  public renderVirtualFiles(
    vfs: VirtualFileSystem,
    context: Record<string, unknown>,
    options?: VfsProcessOptions
  ): { processedFiles: number; renamedFiles: number } {
    const files = vfs.listFiles('/');
    let processedFiles = 0;
    let renamedFiles = 0;

    const interpolateNames = options?.interpolateFileNames ?? true;

    for (const filePath of files) {
      if (options?.pathFilter && !options.pathFilter(filePath)) {
        continue;
      }

      // Check if file is text (not binary)
      const content = vfs.readFile(filePath, 'utf8');
      const renderedContent = this.render(content, context, options);

      let targetPath = filePath;
      if (interpolateNames && filePath.includes('{{')) {
        targetPath = normalizeVirtualPath(this.render(filePath, context, options));
        if (targetPath !== filePath) {
          vfs.unlink(filePath);
          renamedFiles++;
        }
      }

      vfs.writeFile(targetPath, renderedContent);
      processedFiles++;
    }

    return { processedFiles, renamedFiles };
  }

  // -------------------------------------------------------------------------
  // Parsing
  // -------------------------------------------------------------------------

  private parse(template: string): AstNode[] {
    const tagRegex = /\{\{([\s\S]*?)\}\}/g;
    const tokens: Array<
      | { type: 'text'; value: string }
      | { type: 'tag'; tag: string; raw: string }
    > = [];

    let lastIndex = 0;
    let match: RegExpExecArray | null;

    while ((match = tagRegex.exec(template)) !== null) {
      if (match.index > lastIndex) {
        tokens.push({
          type: 'text',
          value: template.substring(lastIndex, match.index),
        });
      }

      const tagContent = match[1]?.trim() ?? '';
      tokens.push({
        type: 'tag',
        tag: tagContent,
        raw: match[0],
      });

      lastIndex = tagRegex.lastIndex;
    }

    if (lastIndex < template.length) {
      tokens.push({
        type: 'text',
        value: template.substring(lastIndex),
      });
    }

    let tokenIndex = 0;

    const parseBlock = (stopAtTags: string[] = []): AstNode[] => {
      const nodes: AstNode[] = [];

      while (tokenIndex < tokens.length) {
        const token = tokens[tokenIndex];
        if (!token) break;

        if (token.type === 'text') {
          nodes.push({ type: 'text', value: token.value });
          tokenIndex++;
          continue;
        }

        const tag = token.tag;

        // Check if this tag closes our current block
        if (stopAtTags.some((prefix) => tag.startsWith(prefix))) {
          break;
        }

        // 1. #if or #unless block
        if (tag.startsWith('#if ') || tag.startsWith('#unless ')) {
          const isUnless = tag.startsWith('#unless ');
          const condition = tag.replace(/^#(if|unless)\s+/, '').trim();
          tokenIndex++; // consume opening tag

          const thenNodes = parseBlock(['else', '/if', '/unless']);
          let elseNodes: AstNode[] = [];

          if (tokenIndex < tokens.length) {
            const nextToken = tokens[tokenIndex];
            const nextTag = nextToken && nextToken.type === 'tag' ? nextToken.tag : '';
            if (nextTag === 'else') {
              tokenIndex++; // consume {{else}}
              elseNodes = parseBlock(['/if', '/unless']);
            }
          }

          if (tokenIndex < tokens.length) {
            tokenIndex++; // consume {{/if}} or {{/unless}}
          }

          nodes.push({
            type: 'if',
            condition,
            isUnless,
            thenNodes,
            elseNodes,
          });
          continue;
        }

        // 2. #slot block
        if (tag.startsWith('#slot ')) {
          const rawName = tag.replace(/^#slot\s+/, '').trim();
          const name = rawName.replace(/^['"]|['"]$/g, '');
          tokenIndex++; // consume #slot

          const fallback = parseBlock(['/slot']);

          if (tokenIndex < tokens.length) {
            tokenIndex++; // consume /slot
          }

          nodes.push({
            type: 'slot',
            name,
            fallback,
          });
          continue;
        }

        // 3. Single tag slot: {{slot "header"}} or {{slot:header}} or {{> header}}
        if (tag.startsWith('slot ') || tag.startsWith('slot:') || tag.startsWith('> ')) {
          let name = '';
          if (tag.startsWith('slot:')) {
            name = tag.substring(5).trim();
          } else if (tag.startsWith('slot ')) {
            name = tag.substring(5).trim().replace(/^['"]|['"]$/g, '');
          } else {
            name = tag.substring(2).trim().replace(/^['"]|['"]$/g, '');
          }
          tokenIndex++;
          nodes.push({
            type: 'slot',
            name,
            fallback: [],
          });
          continue;
        }

        // 4. #each loop: {{#each items}} or {{#each items as |item|}}
        if (tag.startsWith('#each ')) {
          const eachClause = tag.substring(6).trim();
          let listPath = eachClause;
          let itemName: string | undefined;

          const asMatch = eachClause.match(/^(.+?)\s+as\s+\|([a-zA-Z0-9_$]+)\|$/);
          if (asMatch && asMatch[1] && asMatch[2]) {
            listPath = asMatch[1].trim();
            itemName = asMatch[2].trim();
          }

          tokenIndex++; // consume #each
          const bodyNodes = parseBlock(['/each']);

          if (tokenIndex < tokens.length) {
            tokenIndex++; // consume /each
          }

          nodes.push({
            type: 'each',
            listPath,
            itemName,
            bodyNodes,
          });
          continue;
        }

        // 5. Variable or helper invocation: {{kebabCase name}} or {{name || "default"}}
        const varNode = this.parseVariableTag(tag);
        nodes.push(varNode);
        tokenIndex++;
      }

      return nodes;
    };

    return parseBlock();
  }

  private parseVariableTag(tag: string): AstNode {
    // Check for fallback: {{name || "default"}}
    let path = tag;
    let fallback: string | undefined;

    const fallbackMatch = tag.match(/^(.+?)\s*\|\|\s*['"](.*)['"]$/);
    if (fallbackMatch && fallbackMatch[1] && fallbackMatch[2] !== undefined) {
      path = fallbackMatch[1].trim();
      fallback = fallbackMatch[2];
    }

    // Check if starts with helper: e.g. "kebabCase projectName"
    const helperMatch = path.match(/^([a-zA-Z0-9_$]+)\s+(.+)$/);
    if (helperMatch && helperMatch[1] && helperMatch[2] && this.helpers.has(helperMatch[1])) {
      return {
        type: 'var',
        raw: tag,
        helper: helperMatch[1],
        path: helperMatch[2].trim(),
        fallback,
      };
    }

    return {
      type: 'var',
      raw: tag,
      path,
      fallback,
    };
  }

  // -------------------------------------------------------------------------
  // Evaluation
  // -------------------------------------------------------------------------

  private evaluateNodes(
    nodes: AstNode[],
    context: Record<string, unknown>,
    slots: Map<string, string>,
    helpers: Map<string, TemplateHelperFn>
  ): string {
    let result = '';

    for (const node of nodes) {
      switch (node.type) {
        case 'text':
          result += node.value;
          break;

        case 'var': {
          let val = this.resolvePath(context, node.path);
          if ((val === undefined || val === null || val === '') && node.fallback !== undefined) {
            val = node.fallback;
          }

          if (node.helper) {
            const helperFn = helpers.get(node.helper);
            if (helperFn) {
              val = helperFn(val);
            }
          }

          if (val !== undefined && val !== null) {
            result += String(val);
          }
          break;
        }

        case 'slot': {
          if (slots.has(node.name)) {
            result += slots.get(node.name) ?? '';
          } else {
            result += this.evaluateNodes(node.fallback, context, slots, helpers);
          }
          break;
        }

        case 'if': {
          const condValue = this.evaluateCondition(node.condition, context);
          const shouldRenderThen = node.isUnless ? !condValue : condValue;

          if (shouldRenderThen) {
            result += this.evaluateNodes(node.thenNodes, context, slots, helpers);
          } else {
            result += this.evaluateNodes(node.elseNodes, context, slots, helpers);
          }
          break;
        }

        case 'each': {
          const listVal = this.resolvePath(context, node.listPath);
          if (Array.isArray(listVal)) {
            for (let i = 0; i < listVal.length; i++) {
              const item = listVal[i];
              const loopContext: Record<string, unknown> = {
                ...context,
                this: item,
                '@index': i,
                '@first': i === 0,
                '@last': i === listVal.length - 1,
              };

              if (node.itemName) {
                loopContext[node.itemName] = item;
              } else if (typeof item === 'object' && item !== null) {
                Object.assign(loopContext, item);
              }

              result += this.evaluateNodes(node.bodyNodes, loopContext, slots, helpers);
            }
          }
          break;
        }
      }
    }

    return result;
  }

  private resolvePath(context: Record<string, unknown>, pathStr: string): unknown {
    if (!pathStr) return undefined;
    const cleanPath = pathStr.trim();

    // Direct match
    if (Object.prototype.hasOwnProperty.call(context, cleanPath)) {
      return context[cleanPath];
    }

    // Dot-notation traversal
    const parts = cleanPath.split('.');
    let curr: unknown = context;

    for (const part of parts) {
      if (curr === null || curr === undefined || typeof curr !== 'object') {
        return undefined;
      }
      curr = (curr as Record<string, unknown>)[part];
    }

    return curr;
  }

  private evaluateCondition(expr: string, context: Record<string, unknown>): boolean {
    const trimmed = expr.trim();

    // Negation check: "!features.auth"
    if (trimmed.startsWith('!')) {
      const sub = trimmed.substring(1).trim();
      return !this.evaluateCondition(sub, context);
    }

    // Comparison check: "foo == 'bar'" or "foo === 'bar'"
    const eqMatch = trimmed.match(/^(.+?)\s*===?\s*['"]?(.*?)['"]?$/);
    if (eqMatch && eqMatch[1] && eqMatch[2] !== undefined) {
      const leftVal = String(this.resolvePath(context, eqMatch[1].trim()) ?? '');
      const rightVal = eqMatch[2];
      return leftVal === rightVal;
    }

    // Inequality check: "foo != 'bar'" or "foo !== 'bar'"
    const neqMatch = trimmed.match(/^(.+?)\s*!==?\s*['"]?(.*?)['"]?$/);
    if (neqMatch && neqMatch[1] && neqMatch[2] !== undefined) {
      const leftVal = String(this.resolvePath(context, neqMatch[1].trim()) ?? '');
      const rightVal = neqMatch[2];
      return leftVal !== rightVal;
    }

    // Numeric comparison: ">=", "<=", ">", "<"
    const compMatch = trimmed.match(/^(.+?)\s*(>=|<=|>|<)\s*([0-9.]+)$/);
    if (compMatch && compMatch[1] && compMatch[2] && compMatch[3]) {
      const leftVal = Number(this.resolvePath(context, compMatch[1].trim()) ?? 0);
      const rightVal = Number(compMatch[3]);
      switch (compMatch[2]) {
        case '>=':
          return leftVal >= rightVal;
        case '<=':
          return leftVal <= rightVal;
        case '>':
          return leftVal > rightVal;
        case '<':
          return leftVal < rightVal;
      }
    }

    // Truthy check
    const resolved = this.resolvePath(context, trimmed);
    return this.isTruthy(resolved);
  }

  private isTruthy(val: unknown): boolean {
    if (val === null || val === undefined) return false;
    if (typeof val === 'boolean') return val;
    if (typeof val === 'number') return val !== 0 && !isNaN(val);
    if (typeof val === 'string') return val.trim().length > 0 && val !== 'false';
    if (Array.isArray(val)) return val.length > 0;
    if (typeof val === 'object') return Object.keys(val).length > 0;
    return Boolean(val);
  }
}

/**
 * Convenience helper to render a template string.
 */
export function renderTemplate(
  template: string,
  context: Record<string, unknown> = {},
  options?: RenderOptions
): string {
  const engine = new TemplateEngine();
  return engine.render(template, context, options);
}
