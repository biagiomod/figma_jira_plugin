import React from 'react';
import { tokens } from '../tokens';

interface CostCardProps {
  title: string;
  description: string;
  style?: React.CSSProperties;
}

export const CostCard: React.FC<CostCardProps> = ({ title, description, style }) => {
  return (
    <div
      style={{
        background: tokens.colors.bgCard,
        border: `1px solid ${tokens.colors.border}`,
        borderRadius: 10,
        padding: '28px 32px',
        width: 320,
        fontFamily: tokens.font.family,
        ...style,
      }}
    >
      <div
        style={{
          fontSize: 22,
          fontWeight: tokens.font.weights.bold,
          color: tokens.colors.text,
          marginBottom: 10,
        }}
      >
        {title}
      </div>
      <div
        style={{
          fontSize: 15,
          color: tokens.colors.textSecondary,
          lineHeight: 1.5,
        }}
      >
        {description}
      </div>
    </div>
  );
};
