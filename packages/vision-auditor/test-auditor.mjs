import {
  calculateRelativeLuminance,
  calculateContrastRatio,
  evaluateContrast,
  parseCssColor,
  rgbToOklab,
  calculateDeltaE,
  solveContrastViolation,
  TAILWIND_COLOR_TOKENS,
  VIEWPORT_PROFILES,
  resolveBrowserExecutablePath,
} from './dist/index.js';

function assert(condition, message) {
  if (!condition) {
    console.error('Assertion failed:', message);
    process.exit(1);
  }
}

console.log('--- Testing IEC 61966-2-1 Relative Luminance ---');
const black = parseCssColor('#000000');
const white = parseCssColor('#ffffff');
const blackLum = calculateRelativeLuminance(black);
const whiteLum = calculateRelativeLuminance(white);

assert(blackLum === 0, `Black luminance should be 0, got ${blackLum}`);
assert(Math.abs(whiteLum - 1.0) < 0.0001, `White luminance should be 1.0, got ${whiteLum}`);

console.log(`Black L: ${blackLum}, White L: ${whiteLum} - PASS`);

console.log('--- Testing WCAG Contrast Ratio ---');
const maxCr = calculateContrastRatio(whiteLum, blackLum);
const minCr = calculateContrastRatio(whiteLum, whiteLum);
assert(maxCr === 21.0, `White/Black contrast should be 21:1, got ${maxCr}`);
assert(minCr === 1.0, `White/White contrast should be 1:1, got ${minCr}`);

console.log(`CR White/Black: ${maxCr}:1, White/White: ${minCr}:1 - PASS`);

console.log('--- Testing Contrast Evaluation of text-gray-400 on white ---');
// text-gray-400 is #9ca3af
const gray400 = parseCssColor('#9ca3af');
const evalResult = evaluateContrast(gray400, white);
console.log(`Contrast ratio of #9ca3af on white: ${evalResult.ratio}:1`);
assert(evalResult.ratio < 4.5, `gray-400 on white should fail AA (< 4.5), got ${evalResult.ratio}`);
assert(!evalResult.passesAA, 'Should not pass AA');

console.log('--- Testing OKLab & Brand Hue Curve Solver ---');
const solution = solveContrastViolation({
  foreground: gray400,
  background: white,
  targetRatio: 4.5,
  originalClass: 'text-gray-400',
  property: 'text',
});

assert(solution !== null, 'Solution should not be null');
console.log('Recommended Replacement:', solution.replacementClass);
console.log('Initial Ratio:', solution.initialContrastRatio);
console.log('Resolved Ratio:', solution.resolvedContrastRatio);
console.log('Delta E:', solution.deltaE);

assert(solution.resolvedContrastRatio >= 4.5, `Resolved ratio must be >= 4.5, got ${solution.resolvedContrastRatio}`);
assert(solution.replacementClass.startsWith('text-gray-'), `Should preserve brand hue family 'gray', got ${solution.replacementClass}`);

console.log('--- Testing Viewport Profiles ---');
assert(VIEWPORT_PROFILES.mobile.width === 390 && VIEWPORT_PROFILES.mobile.height === 844 && VIEWPORT_PROFILES.mobile.deviceScaleFactor === 3.0, 'Mobile profile match');
assert(VIEWPORT_PROFILES.tablet.width === 768 && VIEWPORT_PROFILES.tablet.height === 1024 && VIEWPORT_PROFILES.tablet.deviceScaleFactor === 2.0, 'Tablet profile match');
assert(VIEWPORT_PROFILES.desktop.width === 1440 && VIEWPORT_PROFILES.desktop.height === 900 && VIEWPORT_PROFILES.desktop.deviceScaleFactor === 1.0, 'Desktop profile match');

console.log('--- Testing Browser Executable Detection ---');
const detectedPath = resolveBrowserExecutablePath();
console.log('Detected Chrome/Edge Path:', detectedPath);
assert(typeof detectedPath === 'string' && detectedPath.length > 0, 'Chrome/Edge executable detected');

console.log('\nAll Vision Auditor Math, OKLab, Viewport, and Solver tests PASSED!');
