import React from 'react';
import { tokens } from '../tokens';

export type NodeZone = 'internal' | 'aws';

interface ArchNodeProps {
  label: string;
  sublabel?: string;
  zone?: NodeZone;
  style?: React.CSSProperties;
}

const zoneColors: Record<NodeZone, { bg: string; border: string; text: string }> = {
  internal: {
    bg: `${tokens.colors.accentJira}18`,
    border: `${tokens.colors.accentJira}55`,
    text: '#5E90D8',
  },
  aws: {
    bg: `${tokens.colors.accent}18`,
    border: `${tokens.colors.accent}55`,
    text: '#9D8BFF',
  },
};

export const ArchNode: React.FC<ArchNodeProps> = ({
  label,
  sublabel,
  zone = 'aws',
  style,
}) => {
  const cfg = zoneColors[zone];

  return (
    <div
      style={{
        background: cfg.bg,
        border: `1px solid ${cfg.border}`,
        borderRadius: 8,
        paddingLeft: 16,
        paddingRight: 16,
        paddingTop: 10,
        paddingBottom: 10,
        fontFamily: tokens.font.family,
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        gap: 4,
        minWidth: 140,
        ...style,
      }}
    >
      <div
        style={{
          fontSize: 14,
          fontWeight: tokens.font.weights.semibold,
          color: cfg.text,
          textAlign: 'center',
        }}
      >
        {label}
      </div>
      {sublabel && (
        <div
          style={{
            fontSize: 11,
            color: tokens.colors.textSecondary,
            textAlign: 'center',
          }}
        >
          {sublabel}
        </div>
      )}
    </div>
  );
};

interface ArrowProps {
  direction?: 'right' | 'down';
  label?: string;
  style?: React.CSSProperties;
}

export const Arrow: React.FC<ArrowProps> = ({
  direction = 'right',
  label,
  style,
}) => {
  const isRight = direction === 'right';

  return (
    <div
      style={{
        display: 'flex',
        flexDirection: isRight ? 'row' : 'column',
        alignItems: 'center',
        gap: 4,
        ...style,
      }}
    >
      {label && (
        <div
          style={{
            fontSize: 10,
            color: tokens.colors.textSecondary,
            fontFamily: tokens.font.family,
          }}
        >
          {label}
        </div>
      )}
      <div
        style={{
          color: tokens.colors.border,
          fontSize: 18,
          lineHeight: 1,
        }}
      >
        {isRight ? '→' : '↓'}
      </div>
    </div>
  );
};

interface ZoneLabelProps {
  zone: NodeZone;
  style?: React.CSSProperties;
}

export const ZoneLabel: React.FC<ZoneLabelProps> = ({ zone, style }) => {
  const cfg = zoneColors[zone];
  const label = zone === 'internal' ? 'Internal' : 'AWS';

  return (
    <div
      style={{
        fontSize: 11,
        fontWeight: tokens.font.weights.semibold,
        color: cfg.text,
        textTransform: 'uppercase',
        letterSpacing: '0.08em',
        fontFamily: tokens.font.family,
        paddingLeft: 8,
        paddingRight: 8,
        paddingTop: 3,
        paddingBottom: 3,
        border: `1px solid ${cfg.border}`,
        borderRadius: 4,
        ...style,
      }}
    >
      {label}
    </div>
  );
};
