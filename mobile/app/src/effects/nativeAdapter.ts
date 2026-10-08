import { NativeModules, Platform } from 'react-native';
import type {CapturedMedia, EffectsAdapter, EffectsCapabilities, LensDefinition, PlatformName} from '../camera/contract';
import { requireCapabilities } from './policy.mjs';

interface NativeRenderer {
  capabilities(): Promise<EffectsCapabilities>;
  loadLens(manifest: LensDefinition): Promise<void>;
  captureComposedPhoto(): Promise<CapturedMedia>;
  release(): Promise<void>;
}
export function createEffectsAdapter(platform: PlatformName): EffectsAdapter {
  const native: NativeRenderer | undefined = NativeModules[platform === 'android' ? 'MyEventAndroidEffects' : 'MyEventIOSEffects'];
  const unavailable: EffectsCapabilities = {platform, backend: 'unconnected', liveFilters:false, faceLandmarks:false, overlays2D:false, objects3D:false, segmentation:false, beauty:false, composedPhoto:false, composedVideo:false};
  return {
    capabilities: async()=>native ? await native.capabilities() : unavailable,
    async loadLens(lens) {
      requireCapabilities(lens, native ? await native.capabilities() : unavailable);
      if (!native) throw new Error('Moteur natif non raccordé.');
      await native.loadLens(lens);
    },
    async captureComposedPhoto() {
      if (!native || !(await native.capabilities()).composedPhoto) throw new Error('Capture Lens indisponible.');
      const media = await native.captureComposedPhoto();
      if (!media.effectsBaked || media.mime !== 'image/jpeg' || !media.uri.startsWith('file://')) throw new Error('Export Lens non composé.');
      return media;
    },
    async release() { await native?.release(); }
  };
}
export const effectsAdapter = createEffectsAdapter(Platform.OS === 'ios' ? 'ios' : 'android');
