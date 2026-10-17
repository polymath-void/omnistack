/**
 * Audio Memo Recorder Component Skeleton
 * Captures voice feedback notes when swiping left (REQUEST_CHANGES)
 * and prepares transcription for GitHub review commentary.
 */

import React, { useState, useEffect } from 'react';

export interface AudioMemoRecorderProps {
  onRecordingComplete: (feedbackText: string, audioUrl?: string) => void;
  onCancel: () => void;
  initialText?: string;
}

export type RecorderState = 'idle' | 'recording' | 'recorded' | 'transcribing';

export const AudioMemoRecorder: React.FC<AudioMemoRecorderProps> = ({
  onRecordingComplete,
  onCancel,
  initialText = '',
}) => {
  const [recorderState, setRecorderState] = useState<RecorderState>('idle');
  const [durationSeconds, setDurationSeconds] = useState(0);
  const [transcribedText, setTranscribedText] = useState(initialText);
  const [audioUrl, setAudioUrl] = useState<string | undefined>(undefined);

  useEffect(() => {
    let interval: NodeJS.Timeout | null = null;
    if (recorderState === 'recording') {
      interval = setInterval(() => {
        setDurationSeconds((prev) => prev + 1);
      }, 1000);
    }
    return () => {
      if (interval) clearInterval(interval);
    };
  }, [recorderState]);

  const handleStartRecording = () => {
    setRecorderState('recording');
    setDurationSeconds(0);
  };

  const handleStopRecording = () => {
    setRecorderState('transcribing');
    // Simulate Whisper / local speech transcription completion
    setTimeout(() => {
      const simulatedAudio = `https://omnistack.storage/audio/memo_${Date.now()}.m4a`;
      const fallbackTranscription =
        transcribedText ||
        'Please refactor the responsive grid breakpoints to preserve padding on 390px mobile viewports.';
      setAudioUrl(simulatedAudio);
      setTranscribedText(fallbackTranscription);
      setRecorderState('recorded');
    }, 1200);
  };

  const handleConfirm = () => {
    onRecordingComplete(transcribedText, audioUrl);
  };

  const formatTime = (secs: number) => {
    const m = Math.floor(secs / 60);
    const s = secs % 60;
    return `${m}:${s < 10 ? '0' : ''}${s}`;
  };

  return (
    <div
      style={{
        padding: '16px',
        backgroundColor: '#161b22',
        borderRadius: '12px',
        border: '1px solid #30363d',
        color: '#e6edf3',
        width: '100%',
        boxSizing: 'border-box',
      }}
    >
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <h4 style={{ margin: 0, fontSize: '15px', color: '#f85149' }}>
          🎙️ Voice Memo & Rejection Notes
        </h4>
        <span style={{ fontSize: '12px', color: '#8b949e' }}>
          {recorderState === 'recording' ? `Recording: ${formatTime(durationSeconds)}` : ''}
        </span>
      </div>

      {/* Waveform / Status Display */}
      <div
        style={{
          margin: '12px 0',
          padding: '12px',
          backgroundColor: '#0d1117',
          borderRadius: '8px',
          textAlign: 'center',
          minHeight: '48px',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
        }}
      >
        {recorderState === 'idle' && (
          <span style={{ color: '#8b949e', fontSize: '13px' }}>
            Tap 'Record Memo' or type feedback below
          </span>
        )}
        {recorderState === 'recording' && (
          <div style={{ display: 'flex', gap: '4px', alignItems: 'center' }}>
            <span style={{ color: '#f85149', fontWeight: 'bold' }}>● REC</span>
            <div style={{ display: 'flex', gap: '2px', alignItems: 'flex-end', height: '20px' }}>
              {[12, 18, 8, 22, 14, 24, 10, 16, 20].map((h, i) => (
                <div
                  key={i}
                  style={{
                    width: '3px',
                    height: `${h}px`,
                    backgroundColor: '#f85149',
                    borderRadius: '2px',
                  }}
                />
              ))}
            </div>
          </div>
        )}
        {recorderState === 'transcribing' && (
          <span style={{ color: '#d2a8ff', fontSize: '13px' }}>
            ⚡ Transcribing voice memo with Whisper AI...
          </span>
        )}
        {recorderState === 'recorded' && (
          <span style={{ color: '#3fb950', fontSize: '13px' }}>
            ✓ Audio memo captured ({formatTime(durationSeconds)})
          </span>
        )}
      </div>

      {/* Editable Transcription Text Box */}
      <textarea
        value={transcribedText}
        onChange={(e) => setTranscribedText(e.target.value)}
        placeholder="Type change request instructions or edit transcribed memo..."
        rows={3}
        style={{
          width: '100%',
          backgroundColor: '#0d1117',
          border: '1px solid #30363d',
          borderRadius: '6px',
          color: '#e6edf3',
          padding: '8px',
          fontSize: '13px',
          boxSizing: 'border-box',
          resize: 'vertical',
        }}
      />

      {/* Control Action Buttons */}
      <div
        style={{
          display: 'flex',
          justifyContent: 'space-between',
          marginTop: '12px',
          gap: '8px',
        }}
      >
        <button
          onClick={onCancel}
          style={{
            padding: '8px 12px',
            backgroundColor: '#21262d',
            color: '#c9d1d9',
            border: '1px solid #30363d',
            borderRadius: '6px',
            fontSize: '13px',
            cursor: 'pointer',
          }}
        >
          Cancel
        </button>

        <div style={{ display: 'flex', gap: '8px' }}>
          {recorderState === 'idle' && (
            <button
              onClick={handleStartRecording}
              style={{
                padding: '8px 14px',
                backgroundColor: '#da3633',
                color: '#fff',
                border: 'none',
                borderRadius: '6px',
                fontSize: '13px',
                fontWeight: 'bold',
                cursor: 'pointer',
              }}
            >
              Record Memo
            </button>
          )}

          {recorderState === 'recording' && (
            <button
              onClick={handleStopRecording}
              style={{
                padding: '8px 14px',
                backgroundColor: '#f85149',
                color: '#fff',
                border: 'none',
                borderRadius: '6px',
                fontSize: '13px',
                fontWeight: 'bold',
                cursor: 'pointer',
              }}
            >
              Stop & Transcribe
            </button>
          )}

          <button
            onClick={handleConfirm}
            disabled={!transcribedText.trim()}
            style={{
              padding: '8px 14px',
              backgroundColor: transcribedText.trim() ? '#238636' : '#21262d',
              color: transcribedText.trim() ? '#fff' : '#8b949e',
              border: 'none',
              borderRadius: '6px',
              fontSize: '13px',
              fontWeight: 'bold',
              cursor: transcribedText.trim() ? 'pointer' : 'not-allowed',
            }}
          >
            Submit Changes
          </button>
        </div>
      </div>
    </div>
  );
};
