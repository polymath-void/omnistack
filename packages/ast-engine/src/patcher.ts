/**
 * @omnistack/ast-engine - patcher.ts
 * Non-destructive AST patcher using Recast.
 * Strictly isolates autonomous modifications between sentinel markers:
 *   /* @omnistack-managed-start *\/ ... /* @omnistack-managed-end *\/
 * Preserves developer comments, whitespace, and formatting outside managed boundaries.
 */

import * as recast from 'recast';
import * as babelParser from '@babel/parser';

export const MANAGED_START_SENTINEL = '/* @omnistack-managed-start */';
export const MANAGED_END_SENTINEL = '/* @omnistack-managed-end */';

export const MANAGED_BLOCK_REGEX =
  /\/\*\s*@omnistack-managed-start\s*\*\/([\s\S]*?)\/\*\s*@omnistack-managed-end\s*\*\//;

export interface ManagedPatchOptions {
  insertPosition?: 'start' | 'end' | 'after-imports';
  trimNewlines?: boolean;
}

export interface ManagedPatchResult {
  code: string;
  modified: boolean;
  wasCreated: boolean;
  previousContent?: string;
}

export interface TailwindPatchDirective {
  originalClasses: string[];
  replacementClasses: string[];
  componentName?: string;
  elementTag?: string;
}

export interface RecastPatchResult {
  code: string;
  modified: boolean;
  error?: Error;
}

/**
 * Creates a Babel parser configuration suitable for Recast with TypeScript and TSX support.
 */
export function createBabelRecastParser() {
  return {
    parse(source: string) {
      const plugins: babelParser.ParserPlugin[] = [
        'typescript',
        'jsx',
        'decorators-legacy',
        'exportDefaultFrom',
      ];

      return babelParser.parse(source, {
        sourceType: 'module',
        plugins,
        tokens: true,
      });
    },
  };
}

/**
 * Checks if source code contains the omnistack managed block sentinels.
 */
export function hasManagedBlock(source: string): boolean {
  return MANAGED_BLOCK_REGEX.test(source);
}

/**
 * Extracts the inner code string between the omnistack managed block sentinels.
 * Returns null if no managed block is found.
 */
export function extractManagedBlock(source: string): string | null {
  const match = MANAGED_BLOCK_REGEX.exec(source);
  if (!match || match[1] === undefined) {
    return null;
  }
  return match[1];
}

/**
 * Non-destructively replaces the content inside the managed block.
 * If the sentinel block does not exist, inserts it cleanly based on insertPosition.
 * Code outside the sentinel marks is guaranteed to remain 100% byte-for-byte identical.
 */
export function patchManagedBlock(
  source: string,
  newContent: string,
  options?: ManagedPatchOptions
): ManagedPatchResult {
  const trimmedContent = options?.trimNewlines === false ? newContent : newContent.trim();
  const match = MANAGED_BLOCK_REGEX.exec(source);

  if (match) {
    const startIndex = match.index;
    const fullMatchLength = match[0].length;
    const previousContent = match[1];

    const replacement = `${MANAGED_START_SENTINEL}\n${trimmedContent}\n${MANAGED_END_SENTINEL}`;
    const patchedCode =
      source.slice(0, startIndex) + replacement + source.slice(startIndex + fullMatchLength);

    const result: ManagedPatchResult = {
      code: patchedCode,
      modified: previousContent?.trim() !== trimmedContent,
      wasCreated: false,
    };
    if (previousContent !== undefined) {
      result.previousContent = previousContent;
    }
    return result;
  }

  // Sentinels do not exist: insert them non-destructively
  const blockToInsert = `\n\n${MANAGED_START_SENTINEL}\n${trimmedContent}\n${MANAGED_END_SENTINEL}\n`;
  const insertPosition = options?.insertPosition ?? 'end';

  if (insertPosition === 'start') {
    return {
      code: `${MANAGED_START_SENTINEL}\n${trimmedContent}\n${MANAGED_END_SENTINEL}\n\n${source}`,
      modified: true,
      wasCreated: true,
    };
  }

  if (insertPosition === 'after-imports') {
    // Find the last import statement in the source
    const importRegex = /(?:^|\n)(?:import\s+(?:[\w*\s{},]*\s+from\s+)?['"][^'"]+['"];?)/g;
    let lastMatchEnd = -1;
    let currentMatch: RegExpExecArray | null;

    while ((currentMatch = importRegex.exec(source)) !== null) {
      lastMatchEnd = currentMatch.index + currentMatch[0].length;
    }

    if (lastMatchEnd !== -1) {
      const before = source.slice(0, lastMatchEnd);
      const after = source.slice(lastMatchEnd);
      return {
        code: `${before}\n\n${MANAGED_START_SENTINEL}\n${trimmedContent}\n${MANAGED_END_SENTINEL}\n${after}`,
        modified: true,
        wasCreated: true,
      };
    }
  }

  // Default: append to end of file
  const trailingNewline = source.endsWith('\n') ? '' : '\n';
  return {
    code: `${source}${trailingNewline}${blockToInsert}`,
    modified: true,
    wasCreated: true,
  };
}

/**
 * Non-destructive AST transformation using Recast.
 * Parses the code with Babel AST, executes transformer callback, and prints with exact formatting.
 */
export function patchWithRecast(
  source: string,
  transformer: (ast: any, types: typeof recast.types) => boolean | void
): RecastPatchResult {
  try {
    const parser = createBabelRecastParser();
    const ast = recast.parse(source, { parser });

    const modified = transformer(ast, recast.types) ?? true;
    const printedCode = recast.print(ast).code;

    return {
      code: printedCode,
      modified: Boolean(modified),
    };
  } catch (err) {
    const errorObj = err instanceof Error ? err : new Error(String(err));
    const result: RecastPatchResult = {
      code: source,
      modified: false,
      error: errorObj,
    };
    return result;
  }
}

/**
 * Non-destructively replaces Tailwind classes in JSX elements matching vision patch directives.
 * Preserves all developer formatting, comments, and structure outside the modified className strings.
 */
export function patchTailwindClasses(
  source: string,
  directives: TailwindPatchDirective[]
): RecastPatchResult {
  if (directives.length === 0) {
    return { code: source, modified: false };
  }

  return patchWithRecast(source, (ast, types) => {
    let hasChanges = false;

    types.visit(ast, {
      visitJSXElement(path) {
        const opening = path.node.openingElement;
        let tag: string | undefined;

        if (opening?.name?.type === 'JSXIdentifier') {
          tag = opening.name.name;
        }

        // Traverse attributes looking for className
        if (opening && Array.isArray(opening.attributes)) {
          for (const attr of opening.attributes) {
            if (attr.type === 'JSXAttribute' && attr.name?.name === 'className') {
              if (attr.value && attr.value.type === 'StringLiteral') {
                let classList = attr.value.value.split(/\s+/).filter(Boolean);

                for (const directive of directives) {
                  if (directive.elementTag && tag && directive.elementTag !== tag) {
                    continue;
                  }

                  const matches = directive.originalClasses.every((cls) => classList.includes(cls));
                  if (matches) {
                    classList = classList.filter((cls: string) => !directive.originalClasses.includes(cls));
                    classList.push(...directive.replacementClasses);
                    hasChanges = true;
                  }
                }

                attr.value.value = classList.join(' ');
              }
            }
          }
        }

        this.traverse(path);
      },
    });

    return hasChanges;
  });
}

/**
 * Replaces a named exported function or variable declaration non-destructively using Recast.
 */
export function patchNamedExport(
  source: string,
  exportName: string,
  newDeclarationCode: string
): RecastPatchResult {
  const parser = createBabelRecastParser();
  const parsedNewDecl = recast.parse(newDeclarationCode, { parser });
  const newNodes = parsedNewDecl.program.body;

  if (newNodes.length === 0) {
    return { code: source, modified: false };
  }

  return patchWithRecast(source, (ast, types) => {
    let replaced = false;

    types.visit(ast, {
      visitExportNamedDeclaration(path) {
        const decl = path.node.declaration as any;
        if (!decl) {
          this.traverse(path);
          return false;
        }

        let matches = false;
        if (decl.type === 'FunctionDeclaration' && decl.id?.name === exportName) {
          matches = true;
        } else if (decl.type === 'VariableDeclaration' && Array.isArray(decl.declarations)) {
          for (const d of decl.declarations) {
            if (d.id?.name === exportName) {
              matches = true;
              break;
            }
          }
        }

        if (matches) {
          path.replace(...newNodes);
          replaced = true;
          return false;
        }

        this.traverse(path);
        return false;
      },
    });

    return replaced;
  });
}
