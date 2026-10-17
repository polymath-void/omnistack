/**
 * Mobile Diff Chunker (390px Viewport)
 * Converts wide horizontal Git diffs into narrow, line-wrapped,
 * syntax-tokenized 10-line mobile cards tailored for PR Tinder mobile review.
 */

import type { DiffChunk, FileDiffSummary } from '@omnistack/types';

export const MOBILE_VIEWPORT_WIDTH_PX = 390;
export const DEFAULT_MAX_CHARS_PER_LINE = 38;
export const DEFAULT_LINES_PER_CARD = 10;

export type DiffLineType = 'add' | 'delete' | 'context' | 'meta' | 'header';

export type SyntaxTokenKind =
  | 'keyword'
  | 'string'
  | 'number'
  | 'comment'
  | 'operator'
  | 'punctuation'
  | 'identifier'
  | 'plain';

export interface DiffLineToken {
  text: string;
  kind: SyntaxTokenKind;
}

export interface MobileDiffLine {
  type: DiffLineType;
  raw: string;
  content: string;
  oldLineNumber?: number;
  newLineNumber?: number;
  isWrapped?: boolean;
  indent: number;
  tokens: DiffLineToken[];
}

export interface MobileDiffCard {
  cardId: string;
  filePath: string;
  oldFilePath?: string;
  chunkIndex: number;
  totalChunks: number;
  hunkHeader: string;
  oldStart: number;
  oldLines: number;
  newStart: number;
  newLines: number;
  lines: MobileDiffLine[];
  lineCount: number;
  rawChunkText: string;
  visualSnapshotBefore?: string;
  visualSnapshotAfter?: string;
  stats: {
    additions: number;
    deletions: number;
  };
  isFirstChunk: boolean;
  isLastChunk: boolean;
  metadata: {
    targetWidthPx: number;
    maxCharsPerLine: number;
  };
}

export interface VisualSnapshotPair {
  filePath: string;
  componentName?: string;
  beforeUrl?: string;
  afterUrl?: string;
}

export interface ChunkerOptions {
  maxCharsPerLine?: number;
  linesPerCard?: number;
  targetWidthPx?: number;
  snapshots?: VisualSnapshotPair[];
}

const JS_TS_KEYWORDS = new Set([
  'abstract', 'any', 'as', 'async', 'await', 'boolean', 'break', 'case', 'catch',
  'class', 'const', 'continue', 'debugger', 'declare', 'default', 'delete', 'do',
  'else', 'enum', 'export', 'extends', 'false', 'finally', 'for', 'from', 'function',
  'get', 'if', 'implements', 'import', 'in', 'instanceof', 'interface', 'is', 'keyof',
  'let', 'module', 'namespace', 'never', 'new', 'null', 'number', 'of', 'package',
  'private', 'protected', 'public', 'readonly', 'require', 'return', 'set', 'static',
  'string', 'super', 'switch', 'symbol', 'this', 'throw', 'true', 'try', 'type',
  'typeof', 'undefined', 'unique', 'unknown', 'var', 'void', 'while', 'with', 'yield'
]);

/**
 * Tokenizes a single code line into syntax highlighting tokens for mobile rendering.
 */
export function tokenizeDiffLine(content: string): DiffLineToken[] {
  const tokens: DiffLineToken[] = [];
  let index = 0;
  const length = content.length;

  while (index < length) {
    const char = content[index];

    // Single line comments
    if (char === '/' && index + 1 < length && content[index + 1] === '/') {
      tokens.push({
        text: content.slice(index),
        kind: 'comment',
      });
      break;
    }

    // Hash comments (Python/Shell)
    if (char === '#') {
      tokens.push({
        text: content.slice(index),
        kind: 'comment',
      });
      break;
    }

    // String literals (single, double, or backtick)
    if (char === '"' || char === "'" || char === '`') {
      const quote = char;
      let end = index + 1;
      let escaped = false;
      while (end < length) {
        if (content[end] === '\\') {
          escaped = !escaped;
        } else if (content[end] === quote && !escaped) {
          end++;
          break;
        } else {
          escaped = false;
        }
        end++;
      }
      tokens.push({
        text: content.slice(index, end),
        kind: 'string',
      });
      index = end;
      continue;
    }

    // Numbers
    if (/\d/.test(char ?? '')) {
      let end = index;
      while (end < length && /[\d._xXa-fA-F]/.test(content[end] ?? '')) {
        end++;
      }
      tokens.push({
        text: content.slice(index, end),
        kind: 'number',
      });
      index = end;
      continue;
    }

    // Identifiers and Keywords
    if (/[a-zA-Z_$]/.test(char ?? '')) {
      let end = index;
      while (end < length && /[a-zA-Z0-9_$]/.test(content[end] ?? '')) {
        end++;
      }
      const word = content.slice(index, end);
      const isKeyword = JS_TS_KEYWORDS.has(word);
      tokens.push({
        text: word,
        kind: isKeyword ? 'keyword' : 'identifier',
      });
      index = end;
      continue;
    }

    // Multi-character operators
    const twoChars = content.slice(index, index + 2);
    const threeChars = content.slice(index, index + 3);

    if (['===', '!==', '>>>', '<<=', '>>='].includes(threeChars)) {
      tokens.push({ text: threeChars, kind: 'operator' });
      index += 3;
      continue;
    }

    if (['=>', '==', '!=', '<=', '>=', '&&', '||', '??', '++', '--', '+=', '-=', '*=', '/='].includes(twoChars)) {
      tokens.push({ text: twoChars, kind: 'operator' });
      index += 2;
      continue;
    }

    // Single character operators and punctuation
    if (/[+\-*\/%=<>!&|^~?:;,.]/.test(char ?? '')) {
      tokens.push({ text: char ?? '', kind: 'operator' });
      index++;
      continue;
    }

    if (/[()[\]{}]/.test(char ?? '')) {
      tokens.push({ text: char ?? '', kind: 'punctuation' });
      index++;
      continue;
    }

    // Whitespace and plain characters
    let end = index;
    while (end < length && /[\s]/.test(content[end] ?? '')) {
      end++;
    }
    if (end > index) {
      tokens.push({
        text: content.slice(index, end),
        kind: 'plain',
      });
      index = end;
      continue;
    }

    tokens.push({
      text: char ?? '',
      kind: 'plain',
    });
    index++;
  }

  return tokens;
}

/**
 * Line-wraps a diff line to fit cleanly within mobile screen column width without horizontal scroll.
 * Continuation lines preserve diff line type and receive isWrapped: true flag.
 */
export function wrapDiffLine(
  rawLine: string,
  type: DiffLineType,
  oldLineNumber?: number,
  newLineNumber?: number,
  maxCharsPerLine: number = DEFAULT_MAX_CHARS_PER_LINE
): MobileDiffLine[] {
  // Strip leading diff marker character (+, -, or space) for content wrapping
  let marker = ' ';
  let content = rawLine;

  if (type === 'add' && rawLine.startsWith('+')) {
    marker = '+';
    content = rawLine.slice(1);
  } else if (type === 'delete' && rawLine.startsWith('-')) {
    marker = '-';
    content = rawLine.slice(1);
  } else if (type === 'context' && rawLine.startsWith(' ')) {
    marker = ' ';
    content = rawLine.slice(1);
  }

  // Count leading spaces for indent calculation
  const matchIndent = content.match(/^(\s*)/);
  const leadingIndent = matchIndent && matchIndent[1] ? matchIndent[1].length : 0;

  if (content.length <= maxCharsPerLine) {
    return [
      {
        type,
        raw: rawLine,
        content,
        ...(oldLineNumber !== undefined ? { oldLineNumber } : {}),
        ...(newLineNumber !== undefined ? { newLineNumber } : {}),
        isWrapped: false,
        indent: leadingIndent,
        tokens: tokenizeDiffLine(content),
      },
    ];
  }

  // Wrap long line across multiple mobile lines
  const result: MobileDiffLine[] = [];
  let remaining = content;
  let isFirst = true;

  while (remaining.length > 0) {
    let wrapLength = maxCharsPerLine;

    // On continuation lines, reserve 2 chars for continuation indent indicator
    if (!isFirst) {
      wrapLength = Math.max(10, maxCharsPerLine - 2);
    }

    if (remaining.length <= wrapLength) {
      const slice = remaining;
      result.push({
        type,
        raw: isFirst ? `${marker}${slice}` : ` ${slice}`,
        content: isFirst ? slice : `  ${slice}`,
        ...(isFirst && oldLineNumber !== undefined ? { oldLineNumber } : {}),
        ...(isFirst && newLineNumber !== undefined ? { newLineNumber } : {}),
        isWrapped: !isFirst,
        indent: isFirst ? leadingIndent : leadingIndent + 2,
        tokens: tokenizeDiffLine(isFirst ? slice : `  ${slice}`),
      });
      break;
    }

    // Try to find natural word/symbol break point
    let breakPoint = -1;
    const searchSlice = remaining.slice(0, wrapLength);
    const breakChars = [' ', ',', '.', ';', '(', ')', '{', '}', '[', ']', ':', '>', '<'];

    for (let i = searchSlice.length - 1; i >= Math.floor(wrapLength * 0.6); i--) {
      const charAt = searchSlice[i];
      if (charAt && breakChars.includes(charAt)) {
        breakPoint = i + 1;
        break;
      }
    }

    if (breakPoint === -1) {
      breakPoint = wrapLength;
    }

    const currentSlice = remaining.slice(0, breakPoint);
    remaining = remaining.slice(breakPoint);

    result.push({
      type,
      raw: isFirst ? `${marker}${currentSlice}` : ` ${currentSlice}`,
      content: isFirst ? currentSlice : `  ${currentSlice}`,
      ...(isFirst && oldLineNumber !== undefined ? { oldLineNumber } : {}),
      ...(isFirst && newLineNumber !== undefined ? { newLineNumber } : {}),
      isWrapped: !isFirst,
      indent: isFirst ? leadingIndent : leadingIndent + 2,
      tokens: tokenizeDiffLine(isFirst ? currentSlice : `  ${currentSlice}`),
    });

    isFirst = false;
  }

  return result;
}

interface ParsedHunk {
  header: string;
  oldStart: number;
  oldLines: number;
  newStart: number;
  newLines: number;
  lines: Array<{
    type: DiffLineType;
    raw: string;
    oldLine?: number;
    newLine?: number;
  }>;
}

interface ParsedFileDiff {
  filePath: string;
  oldFilePath?: string;
  hunks: ParsedHunk[];
  additions: number;
  deletions: number;
}

/**
 * Parses raw unified git diff string into structured file diffs and hunks.
 */
export function parseUnifiedDiff(rawDiff: string): ParsedFileDiff[] {
  const files: ParsedFileDiff[] = [];
  const lines = rawDiff.split(/\r?\n/);

  let currentFile: ParsedFileDiff | null = null;
  let currentHunk: ParsedHunk | null = null;
  let oldLineCounter = 0;
  let newLineCounter = 0;

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i] ?? '';

    // File header: diff --git a/path b/path
    if (line.startsWith('diff --git')) {
      const parts = line.split(' ');
      const bPath = parts[parts.length - 1] ?? '';
      const aPath = parts[parts.length - 2] ?? '';
      const filePath = bPath.replace(/^[ab]\//, '');
      const oldFilePath = aPath.replace(/^[ab]\//, '');

      const newFile: ParsedFileDiff = {
        filePath,
        hunks: [],
        additions: 0,
        deletions: 0,
        ...(oldFilePath !== filePath ? { oldFilePath } : {}),
      };
      currentFile = newFile;
      files.push(newFile);
      currentHunk = null;
      continue;
    }

    // Hunk header: @@ -oldStart,oldLines +newStart,newLines @@
    const hunkMatch = line.match(/^@@ -(\d+)(?:,(\d+))? \+(\d+)(?:,(\d+))? @@(.*)$/);
    if (hunkMatch) {
      if (!currentFile) {
        // Fallback file entry if diff didn't have git headers
        const fallbackFile: ParsedFileDiff = {
          filePath: 'changes.diff',
          hunks: [],
          additions: 0,
          deletions: 0,
        };
        currentFile = fallbackFile;
        files.push(fallbackFile);
      }

      const oldStart = parseInt(hunkMatch[1] ?? '1', 10);
      const oldLines = hunkMatch[2] ? parseInt(hunkMatch[2], 10) : 1;
      const newStart = parseInt(hunkMatch[3] ?? '1', 10);
      const newLines = hunkMatch[4] ? parseInt(hunkMatch[4], 10) : 1;

      oldLineCounter = oldStart;
      newLineCounter = newStart;

      currentHunk = {
        header: line,
        oldStart,
        oldLines,
        newStart,
        newLines,
        lines: [],
      };
      currentFile.hunks.push(currentHunk);
      continue;
    }

    if (!currentHunk || !currentFile) {
      continue;
    }

    if (line.startsWith('+') && !line.startsWith('+++')) {
      currentHunk.lines.push({
        type: 'add',
        raw: line,
        newLine: newLineCounter++,
      });
      currentFile.additions++;
    } else if (line.startsWith('-') && !line.startsWith('---')) {
      currentHunk.lines.push({
        type: 'delete',
        raw: line,
        oldLine: oldLineCounter++,
      });
      currentFile.deletions++;
    } else if (line.startsWith(' ') || line === '') {
      currentHunk.lines.push({
        type: 'context',
        raw: line,
        oldLine: oldLineCounter++,
        newLine: newLineCounter++,
      });
    }
  }

  return files;
}

/**
 * Transforms unified git diff string into line-wrapped 390px mobile diff cards.
 * Splits diff hunks into 10-line mobile chunks and attaches visual before/after snapshots.
 */
export function chunkDiffForMobile(
  rawDiff: string,
  options: ChunkerOptions = {}
): MobileDiffCard[] {
  const maxChars = options.maxCharsPerLine ?? DEFAULT_MAX_CHARS_PER_LINE;
  const linesPerCard = options.linesPerCard ?? DEFAULT_LINES_PER_CARD;
  const targetWidthPx = options.targetWidthPx ?? MOBILE_VIEWPORT_WIDTH_PX;
  const parsedFiles = parseUnifiedDiff(rawDiff);

  const cards: MobileDiffCard[] = [];

  for (const file of parsedFiles) {
    const fileWrappedLines: MobileDiffLine[] = [];
    let fileHunkHeader = '';
    let fileOldStart = 1;
    let fileOldLines = 0;
    let fileNewStart = 1;
    let fileNewLines = 0;

    for (const hunk of file.hunks) {
      if (!fileHunkHeader) {
        fileHunkHeader = hunk.header;
        fileOldStart = hunk.oldStart;
        fileNewStart = hunk.newStart;
      }
      fileOldLines += hunk.oldLines;
      fileNewLines += hunk.newLines;

      for (const item of hunk.lines) {
        const wrapped = wrapDiffLine(
          item.raw,
          item.type,
          item.oldLine,
          item.newLine,
          maxChars
        );
        fileWrappedLines.push(...wrapped);
      }
    }

    if (fileWrappedLines.length === 0) {
      continue;
    }

    const totalChunks = Math.max(1, Math.ceil(fileWrappedLines.length / linesPerCard));

    for (let c = 0; c < totalChunks; c++) {
      const sliceStart = c * linesPerCard;
      const sliceEnd = Math.min(sliceStart + linesPerCard, fileWrappedLines.length);
      const cardLines = fileWrappedLines.slice(sliceStart, sliceEnd);

      let chunkAdds = 0;
      let chunkDels = 0;
      for (const line of cardLines) {
        if (line.type === 'add' && !line.isWrapped) chunkAdds++;
        if (line.type === 'delete' && !line.isWrapped) chunkDels++;
      }

      // Reconstruct raw text preview for this chunk
      const rawChunkText = cardLines.map((l) => l.raw).join('\n');
      const safeFilePath = file.filePath.replace(/[^a-zA-Z0-9_-]/g, '_');
      const cardId = `diff_${safeFilePath}_chunk_${c + 1}_of_${totalChunks}`;

      const card: MobileDiffCard = {
        cardId,
        filePath: file.filePath,
        chunkIndex: c,
        totalChunks,
        hunkHeader: fileHunkHeader || `@@ -${fileOldStart},${fileOldLines} +${fileNewStart},${fileNewLines} @@`,
        oldStart: fileOldStart,
        oldLines: fileOldLines,
        newStart: fileNewStart,
        newLines: fileNewLines,
        lines: cardLines,
        lineCount: cardLines.length,
        rawChunkText,
        stats: {
          additions: chunkAdds,
          deletions: chunkDels,
        },
        isFirstChunk: c === 0,
        isLastChunk: c === totalChunks - 1,
        metadata: {
          targetWidthPx,
          maxCharsPerLine: maxChars,
        },
      };

      if (file.oldFilePath) {
        card.oldFilePath = file.oldFilePath;
      }

      cards.push(card);
    }
  }

  // Pair visual snapshots if provided
  if (options.snapshots && options.snapshots.length > 0) {
    return pairVisualSnapshots(cards, options.snapshots);
  }

  return cards;
}

/**
 * Pairs visual before/after snapshot image artifacts with diff cards matching by file path or component.
 */
export function pairVisualSnapshots(
  cards: MobileDiffCard[],
  snapshots: VisualSnapshotPair[]
): MobileDiffCard[] {
  const snapshotMap = new Map<string, VisualSnapshotPair>();

  for (const s of snapshots) {
    const normalized = s.filePath.replace(/^[./\\]+/, '').toLowerCase();
    snapshotMap.set(normalized, s);
    if (s.componentName) {
      snapshotMap.set(s.componentName.toLowerCase(), s);
    }
  }

  return cards.map((card) => {
    const cardNorm = card.filePath.replace(/^[./\\]+/, '').toLowerCase();
    const fileNameOnly = cardNorm.split('/').pop()?.replace(/\.[^/.]+$/, '') ?? '';

    const matchedSnapshot = snapshotMap.get(cardNorm) || snapshotMap.get(fileNameOnly);
    if (!matchedSnapshot) {
      return card;
    }

    const updated = { ...card };
    if (matchedSnapshot.beforeUrl) {
      updated.visualSnapshotBefore = matchedSnapshot.beforeUrl;
    }
    if (matchedSnapshot.afterUrl) {
      updated.visualSnapshotAfter = matchedSnapshot.afterUrl;
    }
    return updated;
  });
}

/**
 * Converts mobile diff cards into domain FileDiffSummary arrays conforming to @omnistack/types.
 */
export function toFileDiffSummary(cards: MobileDiffCard[]): FileDiffSummary[] {
  const map = new Map<string, { additions: number; deletions: number; chunks: DiffChunk[] }>();

  for (const card of cards) {
    const existing = map.get(card.filePath) ?? {
      additions: 0,
      deletions: 0,
      chunks: [],
    };

    existing.additions += card.stats.additions;
    existing.deletions += card.stats.deletions;

    existing.chunks.push({
      oldStart: card.oldStart,
      oldLines: card.oldLines,
      newStart: card.newStart,
      newLines: card.newLines,
      lines: card.lines.map((l) => l.raw),
    });

    map.set(card.filePath, existing);
  }

  const result: FileDiffSummary[] = [];
  for (const [filePath, data] of map.entries()) {
    result.push({
      path: filePath,
      additions: data.additions,
      deletions: data.deletions,
      chunks: data.chunks,
    });
  }

  return result;
}
