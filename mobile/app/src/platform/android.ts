import {createEffectsAdapter} from '../effects/nativeAdapter';
// Port for CameraX + MediaPipe/renderer. No ARKit dependency; unavailable until linked.
export const androidEffects = createEffectsAdapter('android');
