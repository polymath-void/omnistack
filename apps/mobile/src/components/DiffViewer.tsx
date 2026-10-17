/**
 * Mobile Diff Viewer Component Skeleton
 * Renders line-wrapped, syntax-highlighted 10-line diff chunks optimized for 390px portrait mobile screens.
 */

import React from 'react';
import type { MobileDiffLine, SyntaxTokenKind } from '@omnistack/github-bridge';

export interface MobileDiffViewerProps {
  lines: MobileDiffLine[];
  hunkHeader?: string;
  fontSize?: number;
  highlightSyntax?: boolean;
}

const TOKEN_COLOR_MAP: Record<SyntaxTokenKind, string> = {
  keyword: '#ff7b72',     // Red-orange
  string: '#a5d6ff',      // Light blue
  number: '#79c0ff',      // Cyan
  comment: '#8b949e',     // Muted gray
  operator: '#d2a8ff',    // Purple
  punctuation: '#c9d1d9', // Light gray
  identifier: '#f0f6fc',  // Bright white
  plain: '#c9d1d9',       // Body
};

export const MobileDiffViewer: React.FC<MobileDiffViewerProps> = ({
  lines,
  hunkHeader,
  fontSize = 11,
  highlightSyntax = true,
}) => {
  return (
    <div
      style={{
        width: '100%',
        maxWidth: '390px',
        backgroundColor: '#0d1117',
        borderRadius: '8px',
        overflow: 'hidden',
        border: '1px solid #30363d',
        fontFamily: 'ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace',
        fontSize: `${fontSize}px`,
        lineHeight: '1.45',
        boxSizing: 'border-box',
      }}
    >
      {/* Hunk Header */}
      {hunkHeader && (
        <div
          style={{
            padding: '4px 8px',
            backgroundColor: '#161b22',
            color: '#7ee787',
            fontSize: `${fontSize - 1}px`,
            borderBottom: '1px solid #30363d',
            whiteSpace: 'nowrap',
            overflow: 'hidden',
            textOverflow: 'ellipsis',
          }}
        >
          {hunkHeader}
        </div>
      )}

      {/* Diff Lines Table */}
      <div style={{ display: 'flex', flexDirection: 'column' }}>
        {lines.map((line, idx) => {
          const isAdd = line.type === 'add';
          const isDelete = line.type === 'delete';

          const bgColor = isAdd
            ? 'rgba(46, 160, 67, 0.15)'
            : isDelete
            ? 'rgba(248, 81, 73, 0.15)'
            : 'transparent';

          const markerColor = isAdd ? '#3fb950' : isDelete ? '#f85149' : '#8b949e';
          const markerSymbol = isAdd ? '+' : isDelete ? '-' : ' ';

          return (
            <div
              key={`diff_line_${idx}`}
              style={{
                display: 'flex',
                alignItems: 'flex-start',
                backgroundColor: bgColor,
                minHeight: '20px',
                borderLeft: isAdd
                  ? '3px solid #3fb950'
                  : isDelete
                  ? '3px solid #f85149'
                  : '3px solid transparent',
              }}
            >
              {/* Line Numbers Gutter */}
              <div
                style={{
                  width: '32px',
                  textAlign: 'right',
                  paddingRight: '6px',
                  color: '#484f58',
                  userSelect: 'none',
                  flexShrink: 0,
                }}
              >
                {!line.isWrapped ? (isDelete ? line.oldLineNumber : line.newLineNumber) : ''}
              </div>

              {/* Diff Marker Column */}
              <div
                style={{
                  width: '16px',
                  textAlign: 'center',
                  color: markerColor,
                  fontWeight: 'bold',
                  userSelect: 'none',
                  flexShrink: 0,
                }}
              >
                {line.isWrapped ? '↳' : markerSymbol}
              </div>

              {/* Code Content */}
              <div
                style={{
                  flex: 1,
                  paddingRight: '6px',
                  whiteSpace: 'pre-wrap',
                  wordBreak: 'break-all',
                  color: '#e6edf3',
                }}
              >
                {highlightSyntax && line.tokens.length > 0 ? (
                  line.tokens.map((token, tIdx) => (
                    <span
                      key={`token_${idx}_${tIdx}`}
                      style={{ color: TOKEN_COLOR_MAP[token.kind] || '#e6edf3' }}
                    >
                      {token.text}
                    </span>
                  ))
                ) : (
                  <span>{line.content}</span>
                )}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
};
