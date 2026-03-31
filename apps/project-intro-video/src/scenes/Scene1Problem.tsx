import React from 'react';
import { useCurrentFrame, useVideoConfig, interpolate, spring } from 'remotion';
import { tokens } from '../tokens';
import { ToolCard, GapIndicator } from '../components/ToolCard';
import { Heading, Body } from '../components/Typography';

const LINES = [
  'Design lives in Figma.',
  'Work lives in Jira.',
  'Updates travel through Teams.',
  'Something is always out of sync.',
];

const TOOL_CARDS = [
  { name: 'Figma', icon: '◈', subtitle: 'Design files', accentColor: tokens.colors.accent },
  { name: 'Jira', icon: '◉', subtitle: 'Issue tracker', accentColor: tokens.colors.accentJira },
  { name: 'Teams', icon: '◎', subtitle: 'Update thread', accentColor: '#6264A7' },
];

export const Scene1Problem: React.FC = () => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();

  // Tool cards slide in from different directions
  const card0opacity = interpolate(frame, [10, 35], [0, 1], { extrapolateRight: 'clamp' });
  const card0y = interpolate(frame, [10, 35], [30, 0], { extrapolateRight: 'clamp' });

  const card1opacity = interpolate(frame, [25, 50], [0, 1], { extrapolateRight: 'clamp' });
  const card1y = interpolate(frame, [25, 50], [30, 0], { extrapolateRight: 'clamp' });

  const card2opacity = interpolate(frame, [40, 65], [0, 1], { extrapolateRight: 'clamp' });
  const card2y = interpolate(frame, [40, 65], [30, 0], { extrapolateRight: 'clamp' });

  // Gap lines fade in after cards
  const gapOpacity = interpolate(frame, [70, 95], [0, 1], { extrapolateRight: 'clamp' });

  // Text lines stagger in
  const lineOpacities = LINES.map((_, i) => {
    const start = 100 + i * 25;
    return interpolate(frame, [start, start + 25], [0, 1], { extrapolateRight: 'clamp' });
  });

  const lineYOffsets = LINES.map((_, i) => {
    const start = 100 + i * 25;
    return interpolate(frame, [start, start + 25], [16, 0], { extrapolateRight: 'clamp' });
  });

  // Last line (the key insight) uses accent color
  const lastLineAccent = interpolate(
    frame,
    [100 + 3 * 25 + 20, 100 + 3 * 25 + 45],
    [0, 1],
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
        gap: 60,
        fontFamily: tokens.font.family,
      }}
    >
      {/* Tool cards row */}
      <div
        style={{
          display: 'flex',
          flexDirection: 'row',
          alignItems: 'center',
          gap: 16,
        }}
      >
        <div style={{ opacity: card0opacity, transform: `translateY(${card0y}px)` }}>
          <ToolCard {...TOOL_CARDS[0]!} />
        </div>

        <div style={{ opacity: gapOpacity }}>
          <GapIndicator />
        </div>

        <div style={{ opacity: card1opacity, transform: `translateY(${card1y}px)` }}>
          <ToolCard {...TOOL_CARDS[1]!} />
        </div>

        <div style={{ opacity: gapOpacity }}>
          <GapIndicator />
        </div>

        <div style={{ opacity: card2opacity, transform: `translateY(${card2y}px)` }}>
          <ToolCard {...TOOL_CARDS[2]!} />
        </div>
      </div>

      {/* Text lines */}
      <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 16 }}>
        {LINES.map((line, i) => {
          const isLast = i === LINES.length - 1;
          return (
            <div
              key={i}
              style={{
                opacity: lineOpacities[i],
                transform: `translateY(${lineYOffsets[i]}px)`,
              }}
            >
              <Heading
                style={{
                  fontSize: isLast ? tokens.font.sizes.lg : tokens.font.sizes.md,
                  fontWeight: isLast ? tokens.font.weights.bold : tokens.font.weights.regular,
                  color: isLast
                    ? `color-mix(in srgb, ${tokens.colors.statusChanged} ${Math.round(lastLineAccent * 100)}%, ${tokens.colors.textSecondary})`
                    : tokens.colors.textSecondary,
                  textAlign: 'center',
                }}
              >
                {line}
              </Heading>
            </div>
          );
        })}
      </div>
    </div>
  );
};
