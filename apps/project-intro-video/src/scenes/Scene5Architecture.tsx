import React from 'react';
import { useCurrentFrame, interpolate } from 'remotion';
import { tokens } from '../tokens';
import { ArchNode, Arrow, ZoneLabel } from '../components/ArchNode';

const TEXT_LINES = [
  'Secure AWS backend.',
  'Your Jira DC. Your infrastructure.',
  'No external token storage.',
];

// Each node animates in at a given frame offset
const NODE_SCHEDULE = [
  { delay: 0 },   // Jira DC Plugin
  { delay: 15 },  // API Gateway
  { delay: 30 },  // Lambda: api-handler
  { delay: 40 },  // Lambda: webhook-handler
  { delay: 50 },  // Lambda: polling-sync
  { delay: 65 },  // RDS PostgreSQL
  { delay: 75 },  // S3
  { delay: 85 },  // Secrets Manager
  { delay: 40 },  // Figma webhook arrow/label
];

function nodeStyle(frame: number, delay: number): React.CSSProperties {
  const opacity = interpolate(frame, [delay, delay + 20], [0, 1], { extrapolateRight: 'clamp' });
  const y = interpolate(frame, [delay, delay + 20], [12, 0], { extrapolateRight: 'clamp' });
  return { opacity, transform: `translateY(${y}px)` };
}

export const Scene5Architecture: React.FC = () => {
  const frame = useCurrentFrame();

  const lineOpacities = TEXT_LINES.map((_, i) => {
    const start = 130 + i * 18;
    return interpolate(frame, [start, start + 18], [0, 1], { extrapolateRight: 'clamp' });
  });

  const zoneInternalOpacity = interpolate(frame, [5, 20], [0, 1], { extrapolateRight: 'clamp' });
  const zoneAwsOpacity = interpolate(frame, [20, 35], [0, 1], { extrapolateRight: 'clamp' });

  const secretsNoteOpacity = interpolate(frame, [100, 120], [0, 1], { extrapolateRight: 'clamp' });

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
        gap: 36,
        fontFamily: tokens.font.family,
        padding: '0 60px',
      }}
    >
      {/* Architecture diagram */}
      <div
        style={{
          display: 'flex',
          flexDirection: 'column',
          gap: 20,
          alignItems: 'flex-start',
          width: '100%',
          maxWidth: 900,
        }}
      >
        {/* Zone labels row */}
        <div style={{ display: 'flex', gap: 16, marginBottom: 4 }}>
          <div style={{ opacity: zoneInternalOpacity }}>
            <ZoneLabel zone="internal" />
          </div>
          <div style={{ opacity: zoneAwsOpacity }}>
            <ZoneLabel zone="aws" />
          </div>
        </div>

        {/* Main flow row: Jira DC Plugin → API Gateway → Lambdas */}
        <div
          style={{
            display: 'flex',
            flexDirection: 'row',
            alignItems: 'center',
            gap: 12,
            flexWrap: 'wrap',
          }}
        >
          {/* Jira DC Plugin */}
          <div style={nodeStyle(frame, NODE_SCHEDULE[0]!.delay)}>
            <ArchNode
              label="Jira DC Plugin"
              sublabel="Thin proxy"
              zone="internal"
            />
          </div>

          <div style={nodeStyle(frame, NODE_SCHEDULE[0]!.delay + 10)}>
            <Arrow direction="right" />
          </div>

          {/* API Gateway */}
          <div style={nodeStyle(frame, NODE_SCHEDULE[1]!.delay)}>
            <ArchNode
              label="API Gateway"
              sublabel="x-api-key auth"
              zone="aws"
            />
          </div>

          <div style={nodeStyle(frame, NODE_SCHEDULE[1]!.delay + 10)}>
            <Arrow direction="right" />
          </div>

          {/* Lambda group */}
          <div
            style={{
              display: 'flex',
              flexDirection: 'column',
              gap: 8,
              ...nodeStyle(frame, NODE_SCHEDULE[2]!.delay),
            }}
          >
            <div style={nodeStyle(frame, NODE_SCHEDULE[2]!.delay)}>
              <ArchNode label="Lambda" sublabel="api-handler" zone="aws" />
            </div>
            <div style={nodeStyle(frame, NODE_SCHEDULE[3]!.delay)}>
              <ArchNode label="Lambda" sublabel="webhook-handler" zone="aws" />
            </div>
            <div style={nodeStyle(frame, NODE_SCHEDULE[4]!.delay)}>
              <ArchNode label="Lambda" sublabel="polling-sync" zone="aws" />
            </div>
          </div>

          <div style={nodeStyle(frame, NODE_SCHEDULE[4]!.delay + 5)}>
            <Arrow direction="right" />
          </div>

          {/* Storage group */}
          <div
            style={{
              display: 'flex',
              flexDirection: 'column',
              gap: 8,
            }}
          >
            <div style={nodeStyle(frame, NODE_SCHEDULE[5]!.delay)}>
              <ArchNode label="RDS PostgreSQL" sublabel="design_links, sync_state" zone="aws" />
            </div>
            <div style={nodeStyle(frame, NODE_SCHEDULE[6]!.delay)}>
              <ArchNode label="S3" sublabel="Thumbnail cache" zone="aws" />
            </div>
            <div style={nodeStyle(frame, NODE_SCHEDULE[7]!.delay)}>
              <ArchNode
                label="Secrets Manager"
                sublabel="Service token, DB creds"
                zone="aws"
                style={{ borderColor: `${tokens.colors.success}55` }}
              />
            </div>
          </div>
        </div>

        {/* Figma webhook row */}
        <div
          style={{
            display: 'flex',
            flexDirection: 'row',
            alignItems: 'center',
            gap: 12,
            ...nodeStyle(frame, NODE_SCHEDULE[8]!.delay),
          }}
        >
          <ArchNode label="Figma" sublabel="Webhook push" zone="internal" />
          <Arrow direction="right" label="push event" />
          <div style={{ fontSize: 12, color: tokens.colors.textSecondary }}>
            → webhook-handler Lambda
          </div>
        </div>

        {/* Secrets note */}
        <div
          style={{
            opacity: secretsNoteOpacity,
            display: 'flex',
            alignItems: 'center',
            gap: 8,
            marginTop: 4,
          }}
        >
          <div
            style={{
              width: 8,
              height: 8,
              borderRadius: '50%',
              background: tokens.colors.success,
              flexShrink: 0,
            }}
          />
          <div style={{ fontSize: 13, color: tokens.colors.success }}>
            All secrets in AWS Secrets Manager
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
              transform: `translateY(${interpolate(
                frame,
                [130 + i * 18, 130 + i * 18 + 18],
                [8, 0],
                { extrapolateRight: 'clamp' }
              )}px)`,
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
