/**
 * @omnistack/ast-engine - mock-generator.ts
 * Deterministic synthetic mock fixture synthesizer powered by @faker-js/faker.
 * Generates mock component props matching extracted ASTPropDefinition schemas.
 */

import { faker } from '@faker-js/faker';
import type { ASTPropDefinition } from '@omnistack/types';

export interface MockGeneratorOptions {
  seed?: number;
  componentName?: string;
  includeOptional?: boolean;
  overrides?: Record<string, unknown>;
  arrayLength?: number;
}

export interface MockFixtureVariant {
  name: string;
  props: Record<string, unknown>;
}

/**
 * Produces a deterministic 32-bit integer seed from a string.
 */
export function hashStringToSeed(input: string): number {
  let hash = 0;
  for (let i = 0; i < input.length; i++) {
    const char = input.charCodeAt(i);
    hash = (hash << 5) - hash + char;
    hash |= 0; // Convert to 32bit integer
  }
  return Math.abs(hash);
}

/**
 * Initializes Faker with a deterministic seed.
 */
export function seedFaker(seedOrName: number | string = 42): void {
  const seedNum = typeof seedOrName === 'string' ? hashStringToSeed(seedOrName) : seedOrName;
  faker.seed(seedNum);
}

/**
 * Generates a mock value for an individual prop definition based on its schema and heuristics.
 */
export function generateMockValueForProp(
  prop: ASTPropDefinition,
  options?: MockGeneratorOptions
): unknown {
  const name = prop.name.toLowerCase();
  const rawType = prop.type.trim();

  // 1. Literal enum options
  if (prop.enumOptions && prop.enumOptions.length > 0) {
    return faker.helpers.arrayElement(prop.enumOptions);
  }

  // 2. Event handler functions (e.g. onClick, onSubmit, onChange)
  if (/^on[A-Z]/.test(prop.name) || rawType.includes('=>') || rawType === 'Function') {
    return `[MockFunction: ${prop.name}]`;
  }

  // 3. React Children or Node
  if (prop.name === 'children' || rawType.includes('ReactNode') || rawType.includes('ReactElement')) {
    return `${prop.name === 'children' ? 'Sample Content' : 'Item'}`;
  }

  // 4. Semantic field heuristics
  if (name === 'id' || name.endsWith('id') || name.endsWith('uuid')) {
    return faker.string.uuid();
  }

  if (name.includes('email')) {
    return faker.internet.email();
  }

  if (name === 'username' || name === 'handle') {
    return faker.internet.username();
  }

  if (name === 'firstname') {
    return faker.person.firstName();
  }

  if (name === 'lastname') {
    return faker.person.lastName();
  }

  if (name.includes('author') || name.includes('user') || name.includes('creator') || name === 'name') {
    return faker.person.fullName();
  }

  if (name.includes('avatar') || name.includes('photo') || name.includes('picture')) {
    return faker.image.avatar();
  }

  if (name.includes('image') || name.includes('thumbnail') || name.includes('banner')) {
    return faker.image.url({ width: 640, height: 480 });
  }

  if (name.includes('url') || name.includes('href') || name.includes('link') || name.includes('src')) {
    return faker.internet.url();
  }

  if (name.includes('price') || name.includes('amount') || name.includes('total') || name.includes('cost')) {
    return faker.number.float({ min: 9.99, max: 299.99, fractionDigits: 2 });
  }

  if (name.includes('count') || name.includes('quantity') || name.includes('stock') || name.includes('views')) {
    return faker.number.int({ min: 1, max: 100 });
  }

  if (name.includes('title') || name.includes('heading') || name.includes('headline')) {
    return faker.lorem.words({ min: 2, max: 4 });
  }

  if (name.includes('description') || name.includes('bio') || name.includes('summary') || name.includes('details')) {
    return faker.lorem.paragraph();
  }

  if (name.includes('phone') || name.includes('tel')) {
    return faker.phone.number();
  }

  if (name.includes('city')) {
    return faker.location.city();
  }

  if (name.includes('address')) {
    return faker.location.streetAddress();
  }

  if (name.includes('date') || name.includes('time') || name.includes('createdat') || name.includes('updatedat')) {
    return faker.date.recent().toISOString();
  }

  if (name === 'classname') {
    return 'p-4 rounded-lg bg-background text-foreground';
  }

  if (name === 'status') {
    return faker.helpers.arrayElement(['active', 'pending', 'completed']);
  }

  // 5. Primitive Types
  if (rawType === 'boolean') {
    return faker.datatype.boolean();
  }

  if (rawType === 'number') {
    return faker.number.int({ min: 1, max: 100 });
  }

  if (rawType === 'string') {
    return faker.lorem.word();
  }

  // 6. Array Types
  const arrLen = options?.arrayLength ?? 3;
  if (rawType.endsWith('[]') || rawType.startsWith('Array<')) {
    if (rawType.includes('string')) {
      return Array.from({ length: arrLen }, () => faker.lorem.word());
    }
    if (rawType.includes('number')) {
      return Array.from({ length: arrLen }, () => faker.number.int({ min: 1, max: 100 }));
    }
    if (rawType.includes('boolean')) {
      return [true, false, true];
    }
    return [
      { id: faker.string.uuid(), title: faker.lorem.words(2) },
      { id: faker.string.uuid(), title: faker.lorem.words(2) },
    ];
  }

  // 7. Generic Record or Object
  if (rawType.includes('Record<') || rawType === 'object') {
    return {
      id: faker.string.uuid(),
      name: faker.person.fullName(),
    };
  }

  // Default fallback
  return faker.lorem.word();
}

/**
 * Synthesizes a deterministic mock props object from a props schema.
 */
export function generateMockProps(
  schema: Record<string, ASTPropDefinition>,
  options?: MockGeneratorOptions
): Record<string, unknown> {
  const seed = options?.seed ?? (options?.componentName ? hashStringToSeed(options.componentName) : 42);
  seedFaker(seed);

  const includeOptional = options?.includeOptional ?? true;
  const overrides = options?.overrides ?? {};
  const mockProps: Record<string, unknown> = {};

  for (const [propName, propDef] of Object.entries(schema)) {
    // Check overrides first
    if (Object.prototype.hasOwnProperty.call(overrides, propName)) {
      mockProps[propName] = overrides[propName];
      continue;
    }

    // Skip optional props if requested
    if (!propDef.required && !includeOptional) {
      continue;
    }

    mockProps[propName] = generateMockValueForProp(propDef, options);
  }

  return mockProps;
}

/**
 * Generates only required props for a component schema.
 */
export function generateMinimalMockProps(
  schema: Record<string, ASTPropDefinition>,
  options?: MockGeneratorOptions
): Record<string, unknown> {
  const opts: MockGeneratorOptions = {
    includeOptional: false,
  };
  if (options?.seed !== undefined) opts.seed = options.seed;
  if (options?.componentName !== undefined) opts.componentName = options.componentName;
  if (options?.overrides !== undefined) opts.overrides = options.overrides;
  if (options?.arrayLength !== undefined) opts.arrayLength = options.arrayLength;

  return generateMockProps(schema, opts);
}

/**
 * Generates exhaustive mock props including all optional fields.
 */
export function generateExhaustiveMockProps(
  schema: Record<string, ASTPropDefinition>,
  options?: MockGeneratorOptions
): Record<string, unknown> {
  const opts: MockGeneratorOptions = {
    includeOptional: true,
  };
  if (options?.seed !== undefined) opts.seed = options.seed;
  if (options?.componentName !== undefined) opts.componentName = options.componentName;
  if (options?.overrides !== undefined) opts.overrides = options.overrides;
  if (options?.arrayLength !== undefined) opts.arrayLength = options.arrayLength;

  return generateMockProps(schema, opts);
}

/**
 * Generates fixture variants covering every option of enum/union props.
 */
export function generateMockVariants(
  schema: Record<string, ASTPropDefinition>,
  options?: MockGeneratorOptions
): MockFixtureVariant[] {
  const baseProps = generateMockProps(schema, options);
  const variants: MockFixtureVariant[] = [{ name: 'Default', props: baseProps }];

  // Find all enum properties
  for (const [propName, propDef] of Object.entries(schema)) {
    if (propDef.enumOptions && propDef.enumOptions.length > 1) {
      for (const optionValue of propDef.enumOptions) {
        variants.push({
          name: `${propName}: ${optionValue}`,
          props: {
            ...baseProps,
            [propName]: optionValue,
          },
        });
      }
    }
  }

  return variants;
}

/**
 * Formats a mock props object into JSX attribute syntax.
 * e.g. title="Hello" count={5} isPrimary={true}
 */
export function formatPropsAsJSXAttributes(props: Record<string, unknown>): string {
  const attributes: string[] = [];

  for (const [key, value] of Object.entries(props)) {
    if (typeof value === 'string') {
      if (value.startsWith('[MockFunction')) {
        attributes.push(`${key}={() => {}}`);
      } else {
        attributes.push(`${key}="${value.replace(/"/g, '&quot;')}"`);
      }
    } else if (typeof value === 'number') {
      attributes.push(`${key}={${value}}`);
    } else if (typeof value === 'boolean') {
      if (value) {
        attributes.push(key);
      } else {
        attributes.push(`${key}={false}`);
      }
    } else if (value === null || value === undefined) {
      continue;
    } else {
      attributes.push(`${key}={${JSON.stringify(value)}}`);
    }
  }

  return attributes.join(' ');
}

/**
 * Formats a mock props object as clean JSON.
 */
export function formatPropsAsJSON(props: Record<string, unknown>, pretty = true): string {
  const sanitized = Object.entries(props).reduce<Record<string, unknown>>((acc, [k, v]) => {
    if (typeof v === 'string' && v.startsWith('[MockFunction')) {
      acc[k] = '__MOCK_FN__';
    } else {
      acc[k] = v;
    }
    return acc;
  }, {});

  return pretty ? JSON.stringify(sanitized, null, 2) : JSON.stringify(sanitized);
}
