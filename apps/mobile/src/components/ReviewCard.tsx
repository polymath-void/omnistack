/**
 * PR Tinder Mobile Review Card Component Skeleton
 * Wired to MobileReviewEvent contracts, pairing visual before/after snapshot artifacts
 * with 390px line-wrapped 10-line mobile diff chunks and touch gesture physics.
 */

import React, { useState } from 'react';
import type { MobileReviewEvent, MobileSwipeAction } from '@omnistack/types';
import type { MobileDiffCard } from '@omnistack/github-bridge';
import { MobileDiffViewer } from './DiffViewer.js';
import { AudioMemoRecorder } from './AudioMemoRecorder.js';
import { SwipePhysicsEngine } from './SwipePhysicsEngine.js';

export interface ReviewCardProps {
  card: MobileDiffCard;
  projectId: string;
  prNumber: number;
  commitOid: string;
  reviewer: string;
  onReviewEvent: (event: MobileReviewEvent) => void;
  deviceModel?: string;
}

export const ReviewCard: React.FC<ReviewCardProps> = ({
  card,
  projectId,
  prNumber,
  commitOid,
  reviewer,
  onReviewEvent,
  deviceModel = 'iPhone 15 Pro (390px)',
}) => {
  const [snapshotView, setSnapshotView] = useState<'before' | 'after'>('after');
  const [isVoiceMemoOpen, setIsVoiceMemoOpen] = useState(false);
  const [stampFeedback, setStampFeedback] = useState<MobileSwipeAction | null>(null);

  const physicsEngine = React.useMemo(() => new SwipePhysicsEngine(), []);

  const dispatchEvent = (
    action: MobileSwipeAction,
    memo?: string,
    voiceUrl?: string
  ) => {
    setStampFeedback(action);

    const event = physicsEngine.createReviewEvent(action, {
      projectId,
      prNumber,
      commitOid,
      reviewer,
      deviceModel,
      ...(memo ? { feedbackMemo: memo } : {}),
      ...(voiceUrl ? { voiceMemoUrl: voiceUrl } : {}),
      ...(card.visualSnapshotBefore ? { beforeScreenshotUrl: card.visualSnapshotBefore } : {}),
      ...(card.visualSnapshotAfter ? { afterScreenshotUrl: card.visualSnapshotAfter } : {}),
    });

    setTimeout(() => {
      onReviewEvent(event);
      setStampFeedback(null);
    }, 450);
  };

  const handleApprove = () => {
    dispatchEvent('SWIPE_RIGHT_APPROVE');
  };

  const handleSwarmHeal = () => {
    dispatchEvent('SWIPE_UP_SWARM_HEAL', 'Remediate detected component issues via autonomous agent swarm.');
  };

  const handleRejectClick = () => {
    setIsVoiceMemoOpen(true);
  };

  const handleMemoComplete = (memoText: string, audioUrl?: string) => {
    setIsVoiceMemoOpen(false);
    dispatchEvent('SWIPE_LEFT_REJECT', memoText, audioUrl);
  };

  return (
    <div
      style={{
        width: '100%',
        maxWidth: '390px',
        backgroundColor: '#161b22',
        borderRadius: '16px',
        border: '1px solid #30363d',
        overflow: 'hidden',
        boxShadow: '0 8px 24px rgba(0, 0, 0, 0.45)',
        display: 'flex',
        flexDirection: 'column',
        position: 'relative',
        boxSizing: 'border-box',
      }}
    >
      {/* Dynamic Gesture Feedback Stamp Badges */}
      {stampFeedback === 'SWIPE_RIGHT_APPROVE' && (
        <div
          style={{
            position: 'absolute',
            top: '35%',
            left: '20px',
            transform: 'rotate(-15deg)',
            border: '4px solid #3fb950',
            color: '#3fb950',
            padding: '8px 16px',
            borderRadius: '8px',
            fontWeight: '900',
            fontSize: '24px',
            letterSpacing: '2px',
            zIndex: 100,
            backgroundColor: 'rgba(13, 17, 23, 0.85)',
          }}
        >
          APPROVED
        </div>
      )}

      {stampFeedback === 'SWIPE_LEFT_REJECT' && (
        <div
          style={{
            position: 'absolute',
            top: '35%',
            right: '20px',
            transform: 'rotate(15deg)',
            border: '4px solid #f85149',
            color: '#f85149',
            padding: '8px 16px',
            borderRadius: '8px',
            fontWeight: '900',
            fontSize: '22px',
            letterSpacing: '2px',
            zIndex: 100,
            backgroundColor: 'rgba(13, 17, 23, 0.85)',
          }}
        >
          CHANGES REQUESTED
        </div>
      )}

      {stampFeedback === 'SWIPE_UP_SWARM_HEAL' && (
        <div
          style={{
            position: 'absolute',
            top: '25%',
            left: '50%',
            transform: 'translateX(-50%)',
            border: '4px solid #d2a8ff',
            color: '#d2a8ff',
            padding: '8px 20px',
            borderRadius: '8px',
            fontWeight: '900',
            fontSize: '22px',
            letterSpacing: '2px',
            zIndex: 100,
            backgroundColor: 'rgba(13, 17, 23, 0.85)',
          }}
        >
          SWARM HEAL
        </div>
      )}

      {/* Card Header */}
      <div
        style={{
          padding: '12px 14px',
          backgroundColor: '#0d1117',
          borderBottom: '1px solid #30363d',
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
        }}
      >
        <div style={{ overflow: 'hidden' }}>
          <div style={{ fontSize: '11px', color: '#58a6ff', fontWeight: 'bold' }}>
            PR #{prNumber} • {projectId}
          </div>
          <div
            style={{
              fontSize: '13px',
              fontWeight: '600',
              color: '#e6edf3',
              whiteSpace: 'nowrap',
              overflow: 'hidden',
              textOverflow: 'ellipsis',
            }}
          >
            {card.filePath}
          </div>
        </div>

        {/* Chunk Progress Badge & Stats */}
        <div style={{ textAlign: 'right', flexShrink: 0 }}>
          <span
            style={{
              fontSize: '11px',
              backgroundColor: '#21262d',
              color: '#8b949e',
              padding: '2px 6px',
              borderRadius: '10px',
            }}
          >
            {card.chunkIndex + 1}/{card.totalChunks}
          </span>
          <div style={{ fontSize: '11px', marginTop: '3px' }}>
            <span style={{ color: '#3fb950' }}>+{card.stats.additions}</span>{' '}
            <span style={{ color: '#f85149' }}>-{card.stats.deletions}</span>
          </div>
        </div>
      </div>

      {/* Visual Snapshot Section: Before/After Comparison */}
      {(card.visualSnapshotBefore || card.visualSnapshotAfter) && (
        <div
          style={{
            backgroundColor: '#0d1117',
            borderBottom: '1px solid #30363d',
            padding: '8px',
          }}
        >
          <div
            style={{
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center',
              marginBottom: '6px',
            }}
          >
            <span style={{ fontSize: '11px', color: '#8b949e', fontWeight: '600' }}>
              VISUAL AUDIT SNAPSHOT
            </span>
            <div style={{ display: 'flex', gap: '4px' }}>
              <button
                onClick={() => setSnapshotView('before')}
                style={{
                  fontSize: '10px',
                  padding: '2px 8px',
                  borderRadius: '4px',
                  border: 'none',
                  backgroundColor: snapshotView === 'before' ? '#388bfd' : '#21262d',
                  color: '#fff',
                  cursor: 'pointer',
                }}
              >
                Before
              </button>
              <button
                onClick={() => setSnapshotView('after')}
                style={{
                  fontSize: '10px',
                  padding: '2px 8px',
                  borderRadius: '4px',
                  border: 'none',
                  backgroundColor: snapshotView === 'after' ? '#388bfd' : '#21262d',
                  color: '#fff',
                  cursor: 'pointer',
                }}
              >
                After (Live)
              </button>
            </div>
          </div>

          <div
            style={{
              width: '100%',
              height: '140px',
              backgroundColor: '#161b22',
              borderRadius: '6px',
              overflow: 'hidden',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              border: '1px solid #30363d',
            }}
          >
            {snapshotView === 'before' ? (
              card.visualSnapshotBefore ? (
                <img
                  src={card.visualSnapshotBefore}
                  alt="Snapshot Before"
                  style={{ width: '100%', height: '100%', objectFit: 'cover' }}
                />
              ) : (
                <span style={{ color: '#8b949e', fontSize: '11px' }}>
                  No pre-patch snapshot captured
                </span>
              )
            ) : card.visualSnapshotAfter ? (
              <img
                src={card.visualSnapshotAfter}
                alt="Snapshot After"
                style={{ width: '100%', height: '100%', objectFit: 'cover' }}
              />
            ) : (
              <span style={{ color: '#8b949e', fontSize: '11px' }}>
                No post-patch snapshot captured
              </span>
            )}
          </div>
        </div>
      )}

      {/* Diff Chunk Viewer Section */}
      <div style={{ padding: '8px' }}>
        <MobileDiffViewer lines={card.lines} hunkHeader={card.hunkHeader} />
      </div>

      {/* Voice Memo Modal for Rejection */}
      {isVoiceMemoOpen && (
        <div style={{ padding: '8px', borderTop: '1px solid #30363d' }}>
          <AudioMemoRecorder
            onRecordingComplete={handleMemoComplete}
            onCancel={() => setIsVoiceMemoOpen(false)}
          />
        </div>
      )}

      {/* Bottom Action Controls (Tap or Swipe) */}
      {!isVoiceMemoOpen && (
        <div
          style={{
            display: 'flex',
            justifyContent: 'space-around',
            alignItems: 'center',
            padding: '12px',
            backgroundColor: '#0d1117',
            borderTop: '1px solid #30363d',
          }}
        >
          {/* Swipe Left Button */}
          <button
            onClick={handleRejectClick}
            title="Swipe Left to Request Changes"
            style={{
              width: '44px',
              height: '44px',
              borderRadius: '22px',
              backgroundColor: 'rgba(248, 81, 73, 0.15)',
              border: '1px solid #f85149',
              color: '#f85149',
              fontSize: '18px',
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
            }}
          >
            ✕
          </button>

          {/* Swipe Up Button: Swarm Heal */}
          <button
            onClick={handleSwarmHeal}
            title="Swipe Up to Delegate to Swarm"
            style={{
              padding: '8px 16px',
              borderRadius: '20px',
              backgroundColor: 'rgba(210, 168, 255, 0.15)',
              border: '1px solid #d2a8ff',
              color: '#d2a8ff',
              fontSize: '13px',
              fontWeight: 'bold',
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              gap: '6px',
            }}
          >
            <span>⚡</span> Swarm Heal
          </button>

          {/* Swipe Right Button */}
          <button
            onClick={handleApprove}
            title="Swipe Right to Approve & Merge"
            style={{
              width: '44px',
              height: '44px',
              borderRadius: '22px',
              backgroundColor: 'rgba(63, 185, 80, 0.15)',
              border: '1px solid #3fb950',
              color: '#3fb950',
              fontSize: '20px',
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
            }}
          >
            ✓
          </button>
        </div>
      )}
    </div>
  );
};
