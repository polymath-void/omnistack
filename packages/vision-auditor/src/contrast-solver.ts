/**
 * Contrast Solver Engine for OmniStack Forge
 *
 * Implements:
 * 1. IEC 61966-2-1 relative luminance (L)
 * 2. WCAG 2.1 Contrast Ratio: CR = (L1 + 0.05) / (L2 + 0.05)
 * 3. Exact OKLab perceptual color space conversions
 * 4. OKLab Delta E metric
 * 5. Minimal-distance brand hue solver targeting Tailwind CSS tokens
 */

export interface RGBColor {
  r: number;
  g: number;
  b: number;
  a?: number;
}

export interface OKLabColor {
  L: number;
  a: number;
  b: number;
}

export interface TailwindColorToken {
  name: string;
  family: string;
  shade: number;
  hex: string;
  rgb: RGBColor;
  luminance: number;
  oklab: OKLabColor;
}

export interface ContrastResult {
  ratio: number;
  passesAA: boolean; // >= 4.5
  passesAALarge: boolean; // >= 3.0
  passesAAA: boolean; // >= 7.0
  passesAAALarge: boolean; // >= 4.5
}

export interface RemediationSuggestion {
  originalColor: RGBColor;
  targetBackground: RGBColor;
  initialContrastRatio: number;
  recommendedToken: TailwindColorToken;
  resolvedContrastRatio: number;
  deltaE: number;
  originalClass?: string;
  replacementClass: string;
}

// ---------------------------------------------------------------------------
// 1. Color Parsing & Conversion
// ---------------------------------------------------------------------------

/**
 * Parses hex (#rgb, #rrggbb, #rrggbbaa) or rgb/rgba string into RGBColor.
 */
export function parseCssColor(colorStr: string): RGBColor {
  const trimmed = colorStr.trim().toLowerCase();

  // Hex colors
  if (trimmed.startsWith('#')) {
    const hex = trimmed.slice(1);
    if (hex.length === 3 || hex.length === 4) {
      const r = parseInt(hex[0]! + hex[0]!, 16);
      const g = parseInt(hex[1]! + hex[1]!, 16);
      const b = parseInt(hex[2]! + hex[2]!, 16);
      const a = hex.length === 4 ? parseInt(hex[3]! + hex[3]!, 16) / 255 : 1;
      return { r, g, b, a };
    }
    if (hex.length === 6 || hex.length === 8) {
      const r = parseInt(hex.slice(0, 2), 16);
      const g = parseInt(hex.slice(2, 4), 16);
      const b = parseInt(hex.slice(4, 6), 16);
      const a = hex.length === 8 ? parseInt(hex.slice(6, 8), 16) / 255 : 1;
      return { r, g, b, a };
    }
  }

  // rgb(...) or rgba(...)
  const rgbMatch = trimmed.match(
    /^rgba?\s*\(\s*([\d.]+)\s*,\s*([\d.]+)\s*,\s*([\d.]+)(?:\s*[,/]\s*([\d.]+%?))?\s*\)$/
  );
  if (rgbMatch) {
    const r = Math.min(255, Math.max(0, parseFloat(rgbMatch[1]!)));
    const g = Math.min(255, Math.max(0, parseFloat(rgbMatch[2]!)));
    const b = Math.min(255, Math.max(0, parseFloat(rgbMatch[3]!)));
    let a = 1;
    if (rgbMatch[4]) {
      const rawA = rgbMatch[4];
      a = rawA.endsWith('%') ? parseFloat(rawA) / 100 : parseFloat(rawA);
      a = Math.min(1, Math.max(0, a));
    }
    return { r, g, b, a };
  }

  // Named fallbacks
  if (trimmed === 'transparent') {
    return { r: 0, g: 0, b: 0, a: 0 };
  }
  if (trimmed === 'black') {
    return { r: 0, g: 0, b: 0, a: 1 };
  }
  if (trimmed === 'white') {
    return { r: 255, g: 255, b: 255, a: 1 };
  }

  // Default fallback if unparseable
  return { r: 0, g: 0, b: 0, a: 1 };
}

/**
 * Composite a foreground color with alpha over a solid background color.
 */
export function compositeColors(foreground: RGBColor, background: RGBColor): RGBColor {
  const fgA = foreground.a ?? 1;
  if (fgA >= 1) {
    return { r: foreground.r, g: foreground.g, b: foreground.b, a: 1 };
  }

  const bgA = background.a ?? 1;
  const outA = fgA + bgA * (1 - fgA);

  if (outA <= 0) {
    return { r: 0, g: 0, b: 0, a: 0 };
  }

  const r = Math.round((foreground.r * fgA + background.r * bgA * (1 - fgA)) / outA);
  const g = Math.round((foreground.g * fgA + background.g * bgA * (1 - fgA)) / outA);
  const b = Math.round((foreground.b * fgA + background.b * bgA * (1 - fgA)) / outA);

  return { r, g, b, a: outA };
}

// ---------------------------------------------------------------------------
// 2. Relative Luminance & Contrast Ratio (IEC 61966-2-1)
// ---------------------------------------------------------------------------

/**
 * Calculate sRGB linear channel value according to IEC 61966-2-1.
 */
function sRgbToLinear(c: number): number {
  const normalized = c / 255;
  return normalized <= 0.04045
    ? normalized / 12.92
    : Math.pow((normalized + 0.055) / 1.055, 2.4);
}

/**
 * Calculates mathematical relative luminance (L) of an RGB color (IEC 61966-2-1).
 * Range: [0.0, 1.0]
 */
export function calculateRelativeLuminance(color: RGBColor): number {
  const rLin = sRgbToLinear(color.r);
  const gLin = sRgbToLinear(color.g);
  const bLin = sRgbToLinear(color.b);

  return 0.2126 * rLin + 0.7152 * gLin + 0.0722 * bLin;
}

/**
 * Calculates contrast ratio CR between two luminances according to WCAG 2.1:
 * CR = (L1 + 0.05) / (L2 + 0.05) where L1 is lighter and L2 is darker.
 * Range: [1.0, 21.0]
 */
export function calculateContrastRatio(l1: number, l2: number): number {
  const lighter = Math.max(l1, l2);
  const darker = Math.min(l1, l2);
  const ratio = (lighter + 0.05) / (darker + 0.05);
  return Number(ratio.toFixed(2));
}

/**
 * Evaluates contrast between foreground and background against WCAG 2.1 thresholds.
 */
export function evaluateContrast(foreground: RGBColor, background: RGBColor): ContrastResult {
  const effectiveFg = compositeColors(foreground, background);
  const l1 = calculateRelativeLuminance(effectiveFg);
  const l2 = calculateRelativeLuminance(background);
  const ratio = calculateContrastRatio(l1, l2);

  return {
    ratio,
    passesAA: ratio >= 4.5,
    passesAALarge: ratio >= 3.0,
    passesAAA: ratio >= 7.0,
    passesAAALarge: ratio >= 4.5,
  };
}

// ---------------------------------------------------------------------------
// 3. OKLab Color Space & Delta E
// ---------------------------------------------------------------------------

/**
 * Converts sRGB color to OKLab perceptual color space.
 * Reference: Björn Ottosson, "A perceptual color space for image processing" (2020)
 */
export function rgbToOklab(color: RGBColor): OKLabColor {
  const rLin = sRgbToLinear(color.r);
  const gLin = sRgbToLinear(color.g);
  const bLin = sRgbToLinear(color.b);

  // Linear sRGB to LMS
  const l = 0.4122214708 * rLin + 0.5363325363 * gLin + 0.0514459929 * bLin;
  const m = 0.2119034982 * rLin + 0.6806995451 * gLin + 0.1073969566 * bLin;
  const s = 0.0883024619 * rLin + 0.2817188376 * gLin + 0.6299787005 * bLin;

  // Non-linear cubic compression
  const l_ = Math.sign(l) * Math.cbrt(Math.abs(l));
  const m_ = Math.sign(m) * Math.cbrt(Math.abs(m));
  const s_ = Math.sign(s) * Math.cbrt(Math.abs(s));

  // LMS to OKLab
  const L = 0.2104542553 * l_ + 0.793617785 * m_ - 0.0040720468 * s_;
  const a = 1.9779984951 * l_ - 2.428592205 * m_ + 0.4505937099 * s_;
  const b = 0.0259040371 * l_ + 0.7827717662 * m_ - 0.808675766 * s_;

  return { L, a, b };
}

/**
 * Calculates Euclidean perceptual distance (Delta E) in OKLab color space:
 * Delta E = sqrt((L1 - L2)^2 + (a1 - a2)^2 + (b1 - b2)^2)
 */
export function calculateDeltaE(c1: OKLabColor, c2: OKLabColor): number {
  const dL = c1.L - c2.L;
  const da = c1.a - c2.a;
  const db = c1.b - c2.b;
  return Number(Math.sqrt(dL * dL + da * da + db * db).toFixed(4));
}

// ---------------------------------------------------------------------------
// 4. Tailwind CSS Token Palette Matrix
// ---------------------------------------------------------------------------

const RAW_TAILWIND_PALETTE: Record<string, Record<number, string>> = {
  slate: {
    50: '#f8fafc', 100: '#f1f5f9', 200: '#e2e8f0', 300: '#cbd5e1', 400: '#94a3b8',
    500: '#64748b', 600: '#475569', 700: '#334155', 800: '#1e293b', 900: '#0f172a', 950: '#020617',
  },
  gray: {
    50: '#f9fafb', 100: '#f3f4f6', 200: '#e5e7eb', 300: '#d1d5db', 400: '#9ca3af',
    500: '#6b7280', 600: '#4b5563', 700: '#374151', 800: '#1f2937', 900: '#111827', 950: '#030712',
  },
  zinc: {
    50: '#fafafa', 100: '#f4f4f5', 200: '#e4e4e7', 300: '#d4d4d8', 400: '#a1a1aa',
    500: '#71717a', 600: '#52525b', 700: '#3f3f46', 800: '#27272a', 900: '#18181b', 950: '#09090b',
  },
  neutral: {
    50: '#fafafa', 100: '#f5f5f5', 200: '#e5e5e5', 300: '#d4d4d4', 400: '#a3a3a3',
    500: '#737373', 600: '#525252', 700: '#404040', 800: '#262626', 900: '#171717', 950: '#0a0a0a',
  },
  stone: {
    50: '#fafaf9', 100: '#f5f5f4', 200: '#e7e5e4', 300: '#d6d3d1', 400: '#a8a29e',
    500: '#78716c', 600: '#57534e', 700: '#44403c', 800: '#292524', 900: '#1c1917', 950: '#0c0a09',
  },
  red: {
    50: '#fef2f2', 100: '#fee2e2', 200: '#fecaca', 300: '#fca5a5', 400: '#f87171',
    500: '#ef4444', 600: '#dc2626', 700: '#b91c1c', 800: '#991b1b', 900: '#7f1d1d', 950: '#450a0a',
  },
  orange: {
    50: '#fff7ed', 100: '#ffedd5', 200: '#fed7aa', 300: '#fdba74', 400: '#fb923c',
    500: '#f97316', 600: '#ea580c', 700: '#c2410c', 800: '#9a3412', 900: '#7c2d12', 950: '#431407',
  },
  amber: {
    50: '#fffbeb', 100: '#fef3c7', 200: '#fde68a', 300: '#fcd34d', 400: '#fbbf24',
    500: '#f59e0b', 600: '#d97706', 700: '#b45309', 800: '#92400e', 900: '#78350f', 950: '#451a03',
  },
  yellow: {
    50: '#fefce8', 100: '#fef9c3', 200: '#fef08a', 300: '#fde047', 400: '#facc15',
    500: '#eab308', 600: '#ca8a04', 700: '#a16207', 800: '#854d0e', 900: '#713f12', 950: '#422006',
  },
  lime: {
    50: '#f7fee7', 100: '#ecfccb', 200: '#d9f99d', 300: '#bef264', 400: '#a3e635',
    500: '#84cc16', 600: '#65a30d', 700: '#4d7c0f', 800: '#3f6212', 900: '#365314', 950: '#1a2e05',
  },
  green: {
    50: '#f0fdf4', 100: '#dcfce7', 200: '#bbf7d0', 300: '#86efac', 400: '#4ade80',
    500: '#22c55e', 600: '#16a34a', 700: '#15803d', 800: '#166534', 900: '#14532d', 950: '#052e16',
  },
  emerald: {
    50: '#ecfdf5', 100: '#d1fae5', 200: '#a7f3d0', 300: '#6ee7b7', 400: '#34d399',
    500: '#10b981', 600: '#059669', 700: '#047857', 800: '#065f46', 900: '#064e3b', 950: '#022c22',
  },
  teal: {
    50: '#f0fdfa', 100: '#ccfbf1', 200: '#99f6e4', 300: '#5eead4', 400: '#2dd4bf',
    500: '#14b8a6', 600: '#0d9488', 700: '#0f766e', 800: '#115e59', 900: '#134e4a', 950: '#042f2e',
  },
  cyan: {
    50: '#ecfeff', 100: '#cffafe', 200: '#a5f3fc', 300: '#67e8f9', 400: '#22d3ee',
    500: '#06b6d4', 600: '#0891b2', 700: '#0e7490', 800: '#155e75', 900: '#164e63', 950: '#083344',
  },
  sky: {
    50: '#f0f9ff', 100: '#e0f2fe', 200: '#bae6fd', 300: '#7dd3fc', 400: '#38bdf8',
    500: '#0ea5e9', 600: '#0284c7', 700: '#0369a1', 800: '#075985', 900: '#0c4a6e', 950: '#082f49',
  },
  blue: {
    50: '#eff6ff', 100: '#dbeafe', 200: '#bfdbfe', 300: '#93c5fd', 400: '#60a5fa',
    500: '#3b82f6', 600: '#2563eb', 700: '#1d4ed8', 800: '#1e40af', 900: '#1e3a8a', 950: '#172554',
  },
  indigo: {
    50: '#eef2ff', 100: '#e0e7ff', 200: '#c7d2fe', 300: '#a5b4fc', 400: '#818cf8',
    500: '#6366f1', 600: '#4f46e5', 700: '#4338ca', 800: '#3730a3', 900: '#312e81', 950: '#1e1b4b',
  },
  violet: {
    50: '#f5f3ff', 100: '#ede9fe', 200: '#ddd6fe', 300: '#c4b5fd', 400: '#a78bfa',
    500: '#8b5cf6', 600: '#7c3aed', 700: '#6d28d9', 800: '#5b21b6', 900: '#4c1d95', 950: '#2e1065',
  },
  purple: {
    50: '#faf5ff', 100: '#f3e8ff', 200: '#e9d5ff', 300: '#d8b4fe', 400: '#c084fc',
    500: '#a855f7', 600: '#9333ea', 700: '#7e22ce', 800: '#6b21a8', 900: '#581c87', 950: '#3b0764',
  },
  fuchsia: {
    50: '#fdf4ff', 100: '#fae8ff', 200: '#f5d0fe', 300: '#f0abfc', 400: '#e879f9',
    500: '#d946ef', 600: '#c026d3', 700: '#a21caf', 800: '#86198f', 900: '#701a75', 950: '#4a044e',
  },
  pink: {
    50: '#fdf2f8', 100: '#fce7f3', 200: '#fbcfe8', 300: '#f9a8d4', 400: '#f472b6',
    500: '#ec4899', 600: '#db2777', 700: '#be185d', 800: '#9d174d', 900: '#831843', 950: '#500724',
  },
  rose: {
    50: '#fff1f2', 100: '#ffe4e6', 200: '#fecdd3', 300: '#fda4af', 400: '#fb7185',
    500: '#f43f5e', 600: '#e11d48', 700: '#be123c', 800: '#9f1239', 900: '#881337', 950: '#4c0519',
  },
};

/**
 * Build pre-computed indexed tokens with IEC luminance and OKLab vectors.
 */
function buildTailwindTokens(): TailwindColorToken[] {
  const tokens: TailwindColorToken[] = [];

  // Special tokens
  const blackRgb = { r: 0, g: 0, b: 0, a: 1 };
  tokens.push({
    name: 'black',
    family: 'black',
    shade: 0,
    hex: '#000000',
    rgb: blackRgb,
    luminance: calculateRelativeLuminance(blackRgb),
    oklab: rgbToOklab(blackRgb),
  });

  const whiteRgb = { r: 255, g: 255, b: 255, a: 1 };
  tokens.push({
    name: 'white',
    family: 'white',
    shade: 0,
    hex: '#ffffff',
    rgb: whiteRgb,
    luminance: calculateRelativeLuminance(whiteRgb),
    oklab: rgbToOklab(whiteRgb),
  });

  for (const [family, shades] of Object.entries(RAW_TAILWIND_PALETTE)) {
    for (const [shadeStr, hex] of Object.entries(shades)) {
      const shade = Number(shadeStr);
      const rgb = parseCssColor(hex);
      const luminance = calculateRelativeLuminance(rgb);
      const oklab = rgbToOklab(rgb);

      tokens.push({
        name: `${family}-${shade}`,
        family,
        shade,
        hex,
        rgb,
        luminance,
        oklab,
      });
    }
  }

  return tokens;
}

export const TAILWIND_COLOR_TOKENS: TailwindColorToken[] = buildTailwindTokens();

// ---------------------------------------------------------------------------
// 5. Brand Hue Curve Contrast Remediation Solver
// ---------------------------------------------------------------------------

export interface ContrastSolveOptions {
  foreground: RGBColor | string;
  background: RGBColor | string;
  targetRatio?: number; // default 4.5:1 (WCAG 2.1 AA)
  originalClass?: string;
  property?: 'text' | 'bg' | 'border';
  preferredFamily?: string;
}

/**
 * Finds the closest compliant Tailwind CSS token to solve a contrast violation.
 * Preserves the brand hue curve by first prioritizing candidate tokens within the same
 * color family, minimizing the OKLab perceptual color distance (Delta E).
 */
export function solveContrastViolation(
  options: ContrastSolveOptions
): RemediationSuggestion | null {
  const fgRgb = typeof options.foreground === 'string' ? parseCssColor(options.foreground) : options.foreground;
  const bgRgb = typeof options.background === 'string' ? parseCssColor(options.background) : options.background;
  const targetRatio = options.targetRatio ?? 4.5;
  const property = options.property ?? 'text';

  const initialEval = evaluateContrast(fgRgb, bgRgb);
  if (initialEval.ratio >= targetRatio) {
    return null; // Already compliant
  }

  const bgLum = calculateRelativeLuminance(bgRgb);
  const fgOklab = rgbToOklab(fgRgb);

  // Extract color family from original class if present (e.g. "text-gray-400" -> "gray")
  let targetFamily = options.preferredFamily;
  if (!targetFamily && options.originalClass) {
    const classMatch = options.originalClass.match(/(?:text|bg|border)-([a-z]+)-(\d+)/);
    if (classMatch?.[1]) {
      targetFamily = classMatch[1];
    }
  }

  // If no family detected, determine nearest color family by minimum Delta E
  if (!targetFamily) {
    let nearestDist = Infinity;
    for (const token of TAILWIND_COLOR_TOKENS) {
      if (token.family === 'black' || token.family === 'white') continue;
      const dist = calculateDeltaE(fgOklab, token.oklab);
      if (dist < nearestDist) {
        nearestDist = dist;
        targetFamily = token.family;
      }
    }
  }

  // Step A: Find compliant candidates within the detected brand family
  const familyTokens = TAILWIND_COLOR_TOKENS.filter((t) => t.family === targetFamily);
  const compliantFamilyCandidates: Array<{ token: TailwindColorToken; ratio: number; deltaE: number }> = [];

  for (const token of familyTokens) {
    const ratio = calculateContrastRatio(token.luminance, bgLum);
    if (ratio >= targetRatio) {
      const deltaE = calculateDeltaE(fgOklab, token.oklab);
      compliantFamilyCandidates.push({ token, ratio, deltaE });
    }
  }

  // Step B: Sort candidates by minimum Delta E to minimize visual shift
  if (compliantFamilyCandidates.length > 0) {
    compliantFamilyCandidates.sort((a, b) => a.deltaE - b.deltaE);
    const best = compliantFamilyCandidates[0]!;

    const replacementClass =
      best.token.shade === 0
        ? `${property}-${best.token.name}`
        : `${property}-${best.token.family}-${best.token.shade}`;

    const suggestion: RemediationSuggestion = {
      originalColor: fgRgb,
      targetBackground: bgRgb,
      initialContrastRatio: initialEval.ratio,
      recommendedToken: best.token,
      resolvedContrastRatio: best.ratio,
      deltaE: best.deltaE,
      replacementClass,
    };
    if (options.originalClass) {
      suggestion.originalClass = options.originalClass;
    }
    return suggestion;
  }

  // Step C: Fallback to neutral grayscale families (slate, gray, zinc, black, white)
  const neutralFamilies = new Set(['slate', 'gray', 'zinc', 'neutral', 'stone', 'black', 'white']);
  const neutralCandidates: Array<{ token: TailwindColorToken; ratio: number; deltaE: number }> = [];

  for (const token of TAILWIND_COLOR_TOKENS) {
    if (neutralFamilies.has(token.family)) {
      const ratio = calculateContrastRatio(token.luminance, bgLum);
      if (ratio >= targetRatio) {
        const deltaE = calculateDeltaE(fgOklab, token.oklab);
        neutralCandidates.push({ token, ratio, deltaE });
      }
    }
  }

  if (neutralCandidates.length > 0) {
    neutralCandidates.sort((a, b) => a.deltaE - b.deltaE);
    const best = neutralCandidates[0]!;

    const replacementClass =
      best.token.shade === 0
        ? `${property}-${best.token.name}`
        : `${property}-${best.token.family}-${best.token.shade}`;

    const suggestion: RemediationSuggestion = {
      originalColor: fgRgb,
      targetBackground: bgRgb,
      initialContrastRatio: initialEval.ratio,
      recommendedToken: best.token,
      resolvedContrastRatio: best.ratio,
      deltaE: best.deltaE,
      replacementClass,
    };
    if (options.originalClass) {
      suggestion.originalClass = options.originalClass;
    }
    return suggestion;
  }

  // Step D: Ultimate fallback to black or white based on background luminance
  const fallbackToken = bgLum > 0.179 ? TAILWIND_COLOR_TOKENS.find((t) => t.name === 'black')! : TAILWIND_COLOR_TOKENS.find((t) => t.name === 'white')!;
  const fallbackRatio = calculateContrastRatio(fallbackToken.luminance, bgLum);
  const fallbackDeltaE = calculateDeltaE(fgOklab, fallbackToken.oklab);

  const fallbackSuggestion: RemediationSuggestion = {
    originalColor: fgRgb,
    targetBackground: bgRgb,
    initialContrastRatio: initialEval.ratio,
    recommendedToken: fallbackToken,
    resolvedContrastRatio: fallbackRatio,
    deltaE: fallbackDeltaE,
    replacementClass: `${property}-${fallbackToken.name}`,
  };
  if (options.originalClass) {
    fallbackSuggestion.originalClass = options.originalClass;
  }
  return fallbackSuggestion;
}
