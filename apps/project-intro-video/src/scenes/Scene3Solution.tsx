import React from 'react';
import { useCurrentFrame, interpolate } from 'remotion';
import { tokens } from '../tokens';
import { DesignCard } from '../components/DesignCard';
import { Heading, Caption } from '../components/Typography';
import { StatusChip } from '../components/StatusChip';

const TEXT_LINES = [
  'Figma designs, directly in Jira.',
  'Link any file, frame, or prototype to any issue.',
  'Your team sees it where they already work.',
];

export const Scene3Solution: React.FC = () => {
  const frame = useCurrentFrame();

  // Jira-style issue card fades in
  const issueCardOpacity = interpolate(frame, [0, 25], [0, 1], { extrapolateRight: 'clamp' });
  const issueCardX = interpolate(frame, [0, 25], [-20, 0], { extrapolateRight: 'clamp' });

  // Figma designs panel slides in from right
  const panelOpacity = interpolate(frame, [30, 55], [0, 1], { extrapolateRight: 'clamp' });
  const panelX = interpolate(frame, [30, 55], [40, 0], { extrapolateRight: 'clamp' });

  // Design card inside panel
  const designCardOpacity = interpolate(frame, [55, 80], [0, 1], { extrapolateRight: 'clamp' });
  const designCardY = interpolate(frame, [55, 80], [16, 0], { extrapolateRight: 'clamp' });

  // Plugin name label
  const pluginLabelOpacity = interpolate(frame, [90, 115], [0, 1], { extrapolateRight: 'clamp' });

  // Text lines
  const lineOpacities = TEXT_LINES.map((_, i) => {
    const start = 120 + i * 20;
    return interpolate(frame, [start, start + 20], [0, 1], { extrapolateRight: 'clamp' });
  });
  const lineYOffsets = TEXT_LINES.map((_, i) => {
    const start = 120 + i * 20;
    return interpolate(frame, [start, start + 20], [12, 0], { extrapolateRight: 'clamp' });
  });

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
      {/* Central UI demo area */}
      <div
        style={{
          display: 'flex',
          flexDirection: 'row',
          gap: 24,
          alignItems: 'flex-start',
        }}
      >
        {/* Jira issue card (left) */}
        <div
          style={{
            opacity: issueCardOpacity,
            transform: `translateX(${issueCardX}px)`,
          }}
        >
          <div
            style={{
              background: tokens.colors.bgCard,
              border: `1px solid ${tokens.colors.border}`,
              borderRadius: 10,
              padding: 24,
              width: 340,
            }}
          >
            {/* Issue header */}
            <div style={{ marginBottom: 16 }}>
              <div
                style={{
                  fontSize: 11,
                  color: tokens.colors.accentJira,
                  fontWeight: tokens.font.weights.semibold,
                  textTransform: 'uppercase',
                  letterSpacing: '0.08em',
                  marginBottom: 8,
                }}
              >
                PROJ-247
              </div>
              <div
                style={{
                  fontSize: 18,
                  fontWeight: tokens.font.weights.bold,
                  color: tokens.colors.text,
                  marginBottom: 12,
                }}
              >
                Redesign checkout flow
              </div>
              <div style={{ fontSize: 13, color: tokens.colors.textSecondary, lineHeight: 1.5 }}>
                Update the payment screen to match the new design system. Include error states and loading skeletons.
              </div>
            </div>

            {/* Issue meta */}
            <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap' }}>
              <div
                style={{
                  fontSize: 12,
                  color: tokens.colors.textSecondary,
                  background: `${tokens.colors.border}55`,
                  paddingLeft: 8,
                  paddingRight: 8,
                  paddingTop: 3,
                  paddingBottom: 3,
                  borderRadius: 4,
                }}
              >
                In Progress
              </div>
              <div
                style={{
                  fontSize: 12,
                  color: tokens.colors.textSecondary,
                  background: `${tokens.colors.border}55`,
                  paddingLeft: 8,
                  paddingRight: 8,
                  paddingTop: 3,
                  paddingBottom: 3,
                  borderRadius: 4,
                }}
              >
                Sprint 14
              </div>
            </div>
          </div>
        </div>

        {/* Figma Designs panel (right) */}
        <div
          style={{
            opacity: panelOpacity,
            transform: `translateX(${panelX}px)`,
          }}
        >
          <div
            style={{
              background: tokens.colors.bgCard,
              border: `1px solid ${tokens.colors.border}`,
              borderRadius: 10,
              padding: 20,
              width: 420,
            }}
          >
            {/* Panel header */}
            <div
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: 8,
                marginBottom: 16,
                paddingBottom: 14,
                borderBottom: `1px solid ${tokens.colors.border}`,
              }}
            >
              <div
                style={{
                  width: 8,
                  height: 8,
                  borderRadius: '50%',
                  background: tokens.colors.accent,
                }}
              />
              <div
                style={{
                  fontSize: 14,
                  fontWeight: tokens.font.weights.semibold,
                  color: tokens.colors.text,
                }}
              >
                Figma Designs
              </div>
              <div
                style={{
                  marginLeft: 'auto',
                  fontSize: 12,
                  color: tokens.colors.textSecondary,
                }}
              >
                1 linked
              </div>
            </div>

            {/* Design card inside panel */}
            <div
              style={{
                opacity: designCardOpacity,
                transform: `translateY(${designCardY}px)`,
              }}
            >
              <DesignCard
                fileName="checkout-flow-v3.fig"
                frameLabel="Frame: Payment Screen"
                lastModified="Last modified: 2 hours ago"
                status="Ready for Dev"
                style={{ width: '100%' }}
              />
            </div>
          </div>
        </div>
      </div>

      {/* Plugin name label */}
      <div style={{ opacity: pluginLabelOpacity, textAlign: 'center' }}>
        <div
          style={{
            fontSize: 13,
            fontWeight: tokens.font.weights.medium,
            color: tokens.colors.accent,
            letterSpacing: '0.04em',
            textTransform: 'uppercase',
            marginBottom: 4,
          }}
        >
          Figma for Jira — Data Center
        </div>
      </div>

      {/* Text lines */}
      <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 12 }}>
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
