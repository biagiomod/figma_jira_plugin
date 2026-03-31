import React from 'react';
import { Composition, Series } from 'remotion';
import { tokens } from './tokens';
import { Scene1Problem } from './scenes/Scene1Problem';
import { Scene2Cost } from './scenes/Scene2Cost';
import { Scene3Solution } from './scenes/Scene3Solution';
import { Scene4ChangeDetection } from './scenes/Scene4ChangeDetection';
import { Scene5Architecture } from './scenes/Scene5Architecture';
import { Scene6Close } from './scenes/Scene6Close';

const { timing } = tokens;

/**
 * Full intro video — all scenes stitched together via Series.
 * Each scene receives a local `frame` (starting from 0) thanks to Series.
 */
export const FigmaJiraDCIntro: React.FC = () => {
  return (
    <Series>
      <Series.Sequence durationInFrames={timing.scene1End - timing.scene1Start}>
        <Scene1Problem />
      </Series.Sequence>

      <Series.Sequence durationInFrames={timing.scene2End - timing.scene2Start}>
        <Scene2Cost />
      </Series.Sequence>

      <Series.Sequence durationInFrames={timing.scene3End - timing.scene3Start}>
        <Scene3Solution />
      </Series.Sequence>

      <Series.Sequence durationInFrames={timing.scene4End - timing.scene4Start}>
        <Scene4ChangeDetection />
      </Series.Sequence>

      <Series.Sequence durationInFrames={timing.scene5End - timing.scene5Start}>
        <Scene5Architecture />
      </Series.Sequence>

      <Series.Sequence durationInFrames={timing.scene6End - timing.scene6Start}>
        <Scene6Close />
      </Series.Sequence>
    </Series>
  );
};

/**
 * Root — registers all compositions.
 * Individual scene compositions are also registered for isolated preview.
 */
export const RemotionRoot: React.FC = () => {
  return (
    <>
      {/* Full video */}
      <Composition
        id="FigmaJiraDCIntro"
        component={FigmaJiraDCIntro}
        durationInFrames={timing.totalFrames}
        fps={timing.fps}
        width={1920}
        height={1080}
        defaultProps={{}}
      />

      {/* Individual scenes for isolated preview */}
      <Composition
        id="Scene1-Problem"
        component={Scene1Problem}
        durationInFrames={timing.scene1End - timing.scene1Start}
        fps={timing.fps}
        width={1920}
        height={1080}
        defaultProps={{}}
      />

      <Composition
        id="Scene2-Cost"
        component={Scene2Cost}
        durationInFrames={timing.scene2End - timing.scene2Start}
        fps={timing.fps}
        width={1920}
        height={1080}
        defaultProps={{}}
      />

      <Composition
        id="Scene3-Solution"
        component={Scene3Solution}
        durationInFrames={timing.scene3End - timing.scene3Start}
        fps={timing.fps}
        width={1920}
        height={1080}
        defaultProps={{}}
      />

      <Composition
        id="Scene4-ChangeDetection"
        component={Scene4ChangeDetection}
        durationInFrames={timing.scene4End - timing.scene4Start}
        fps={timing.fps}
        width={1920}
        height={1080}
        defaultProps={{}}
      />

      <Composition
        id="Scene5-Architecture"
        component={Scene5Architecture}
        durationInFrames={timing.scene5End - timing.scene5Start}
        fps={timing.fps}
        width={1920}
        height={1080}
        defaultProps={{}}
      />

      <Composition
        id="Scene6-Close"
        component={Scene6Close}
        durationInFrames={timing.scene6End - timing.scene6Start}
        fps={timing.fps}
        width={1920}
        height={1080}
        defaultProps={{}}
      />
    </>
  );
};
