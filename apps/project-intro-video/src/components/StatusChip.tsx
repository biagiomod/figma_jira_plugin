import React from 'react';
import { tokens } from '../tokens';

export type DesignStatus =
  | 'None'
  | 'In Progress'
  | 'Ready for Dev'
  | 'Changes After Dev';

const statusConfig: Record<
  DesignStatus,
  { bg: string; text: string; dot: string }
> = {
  None: {
    bg: `${tokens.colors.statusNone}22`,
    text: tokens.colors.statusNone,
    dot: tokens.colors.statusNone,
  },
  'In Progress': {
    bg: `${tokens.colors.statusInProgress}22`,
    text: tokens.colors.statusInProgress,
    dot: tokens.colors.statusInProgress,
  },
  'Ready for Dev': {
    bg: `${tokens.colors.statusReady}22`,
    text: tokens.colors.statusReady,
    dot: tokens.colors.statusReady,
  },
  'Changes After Dev': {
    bg: `${tokens.colors.statusChanged}22`,
    text: tokens.colors.statusChanged,
    dot: tokens.colors.statusChanged,
  },
};

interface StatusChipProps {
  status: DesignStatus;
  style?: React.CSSProperties;
}

export const StatusChip: React.FC<StatusChipProps> = ({ status, style }) => {
  const cfg = statusConfig[status];

  return (
    <div
      style={{
        display: 'inline-flex',
        alignItems: 'center',
        gap: 6,
        paddingLeft: 10,
        paddingRight: 10,
        paddingTop: 4,
        paddingBottom: 4,
        borderRadius: 20,
        background: cfg.bg,
        border: `1px solid ${cfg.dot}44`,
        fontFamily: tokens.font.family,
        fontSize: 13,
        fontWeight: tokens.font.weights.medium,
        color: cfg.text,
        whiteSpace: 'nowrap' as const,
        ...style,
      }}
    >
      <div
        style={{
          width: 6,
          height: 6,
          borderRadius: '50%',
          background: cfg.dot,
          flexShrink: 0,
        }}
      />
      {status}
    </div>
  );
};
