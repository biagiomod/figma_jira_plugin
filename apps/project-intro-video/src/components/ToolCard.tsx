import React from 'react';
import { tokens } from '../tokens';

interface ToolCardProps {
  name: string;
  icon: string;
  subtitle?: string;
  accentColor?: string;
  style?: React.CSSProperties;
}

export const ToolCard: React.FC<ToolCardProps> = ({
  name,
  icon,
  subtitle,
  accentColor = tokens.colors.border,
  style,
}) => {
  return (
    <div
      style={{
        background: tokens.colors.bgCard,
        border: `1px solid ${accentColor}`,
        borderRadius: 12,
        padding: '24px 32px',
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        gap: 12,
        width: 200,
        fontFamily: tokens.font.family,
        ...style,
      }}
    >
      <div style={{ fontSize: 40, lineHeight: 1 }}>{icon}</div>
      <div
        style={{
          fontSize: 18,
          fontWeight: tokens.font.weights.semibold,
          color: tokens.colors.text,
        }}
      >
        {name}
      </div>
      {subtitle && (
        <div
          style={{
            fontSize: 13,
            color: tokens.colors.textSecondary,
            textAlign: 'center',
          }}
        >
          {subtitle}
        </div>
      )}
    </div>
  );
};

interface GapIndicatorProps {
  style?: React.CSSProperties;
}

export const GapIndicator: React.FC<GapIndicatorProps> = ({ style }) => (
  <div
    style={{
      display: 'flex',
      flexDirection: 'column',
      alignItems: 'center',
      gap: 4,
      ...style,
    }}
  >
    {[0, 1, 2].map((i) => (
      <div
        key={i}
        style={{
          width: 4,
          height: 4,
          borderRadius: '50%',
          background: tokens.colors.border,
        }}
      />
    ))}
  </div>
);
