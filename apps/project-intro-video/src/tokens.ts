export const tokens = {
  colors: {
    bg: '#0A0A0F',
    bgCard: '#12121A',
    bgCardBorder: '#1E1E2E',
    text: '#F0F0F4',
    textSecondary: '#9090A0',
    accent: '#7B61FF',   // Figma purple-adjacent
    accentJira: '#0052CC', // Jira blue
    statusReady: '#00875A',   // green — Ready for Dev
    statusChanged: '#FF8B00', // amber — Changes After Dev
    statusInProgress: '#0052CC',
    statusNone: '#5E6C84',
    success: '#57D9A3',
    border: '#2A2A3E',
  },
  font: {
    family: '"Inter", "SF Pro Display", system-ui, -apple-system, sans-serif',
    sizes: { xs: 14, sm: 16, md: 20, lg: 28, xl: 40, xxl: 56 },
    weights: { regular: 400, medium: 500, semibold: 600, bold: 700 },
  },
  timing: {
    fps: 30,
    totalFrames: 2700,  // 90 seconds
    // Scene boundaries (in frames at 30fps):
    scene1Start: 0,    scene1End: 540,   // 0–18s
    scene2Start: 540,  scene2End: 900,   // 18–30s
    scene3Start: 900,  scene3End: 1440,  // 30–48s
    scene4Start: 1440, scene4End: 1980,  // 48–66s
    scene5Start: 1980, scene5End: 2400,  // 66–80s
    scene6Start: 2400, scene6End: 2700,  // 80–90s
  },
} as const;

export type Tokens = typeof tokens;
