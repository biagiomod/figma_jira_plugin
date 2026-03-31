import React from 'react';
import { tokens } from '../tokens';

interface TypographyProps {
  children: React.ReactNode;
  style?: React.CSSProperties;
}

export const Heading = ({ children, style }: TypographyProps) => (
  <div
    style={{
      fontFamily: tokens.font.family,
      fontSize: tokens.font.sizes.xl,
      fontWeight: tokens.font.weights.bold,
      color: tokens.colors.text,
      lineHeight: 1.2,
      letterSpacing: '-0.02em',
      ...style,
    }}
  >
    {children}
  </div>
);

export const HeadingXL = ({ children, style }: TypographyProps) => (
  <div
    style={{
      fontFamily: tokens.font.family,
      fontSize: tokens.font.sizes.xxl,
      fontWeight: tokens.font.weights.bold,
      color: tokens.colors.text,
      lineHeight: 1.1,
      letterSpacing: '-0.03em',
      ...style,
    }}
  >
    {children}
  </div>
);

export const Subheading = ({ children, style }: TypographyProps) => (
  <div
    style={{
      fontFamily: tokens.font.family,
      fontSize: tokens.font.sizes.lg,
      fontWeight: tokens.font.weights.semibold,
      color: tokens.colors.text,
      lineHeight: 1.3,
      letterSpacing: '-0.01em',
      ...style,
    }}
  >
    {children}
  </div>
);

export const Body = ({ children, style }: TypographyProps) => (
  <div
    style={{
      fontFamily: tokens.font.family,
      fontSize: tokens.font.sizes.md,
      fontWeight: tokens.font.weights.regular,
      color: tokens.colors.textSecondary,
      lineHeight: 1.6,
      ...style,
    }}
  >
    {children}
  </div>
);

export const Label = ({ children, style }: TypographyProps) => (
  <div
    style={{
      fontFamily: tokens.font.family,
      fontSize: tokens.font.sizes.sm,
      fontWeight: tokens.font.weights.medium,
      color: tokens.colors.textSecondary,
      lineHeight: 1.4,
      letterSpacing: '0.02em',
      textTransform: 'uppercase' as const,
      ...style,
    }}
  >
    {children}
  </div>
);

export const Caption = ({ children, style }: TypographyProps) => (
  <div
    style={{
      fontFamily: tokens.font.family,
      fontSize: tokens.font.sizes.xs,
      fontWeight: tokens.font.weights.regular,
      color: tokens.colors.textSecondary,
      lineHeight: 1.4,
      ...style,
    }}
  >
    {children}
  </div>
);
