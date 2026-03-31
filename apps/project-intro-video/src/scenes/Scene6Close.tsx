import React from 'react';
import { useCurrentFrame, interpolate } from 'remotion';
import { tokens } from '../tokens';

const OUTCOME_LINES = [
  'Less context switching.',
  'Clearer handoff.',
  'Better developer confidence.',
];

export const Scene6Close: React.FC = () => {
  const frame = useCurrentFrame();

  const lineOpacities = OUTCOME_LINES.map((_, i) => {
    const start = 10 + i * 25;
    return interpolate(frame, [start, start + 25], [0, 1], { extrapolateRight: 'clamp' });
  });

  const lineYOffsets = OUTCOME_LINES.map((_, i) => {
    const start = 10 + i * 25;
    return interpolate(frame, [start, start + 25], [14, 0], { extrapolateRight: 'clamp' });
  });

  const dividerOpacity = interpolate(frame, [90, 110], [0, 1], { extrapolateRight: 'clamp' });

  const titleOpacity = interpolate(frame, [100, 125], [0, 1], { extrapolateRight: 'clamp' });
  const titleY = interpolate(frame, [100, 125], [12, 0], { extrapolateRight: 'clamp' });

  const ctaOpacity = interpolate(frame, [125, 150], [0, 1], { extrapolateRight: 'clamp' });
  const ctaY = interpolate(frame, [125, 150], [10, 0], { extrapolateRight: 'clamp' });

  // Accent line under title
  const accentScaleX = interpolate(frame, [120, 145], [0, 1], { extrapolateRight: 'clamp' });

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
        gap: 0,
        fontFamily: tokens.font.family,
      }}
    >
      {/* Outcome lines */}
      <div
        style={{
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          gap: 20,
          marginBottom: 48,
        }}
      >
        {OUTCOME_LINES.map((line, i) => (
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
                fontSize: tokens.font.sizes.lg,
                fontWeight: tokens.font.weights.semibold,
                color: tokens.colors.text,
                textAlign: 'center',
              }}
            >
              {line}
            </div>
          </div>
        ))}
      </div>

      {/* Divider */}
      <div
        style={{
          width: 280,
          height: 1,
          background: tokens.colors.border,
          opacity: dividerOpacity,
          marginBottom: 40,
        }}
      />

      {/* Project name */}
      <div
        style={{
          opacity: titleOpacity,
          transform: `translateY(${titleY}px)`,
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          gap: 8,
          marginBottom: 20,
        }}
      >
        <div
          style={{
            fontFamily: tokens.font.family,
            fontSize: tokens.font.sizes.xl,
            fontWeight: tokens.font.weights.bold,
            color: tokens.colors.text,
            textAlign: 'center',
            letterSpacing: '-0.02em',
          }}
        >
          Figma for Jira — Data Center
        </div>
        {/* Accent underline */}
        <div
          style={{
            height: 2,
            width: 240,
            background: `linear-gradient(90deg, ${tokens.colors.accent}, ${tokens.colors.accentJira})`,
            transform: `scaleX(${accentScaleX})`,
            transformOrigin: 'left center',
            borderRadius: 2,
          }}
        />
      </div>

      {/* CTA */}
      <div
        style={{
          opacity: ctaOpacity,
          transform: `translateY(${ctaY}px)`,
        }}
      >
        <div
          style={{
            fontFamily: tokens.font.family,
            fontSize: tokens.font.sizes.md,
            fontWeight: tokens.font.weights.regular,
            color: tokens.colors.textSecondary,
            textAlign: 'center',
          }}
        >
          Internal starter package. Available for engineering review.
        </div>
      </div>
    </div>
  );
};
