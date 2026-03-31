import React from 'react';
import { useCurrentFrame, interpolate } from 'remotion';
import { tokens } from '../tokens';
import { StatusChip, DesignStatus } from '../components/StatusChip';

const TEXT_LINES = [
  'When a design changes, Jira knows.',
  'Webhook sync. Polling fallback.',
  'Status updated automatically.',
];

export const Scene4ChangeDetection: React.FC = () => {
  const frame = useCurrentFrame();

  // Initial card shows "Ready for Dev"
  // At frame 60: badge appears
  // At frame 90: status transitions to "Changes After Dev"

  const cardOpacity = interpolate(frame, [0, 20], [0, 1], { extrapolateRight: 'clamp' });
  const cardY = interpolate(frame, [0, 20], [20, 0], { extrapolateRight: 'clamp' });

  // Badge fades in
  const badgeOpacity = interpolate(frame, [55, 75], [0, 1], { extrapolateRight: 'clamp' });
  const badgeScale = interpolate(frame, [55, 75], [0.8, 1], { extrapolateRight: 'clamp' });

  // Status chip transition: cross-fade from Ready for Dev to Changes After Dev
  const statusTransitionProgress = interpolate(frame, [85, 110], [0, 1], { extrapolateRight: 'clamp' });
  const currentStatus: DesignStatus = statusTransitionProgress > 0.5 ? 'Changes After Dev' : 'Ready for Dev';
  const statusOpacity = interpolate(
    statusTransitionProgress,
    [0, 0.4, 0.6, 1],
    [1, 0, 0, 1],
    { extrapolateRight: 'clamp' }
  );

  // Sync icon
  const syncOpacity = interpolate(frame, [75, 95], [0, 1], { extrapolateRight: 'clamp' });
  const syncY = interpolate(frame, [75, 95], [8, 0], { extrapolateRight: 'clamp' });

  // Polling label
  const pollingOpacity = interpolate(frame, [100, 120], [0, 1], { extrapolateRight: 'clamp' });

  // Text lines
  const lineOpacities = TEXT_LINES.map((_, i) => {
    const start = 130 + i * 18;
    return interpolate(frame, [start, start + 18], [0, 1], { extrapolateRight: 'clamp' });
  });
  const lineYOffsets = TEXT_LINES.map((_, i) => {
    const start = 130 + i * 18;
    return interpolate(frame, [start, start + 18], [10, 0], { extrapolateRight: 'clamp' });
  });

  // Subtle pulse on the card when badge appears
  const pulseScale = interpolate(
    frame,
    [55, 65, 75],
    [1, 1.012, 1],
    { extrapolateRight: 'clamp' }
  );

  return (
    <div
      style={{
        width: '100%',
        height: '100%',
        background: tokens.colors.bg,
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        gap: 40,
        fontFamily: tokens.font.family,
      }}
    >
      {/* Design card with live state */}
      <div
        style={{
          opacity: cardOpacity,
          transform: `translateY(${cardY}px) scale(${pulseScale})`,
          position: 'relative',
        }}
      >
        <div
          style={{
            background: tokens.colors.bgCard,
            border: `1px solid ${tokens.colors.border}`,
            borderRadius: 10,
            overflow: 'hidden',
            width: 380,
            position: 'relative',
          }}
        >
          {/* Thumbnail */}
          <div
            style={{
              width: '100%',
              height: 200,
              background: '#1A1A2E',
              border: `2px dashed #3A3A5E`,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              color: '#5A5A7A',
              fontSize: 13,
              flexDirection: 'column',
              gap: 8,
            }}
          >
            <div style={{ fontSize: 32 }}>◻</div>
            <div>[SCREENSHOT: Figma frame thumbnail]</div>
          </div>

          {/* Change badge overlay */}
          <div
            style={{
              position: 'absolute',
              top: 12,
              right: 12,
              opacity: badgeOpacity,
              transform: `scale(${badgeScale})`,
              transformOrigin: 'top right',
            }}
          >
            <div
              style={{
                background: tokens.colors.statusChanged,
                color: '#fff',
                fontSize: 12,
                fontWeight: tokens.font.weights.semibold,
                paddingLeft: 10,
                paddingRight: 10,
                paddingTop: 4,
                paddingBottom: 4,
                borderRadius: 20,
                fontFamily: tokens.font.family,
                display: 'flex',
                alignItems: 'center',
                gap: 5,
              }}
            >
              <div
                style={{
                  width: 6,
                  height: 6,
                  borderRadius: '50%',
                  background: '#fff',
                  flexShrink: 0,
                }}
              />
              Design updated
            </div>
          </div>

          {/* Card body */}
          <div style={{ padding: '14px 16px', display: 'flex', flexDirection: 'column', gap: 8 }}>
            <div
              style={{
                fontSize: 15,
                fontWeight: tokens.font.weights.semibold,
                color: tokens.colors.text,
              }}
            >
              checkout-flow-v3.fig
            </div>
            <div style={{ fontSize: 13, color: tokens.colors.textSecondary }}>
              Frame: Payment Screen
            </div>
            <div
              style={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                marginTop: 4,
              }}
            >
              <div style={{ fontSize: 12, color: tokens.colors.textSecondary }}>
                Last modified: just now
              </div>
              <div style={{ opacity: statusOpacity }}>
                <StatusChip status={currentStatus} />
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Sync indicator */}
      <div
        style={{
          opacity: syncOpacity,
          transform: `translateY(${syncY}px)`,
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          gap: 10,
        }}
      >
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: 8,
            background: `${tokens.colors.accent}18`,
            border: `1px solid ${tokens.colors.accent}44`,
            paddingLeft: 16,
            paddingRight: 16,
            paddingTop: 8,
            paddingBottom: 8,
            borderRadius: 20,
          }}
        >
          <div style={{ fontSize: 14, color: tokens.colors.accent }}>⟳</div>
          <div
            style={{
              fontSize: 13,
              fontWeight: tokens.font.weights.medium,
              color: tokens.colors.accent,
            }}
          >
            Webhook detected change
          </div>
        </div>

        {/* Polling fallback label */}
        <div style={{ opacity: pollingOpacity }}>
          <div
            style={{
              fontSize: 12,
              color: tokens.colors.textSecondary,
              textAlign: 'center',
            }}
          >
            Polling fallback: every 30 min
          </div>
        </div>
      </div>

      {/* Text lines */}
      <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 10 }}>
        {TEXT_LINES.map((line, i) => (
          <div
            key={i}
            style={{
              opacity: lineOpacities[i],
              transform: `translateY(${lineYOffsets[i]}px)`,
            }}
          >
            <div
              style={{
                fontFamily: tokens.font.family,
                fontSize: i === 0 ? tokens.font.sizes.lg : tokens.font.sizes.md,
                fontWeight: i === 0 ? tokens.font.weights.semibold : tokens.font.weights.regular,
                color: i === 0 ? tokens.colors.text : tokens.colors.textSecondary,
                textAlign: 'center',
              }}
            >
              {line}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
};
