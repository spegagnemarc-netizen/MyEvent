export type PlatformName = 'android' | 'ios';
export type CameraRatio = '4:3' | '1:1' | '9:16';
export interface CapturedMedia {
  uri: string; width: number; height: number; mime: 'image/jpeg';
  source: 'camera' | 'gallery'; effectsBaked: boolean;
}
export interface FaceLandmarks {
  frameId: string; timestampMs: number;
  points: ReadonlyArray<{x: number; y: number; z?: number}>;
  coordinateSpace: 'normalized-oriented-unmirrored';
  confidence: number;
}
export interface EffectsCapabilities {
  platform: PlatformName; backend: string;
  liveFilters: boolean; faceLandmarks: boolean; overlays2D: boolean;
  objects3D: boolean; segmentation: boolean; beauty: boolean;
  composedPhoto: boolean; composedVideo: boolean;
}
export interface LensDefinition {
  schemaVersion: 1; id: string; label: string;
  tracking: 'face' | 'body' | 'world' | 'none';
  requires: Array<keyof Omit<EffectsCapabilities, 'platform' | 'backend'>>;
  assets: Array<{file: string; sha256: string}>;
}
// A backend MUST export the same composed frame displayed, not the raw camera image.
export interface EffectsAdapter {
  capabilities(): Promise<EffectsCapabilities>;
  loadLens(lens: LensDefinition): Promise<void>;
  captureComposedPhoto(): Promise<CapturedMedia>;
  release(): Promise<void>;
}
