/**
 * Remotion entry point — registers the root composition.
 * This file is referenced by remotion.config.ts and package.json "remotion.entryPoint".
 */
import { registerRoot } from 'remotion';
import { RemotionRoot } from './Root';

registerRoot(RemotionRoot);
