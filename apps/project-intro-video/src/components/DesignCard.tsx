import React from 'react';
import { tokens } from '../tokens';
import { StatusChip, DesignStatus } from './StatusChip';

interface DesignCardProps {
  fileName?: string;
  frameLabel?: string;
  lastModified?: string;
  status?: DesignStatus;
  showBadge?: boolean;
  badgeLabel?: string;
  style?: React.CSSProperties;
}

export const DesignCard: React.FC<DesignCardProps> = ({
  fileName = 'checkout-flow-v3.fig',
  frameLabel = 'Frame: Payment Screen',
  lastModified = 'Last modified: 2 hours ago',
  status = 'Ready for Dev',
  showBadge = false,
  badgeLabel = 'Design updated',
  style,
}) => {
  return (
    <div
      style={{
        background: tokens.colors.bgCard,
        border: `1px solid ${tokens.colors.border}`,
        borderRadius: 10,
        overflow: 'hidden',
        width: 380,
        fontFamily: tokens.font.family,
        position: 'relative',
        ...style,
      }}
    >
      {/* Thumbnail area */}
      <div
        style={{
          width: '100%',
          height: 200,
          background: '#1A1A2E',
          border: `2px dashed #3A3A5E`,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          color: '#5A5A7A',
          fontSize: 13,
          flexDirection: 'column',
          gap: 8,
        }}
      >
        <div style={{ fontSize: 32 }}>◻</div>
        <div>[SCREENSHOT: Figma frame thumbnail]</div>
      </div>

      {/* Badge overlay */}
      {showBadge && (
        <div
          style={{
            position: 'absolute',
            top: 12,
            right: 12,
            background: tokens.colors.statusChanged,
            color: '#fff',
            fontSize: 12,
            fontWeight: tokens.font.weights.semibold,
            paddingLeft: 10,
            paddingRight: 10,
            paddingTop: 4,
            paddingBottom: 4,
            borderRadius: 20,
            fontFamily: tokens.font.family,
          }}
        >
          {badgeLabel}
        </div>
      )}

      {/* Card body */}
      <div style={{ padding: '14px 16px', display: 'flex', flexDirection: 'column', gap: 8 }}>
        <div
          style={{
            fontSize: 15,
            fontWeight: tokens.font.weights.semibold,
            color: tokens.colors.text,
            whiteSpace: 'nowrap',
            overflow: 'hidden',
            textOverflow: 'ellipsis',
          }}
        >
          {fileName}
        </div>
        <div style={{ fontSize: 13, color: tokens.colors.textSecondary }}>
          {frameLabel}
        </div>
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            marginTop: 4,
          }}
        >
          <div style={{ fontSize: 12, color: tokens.colors.textSecondary }}>
            {lastModified}
          </div>
          <StatusChip status={status} />
        </div>
      </div>
    </div>
  );
};
