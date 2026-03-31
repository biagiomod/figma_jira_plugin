import React from 'react';
import { useCurrentFrame, interpolate } from 'remotion';
import { tokens } from '../tokens';
import { CostCard } from '../components/CostCard';
import { Heading } from '../components/Typography';

const COST_CARDS = [
  {
    title: 'Status ambiguity.',
    description: '"Which version is this?" Nobody can confirm which design state is current.',
  },
  {
    title: 'Handoff uncertainty.',
    description: '"Is this ready to build?" Developers are left guessing whether specs are finalized.',
  },
  {
    title: 'Rework.',
    description: 'A build starts from an outdated spec. The design changed. Hours lost.',
  },
];

export const Scene2Cost: React.FC = () => {
  const frame = useCurrentFrame();

  // Scene-local frame (starts from 0 within this composition slice)
  const cardOpacities = COST_CARDS.map((_, i) => {
    const start = 10 + i * 30;
    return interpolate(frame, [start, start + 25], [0, 1], { extrapolateRight: 'clamp' });
  });

  const cardYOffsets = COST_CARDS.map((_, i) => {
    const start = 10 + i * 30;
    return interpolate(frame, [start, start + 25], [24, 0], { extrapolateRight: 'clamp' });
  });

  const headingOpacity = interpolate(frame, [5, 30], [0, 1], { extrapolateRight: 'clamp' });
  const headingY = interpolate(frame, [5, 30], [16, 0], { extrapolateRight: 'clamp' });

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
        gap: 48,
        fontFamily: tokens.font.family,
      }}
    >
      <div
        style={{
          opacity: headingOpacity,
          transform: `translateY(${headingY}px)`,
        }}
      >
        <Heading
          style={{
            textAlign: 'center',
            color: tokens.colors.textSecondary,
            fontSize: tokens.font.sizes.sm,
            fontWeight: tokens.font.weights.medium,
            letterSpacing: '0.1em',
            textTransform: 'uppercase',
          }}
        >
          The cost of disconnected tools
        </Heading>
      </div>

      <div
        style={{
          display: 'flex',
          flexDirection: 'row',
          gap: 24,
          alignItems: 'flex-start',
        }}
      >
        {COST_CARDS.map((card, i) => (
          <div
            key={i}
            style={{
              opacity: cardOpacities[i],
              transform: `translateY(${cardYOffsets[i]}px)`,
            }}
          >
            <CostCard {...card} />
          </div>
        ))}
      </div>

      {/* Summary line */}
      <div
        style={{
          opacity: interpolate(frame, [110, 135], [0, 1], { extrapolateRight: 'clamp' }),
          transform: `translateY(${interpolate(frame, [110, 135], [12, 0], { extrapolateRight: 'clamp' })}px)`,
        }}
      >
        <div
          style={{
            fontFamily: tokens.font.family,
            fontSize: tokens.font.sizes.md,
            fontWeight: tokens.font.weights.regular,
            color: tokens.colors.textSecondary,
            textAlign: 'center',
            maxWidth: 600,
            lineHeight: 1.6,
          }}
        >
          These aren't edge cases — they compound quietly across every sprint, every design cycle.
        </div>
      </div>
    </div>
  );
};
