/**
 * @omnistack/ast-engine - type-extractor.ts
 * TypeScript interface and React component Props introspector using ts-morph.
 * Extracts component props schemas, union types, optionality, default values, and JSDocs.
 */

import {
  Project,
  SourceFile,
  InterfaceDeclaration,
  TypeAliasDeclaration,
  TypeLiteralNode,
  Node,
  FunctionDeclaration,
  ArrowFunction,
  FunctionExpression,
} from 'ts-morph';
import type { ASTPropDefinition, ASTComponentMetadata } from '@omnistack/types';

export interface ExtractedComponentInfo {
  componentName: string;
  propsInterfaceName?: string;
  propsSchema: Record<string, ASTPropDefinition>;
  docstring?: string;
  isDefaultExport: boolean;
}

export interface TypeExtractorOptions {
  projectId?: string;
  defaultComponentPrefix?: string;
}

/**
 * Creates an in-memory ts-morph Project optimized for fast AST introspection.
 */
export function createInMemoryProject(): Project {
  return new Project({
    useInMemoryFileSystem: true,
    compilerOptions: {
      jsx: 2, // React
      allowJs: true,
      checkJs: false,
      strict: true,
      skipLibCheck: true,
    },
  });
}

/**
 * Normalizes type text by removing internal import paths or formatting.
 */
function cleanTypeText(typeText: string): string {
  return typeText
    .replace(/import\([^)]+\)\./g, '')
    .replace(/ \| undefined$/, '')
    .replace(/^undefined \| /, '')
    .trim();
}

/**
 * Extracts enum string options from a ts-morph Type if it is a union of string literals.
 */
function extractEnumOptions(typeNode: any): string[] | undefined {
  if (!typeNode || !typeNode.isUnion || !typeNode.isUnion()) {
    return undefined;
  }

  const unionTypes = typeNode.getUnionTypes();
  const options: string[] = [];

  for (const ut of unionTypes) {
    const text = ut.getText();
    if (text === 'undefined') {
      continue;
    }
    // Check if literal string like '"sm"' or "'sm'"
    if ((text.startsWith('"') && text.endsWith('"')) || (text.startsWith("'") && text.endsWith("'"))) {
      options.push(text.slice(1, -1));
    } else {
      // If any member is not a literal, it's not a pure string literal enum
      return undefined;
    }
  }

  return options.length > 0 ? options : undefined;
}

/**
 * Extracts JSDoc description and @default tag from a node.
 */
function extractJSDocInfo(node: any): { description?: string; defaultValue?: string } {
  if (!node.getJsDocs || typeof node.getJsDocs !== 'function') {
    return {};
  }

  const jsDocs = node.getJsDocs();
  if (jsDocs.length === 0) {
    return {};
  }

  const doc = jsDocs[jsDocs.length - 1];
  const descriptionText = doc.getDescription?.()?.trim();
  const description = descriptionText ? descriptionText : undefined;

  let defaultValue: string | undefined;
  const tags = doc.getTags?.() || [];
  for (const tag of tags) {
    if (tag.getTagName?.() === 'default') {
      const tagText = tag.getComment?.();
      if (typeof tagText === 'string') {
        const cleaned = tagText.trim().replace(/^["']|["']$/g, '');
        if (cleaned) {
          defaultValue = cleaned;
        }
      }
    }
  }

  const result: { description?: string; defaultValue?: string } = {};
  if (description !== undefined) result.description = description;
  if (defaultValue !== undefined) result.defaultValue = defaultValue;
  return result;
}

/**
 * Extracts destructuring default values from a component parameter.
 */
function extractDestructuredDefaults(
  fnNode: FunctionDeclaration | ArrowFunction | FunctionExpression
): Record<string, string> {
  const defaults: Record<string, string> = {};
  const params = fnNode.getParameters();
  if (params.length === 0) return defaults;

  const firstParam = params[0];
  if (!firstParam) return defaults;

  const nameNode = firstParam.getNameNode();
  if (Node.isObjectBindingPattern(nameNode)) {
    for (const elem of nameNode.getElements()) {
      const name = elem.getName();
      const init = elem.getInitializer();
      if (init) {
        defaults[name] = init.getText().replace(/^["']|["']$/g, '');
      }
    }
  }

  return defaults;
}

/**
 * Helper to construct an ASTPropDefinition conforming to exactOptionalPropertyTypes.
 */
function createPropDefinition(
  name: string,
  typeText: string,
  isOptional: boolean,
  defaultValue: string | undefined,
  description: string | undefined,
  enumOptions: string[] | undefined
): ASTPropDefinition {
  const def: ASTPropDefinition = {
    name,
    type: cleanTypeText(typeText),
    required: !isOptional && defaultValue === undefined,
  };
  if (defaultValue !== undefined) {
    def.defaultValue = defaultValue;
  }
  if (description !== undefined) {
    def.description = description;
  }
  if (enumOptions !== undefined && enumOptions.length > 0) {
    def.enumOptions = enumOptions;
  }
  return def;
}

/**
 * Extracts prop definitions from an InterfaceDeclaration.
 */
function extractPropsFromInterface(
  iface: InterfaceDeclaration,
  destructuredDefaults: Record<string, string> = {}
): Record<string, ASTPropDefinition> {
  const schema: Record<string, ASTPropDefinition> = {};

  for (const prop of iface.getProperties()) {
    const name = prop.getName();
    const type = prop.getType();
    const isOptional = prop.hasQuestionToken();
    const jsDoc = extractJSDocInfo(prop);
    const enumOpts = extractEnumOptions(type);
    const defaultValue = destructuredDefaults[name] ?? jsDoc.defaultValue;

    schema[name] = createPropDefinition(
      name,
      type.getText(),
      isOptional,
      defaultValue,
      jsDoc.description,
      enumOpts
    );
  }

  return schema;
}

/**
 * Extracts prop definitions from a TypeAliasDeclaration or TypeLiteral.
 */
function extractPropsFromTypeAlias(
  alias: TypeAliasDeclaration,
  destructuredDefaults: Record<string, string> = {}
): Record<string, ASTPropDefinition> {
  const schema: Record<string, ASTPropDefinition> = {};
  const typeNode = alias.getTypeNode();

  if (typeNode && Node.isTypeLiteral(typeNode)) {
    for (const member of typeNode.getMembers()) {
      if (Node.isPropertySignature(member)) {
        const name = member.getName();
        const type = member.getType();
        const isOptional = member.hasQuestionToken();
        const jsDoc = extractJSDocInfo(member);
        const enumOpts = extractEnumOptions(type);
        const defaultValue = destructuredDefaults[name] ?? jsDoc.defaultValue;

        schema[name] = createPropDefinition(
          name,
          type.getText(),
          isOptional,
          defaultValue,
          jsDoc.description,
          enumOpts
        );
      }
    }
  }

  return schema;
}

/**
 * Extracts prop definitions from an inline TypeLiteralNode.
 */
function extractPropsFromTypeLiteral(
  typeLiteral: TypeLiteralNode,
  destructuredDefaults: Record<string, string> = {}
): Record<string, ASTPropDefinition> {
  const schema: Record<string, ASTPropDefinition> = {};

  for (const member of typeLiteral.getMembers()) {
    if (Node.isPropertySignature(member)) {
      const name = member.getName();
      const type = member.getType();
      const isOptional = member.hasQuestionToken();
      const jsDoc = extractJSDocInfo(member);
      const enumOpts = extractEnumOptions(type);
      const defaultValue = destructuredDefaults[name] ?? jsDoc.defaultValue;

      schema[name] = createPropDefinition(
        name,
        type.getText(),
        isOptional,
        defaultValue,
        jsDoc.description,
        enumOpts
      );
    }
  }

  return schema;
}

/**
 * Resolves props schema for a React component function or variable declaration.
 */
function resolveComponentProps(
  sourceFile: SourceFile,
  fnNode: FunctionDeclaration | ArrowFunction | FunctionExpression,
  componentName: string
): Record<string, ASTPropDefinition> {
  const destructuredDefaults = extractDestructuredDefaults(fnNode);
  const params = fnNode.getParameters();

  if (params.length > 0) {
    const firstParam = params[0];
    if (firstParam) {
      const typeNode = firstParam.getTypeNode();

      if (typeNode && Node.isTypeLiteral(typeNode)) {
        return extractPropsFromTypeLiteral(typeNode, destructuredDefaults);
      }

      if (typeNode && Node.isTypeReference(typeNode)) {
        const typeName = typeNode.getTypeName().getText();
        const matchingInterface = sourceFile.getInterface(typeName);
        if (matchingInterface) {
          return extractPropsFromInterface(matchingInterface, destructuredDefaults);
        }
        const matchingAlias = sourceFile.getTypeAlias(typeName);
        if (matchingAlias) {
          return extractPropsFromTypeAlias(matchingAlias, destructuredDefaults);
        }
      }
    }
  }

  // Fallback: look for [ComponentName]Props or Props interface or type alias
  const candidateNames = [`${componentName}Props`, 'Props', `${componentName}Prop`];
  for (const candidate of candidateNames) {
    const candidateInterface = sourceFile.getInterface(candidate);
    if (candidateInterface) {
      return extractPropsFromInterface(candidateInterface, destructuredDefaults);
    }
    const candidateAlias = sourceFile.getTypeAlias(candidate);
    if (candidateAlias) {
      return extractPropsFromTypeAlias(candidateAlias, destructuredDefaults);
    }
  }

  return {};
}

/**
 * Extracts React components and their Props schemas from a TypeScript/TSX source file.
 */
export function extractComponentsFromSource(
  sourceFile: SourceFile,
  options?: TypeExtractorOptions
): ExtractedComponentInfo[] {
  const components: ExtractedComponentInfo[] = [];

  // 1. Exported Function Declarations
  for (const fn of sourceFile.getFunctions()) {
    const name = fn.getName();
    if (!name || !/^[A-Z]/.test(name)) continue;

    const jsDoc = extractJSDocInfo(fn);
    const propsSchema = resolveComponentProps(sourceFile, fn, name);
    const isDefault = fn.isDefaultExport();

    const info: ExtractedComponentInfo = {
      componentName: name,
      propsSchema,
      isDefaultExport: isDefault,
    };
    if (jsDoc.description) {
      info.docstring = jsDoc.description;
    }
    components.push(info);
  }

  // 2. Exported Variable Statements (Arrow functions / React.FC)
  for (const varStatement of sourceFile.getVariableStatements()) {
    for (const decl of varStatement.getDeclarations()) {
      const name = decl.getName();
      if (!name || !/^[A-Z]/.test(name)) continue;

      const init = decl.getInitializer();
      if (!init) continue;

      if (Node.isArrowFunction(init) || Node.isFunctionExpression(init)) {
        const jsDoc = extractJSDocInfo(varStatement);
        const propsSchema = resolveComponentProps(sourceFile, init, name);

        const info: ExtractedComponentInfo = {
          componentName: name,
          propsSchema,
          isDefaultExport: false,
        };
        if (jsDoc.description) {
          info.docstring = jsDoc.description;
        }
        components.push(info);
      }
    }
  }

  // 3. Fallback: If no components found but interfaces ending in Props exist
  if (components.length === 0) {
    for (const iface of sourceFile.getInterfaces()) {
      const name = iface.getName();
      if (name.endsWith('Props') || name === 'Props') {
        const componentName = name.replace(/Props$/, '') || (options?.defaultComponentPrefix ?? 'Component');
        const info: ExtractedComponentInfo = {
          componentName,
          propsInterfaceName: name,
          propsSchema: extractPropsFromInterface(iface),
          isDefaultExport: false,
        };
        const doc = extractJSDocInfo(iface).description;
        if (doc) {
          info.docstring = doc;
        }
        components.push(info);
      }
    }
  }

  return components;
}

/**
 * Extracts complete ASTComponentMetadata for a React component file.
 */
export function extractComponentMetadata(
  filePath: string,
  sourceCode: string,
  options?: TypeExtractorOptions
): ASTComponentMetadata {
  const project = createInMemoryProject();
  const sourceFile = project.createSourceFile(filePath, sourceCode, { overwrite: true });

  const components = extractComponentsFromSource(sourceFile, options);
  const mainComponent = components[0];

  const componentName =
    mainComponent?.componentName ??
    filePath.split(/[/|\\]/).pop()?.replace(/\.[^/.]+$/, '') ??
    'Component';

  // Extract all exports
  const exportsList: string[] = [];
  for (const exp of sourceFile.getExportedDeclarations().keys()) {
    exportsList.push(exp);
  }

  // Extract all dependencies / imports
  const dependencies: string[] = [];
  for (const imp of sourceFile.getImportDeclarations()) {
    dependencies.push(imp.getModuleSpecifierValue());
  }

  const projectId = options?.projectId ?? 'omnistack-project';
  const id = `${projectId}-${componentName.toLowerCase()}`;

  const metadata: ASTComponentMetadata = {
    id,
    projectId,
    filePath,
    componentName,
    propsSchema: mainComponent?.propsSchema ?? {},
    exports: exportsList,
    dependencies,
    previewRoute: `/_forge/playground/${componentName}`,
  };

  if (mainComponent?.docstring) {
    metadata.docstring = mainComponent.docstring;
  }

  return metadata;
}

/**
 * Cooperative micro-batch component metadata extractor.
 * Adheres to CPU_RESOURCE_GOVERNANCE.md Rule 4 (micro-batches <= 5 with 50ms yields).
 */
export async function extractComponentMetadataBatched(
  files: Array<{ path: string; code: string }>,
  options?: TypeExtractorOptions & { batchSize?: number; yieldMs?: number }
): Promise<ASTComponentMetadata[]> {
  const batchSize = Math.max(1, Math.min(options?.batchSize ?? 5, 5));
  const yieldMs = options?.yieldMs ?? 50;
  const results: ASTComponentMetadata[] = [];

  for (let i = 0; i < files.length; i += batchSize) {
    const chunk = files.slice(i, i + batchSize);

    for (const file of chunk) {
      try {
        const metadata = extractComponentMetadata(file.path, file.code, options);
        results.push(metadata);
      } catch {
        // Fallback metadata on error
        const fallbackName = file.path.split(/[/|\\]/).pop()?.replace(/\.[^/.]+$/, '') ?? 'Component';
        results.push({
          id: `${options?.projectId ?? 'omnistack-project'}-${fallbackName.toLowerCase()}`,
          projectId: options?.projectId ?? 'omnistack-project',
          filePath: file.path,
          componentName: fallbackName,
          propsSchema: {},
          exports: [],
          dependencies: [],
          previewRoute: `/_forge/playground/${fallbackName}`,
        });
      }
    }

    if (i + batchSize < files.length) {
      await new Promise((resolve) => setTimeout(resolve, yieldMs));
    }
  }

  return results;
}
