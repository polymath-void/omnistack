/**
 * @omnistack/ast-engine - parser.ts
 * High-speed AST parsing and visitor traversal powered by @swc/core.
 * Enforces CPU resource governance via sequential & micro-batching with cooperative 50ms yields.
 */

import * as swc from '@swc/core';

export interface SWCParseOptions {
  syntax?: 'typescript' | 'ecmascript';
  tsx?: boolean;
  decorators?: boolean;
  dynamicImport?: boolean;
  target?: swc.JscTarget;
  comments?: boolean;
}

export interface ImportSpecifierInfo {
  local: string;
  imported?: string;
  isDefault?: boolean;
  isNamespace?: boolean;
}

export interface ExtractedImport {
  source: string;
  specifiers: ImportSpecifierInfo[];
}

export interface ExtractedExport {
  name: string;
  isDefault: boolean;
  isTypeOnly: boolean;
}

/**
 * Visitor interface for traversing SWC AST nodes.
 */
export interface ASTVisitor {
  enter?: (node: any, parent: any | null, key?: string | number) => boolean | void;
  leave?: (node: any, parent: any | null, key?: string | number) => void;
  visitImportDeclaration?: (node: any, parent: any | null) => void;
  visitExportDeclaration?: (node: any, parent: any | null) => void;
  visitExportDefaultDeclaration?: (node: any, parent: any | null) => void;
  visitFunctionDeclaration?: (node: any, parent: any | null) => void;
  visitVariableDeclaration?: (node: any, parent: any | null) => void;
  visitJSXElement?: (node: any, parent: any | null) => void;
  visitTsInterfaceDeclaration?: (node: any, parent: any | null) => void;
  visitTsTypeAliasDeclaration?: (node: any, parent: any | null) => void;
}

/**
 * Determines default SWC parse options based on file extension or filename.
 */
export function resolveParseOptions(filePath?: string, customOptions?: SWCParseOptions): swc.ParseOptions {
  const isTsx = customOptions?.tsx ?? (filePath ? /\.(tsx|jsx)$/i.test(filePath) : true);
  const isTs = customOptions?.syntax === 'typescript' || (filePath ? /\.(ts|tsx)$/i.test(filePath) : true);

  if (isTs) {
    return {
      syntax: 'typescript',
      tsx: isTsx,
      decorators: customOptions?.decorators ?? true,
      dynamicImport: customOptions?.dynamicImport ?? true,
      target: customOptions?.target ?? 'es2022',
      comments: customOptions?.comments ?? true,
    };
  }

  return {
    syntax: 'ecmascript',
    jsx: isTsx,
    decorators: customOptions?.decorators ?? true,
    dynamicImport: customOptions?.dynamicImport ?? true,
    target: customOptions?.target ?? 'es2022',
    comments: customOptions?.comments ?? true,
  };
}

/**
 * Synchronously parses source code into an SWC Module AST.
 */
export function parseSourceSync(code: string, options?: SWCParseOptions, filePath?: string): swc.Module {
  const config = resolveParseOptions(filePath, options);
  return swc.parseSync(code, config);
}

/**
 * Asynchronously parses source code into an SWC Module AST.
 */
export async function parseSource(code: string, options?: SWCParseOptions, filePath?: string): Promise<swc.Module> {
  const config = resolveParseOptions(filePath, options);
  return swc.parse(code, config);
}

/**
 * Traverses an SWC AST tree using a visitor pattern.
 */
export function traverseAST(rootNode: any, visitor: ASTVisitor, parent: any = null, key?: string | number): void {
  if (!rootNode || typeof rootNode !== 'object') {
    return;
  }

  // Hook: enter node. Return false to skip children
  if (visitor.enter) {
    const shouldContinue = visitor.enter(rootNode, parent, key);
    if (shouldContinue === false) {
      return;
    }
  }

  // Typed visitor hooks
  if (rootNode.type) {
    const handlerName = `visit${rootNode.type}` as keyof ASTVisitor;
    const typedHandler = visitor[handlerName];
    if (typeof typedHandler === 'function') {
      (typedHandler as (node: any, parent: any | null) => void)(rootNode, parent);
    }
  }

  // Traverse array children or object properties
  if (Array.isArray(rootNode)) {
    for (let i = 0; i < rootNode.length; i++) {
      traverseAST(rootNode[i], visitor, parent, i);
    }
  } else {
    for (const prop of Object.keys(rootNode)) {
      // Avoid circular or internal metadata references
      if (prop === 'span' || prop === 'type') {
        continue;
      }
      const child = rootNode[prop];
      if (child && typeof child === 'object') {
        traverseAST(child, visitor, rootNode, prop);
      }
    }
  }

  // Hook: leave node
  if (visitor.leave) {
    visitor.leave(rootNode, parent, key);
  }
}

/**
 * Extracts all imports from an SWC Module AST.
 */
export function extractImports(module: swc.Module): ExtractedImport[] {
  const imports: ExtractedImport[] = [];

  traverseAST(module, {
    visitImportDeclaration(node: any) {
      const source = node.source?.value ?? node.src?.value ?? '';
      const specifiers: ImportSpecifierInfo[] = [];

      if (Array.isArray(node.specifiers)) {
        for (const spec of node.specifiers) {
          if (spec.type === 'ImportDefaultSpecifier') {
            specifiers.push({
              local: spec.local?.value ?? '',
              isDefault: true,
            });
          } else if (spec.type === 'NamedImportSpecifier') {
            specifiers.push({
              local: spec.local?.value ?? '',
              imported: spec.imported?.value ?? spec.local?.value,
            });
          } else if (spec.type === 'ImportNamespaceSpecifier') {
            specifiers.push({
              local: spec.local?.value ?? '',
              isNamespace: true,
            });
          }
        }
      }

      imports.push({ source, specifiers });
    },
  });

  return imports;
}

/**
 * Extracts all named and default exports from an SWC Module AST.
 */
export function extractExports(module: swc.Module): ExtractedExport[] {
  const exportsList: ExtractedExport[] = [];

  traverseAST(module, {
    visitExportDeclaration(node: any) {
      const decl = node.declaration;
      if (!decl) return;

      if (decl.type === 'FunctionDeclaration' && decl.identifier) {
        exportsList.push({
          name: decl.identifier.value,
          isDefault: false,
          isTypeOnly: false,
        });
      } else if (decl.type === 'VariableDeclaration' && Array.isArray(decl.declarations)) {
        for (const item of decl.declarations) {
          if (item.id?.type === 'Identifier') {
            exportsList.push({
              name: item.id.value,
              isDefault: false,
              isTypeOnly: false,
            });
          }
        }
      } else if (decl.type === 'TsInterfaceDeclaration' && decl.id) {
        exportsList.push({
          name: decl.id.value,
          isDefault: false,
          isTypeOnly: true,
        });
      } else if (decl.type === 'TsTypeAliasDeclaration' && decl.id) {
        exportsList.push({
          name: decl.id.value,
          isDefault: false,
          isTypeOnly: true,
        });
      }
    },
    visitExportDefaultDeclaration(node: any) {
      let name = 'default';
      const decl = node.decl;
      if (decl) {
        if (decl.type === 'FunctionExpression' && decl.identifier) {
          name = decl.identifier.value;
        } else if (decl.type === 'Identifier') {
          name = decl.value;
        }
      }
      exportsList.push({
        name,
        isDefault: true,
        isTypeOnly: false,
      });
    },
  });

  return exportsList;
}

/**
 * Extracts JSX element tag names from an SWC Module AST.
 */
export function extractJSXTags(module: swc.Module): string[] {
  const tags = new Set<string>();

  traverseAST(module, {
    visitJSXElement(node: any) {
      const opening = node.opening;
      if (opening && opening.name) {
        if (opening.name.type === 'Identifier') {
          tags.add(opening.name.value);
        } else if (opening.name.type === 'JSXMemberExpression') {
          const obj = opening.name.object?.value ?? '';
          const prop = opening.name.property?.value ?? '';
          tags.add(`${obj}.${prop}`);
        }
      }
    },
  });

  return Array.from(tags);
}

/**
 * Cooperative micro-batch file parser.
 * Conforms to CPU_RESOURCE_GOVERNANCE.md Rule 4:
 * Parses files in micro-batches of <= 5 files with a 50ms cooperative yield interval.
 */
export async function parseFilesBatched<T = swc.Module>(
  files: Array<{ path: string; code: string }>,
  processor?: (path: string, ast: swc.Module) => T | Promise<T>,
  options?: { batchSize?: number; yieldMs?: number }
): Promise<Array<{ path: string; result?: T; error?: Error }>> {
  const batchSize = Math.max(1, Math.min(options?.batchSize ?? 5, 5));
  const yieldMs = options?.yieldMs ?? 50;
  const results: Array<{ path: string; result?: T; error?: Error }> = [];

  for (let i = 0; i < files.length; i += batchSize) {
    const chunk = files.slice(i, i + batchSize);

    for (const file of chunk) {
      try {
        const ast = parseSourceSync(file.code, undefined, file.path);
        if (processor) {
          const processed = await processor(file.path, ast);
          results.push({ path: file.path, result: processed });
        } else {
          results.push({ path: file.path, result: ast as unknown as T });
        }
      } catch (err) {
        results.push({
          path: file.path,
          error: err instanceof Error ? err : new Error(String(err)),
        });
      }
    }

    // Cooperative yield to avoid thermal throttling
    if (i + batchSize < files.length) {
      await new Promise((resolve) => setTimeout(resolve, yieldMs));
    }
  }

  return results;
}
