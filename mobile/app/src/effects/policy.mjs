const capabilities = ['liveFilters','faceLandmarks','overlays2D','objects3D','segmentation','beauty','composedPhoto','composedVideo'];
export function validateLens(lens) {
  if (!lens || lens.schemaVersion !== 1 || !/^[a-z0-9-]{1,64}$/.test(lens.id) ||
      typeof lens.label !== 'string' || !lens.label.trim() || lens.label.length > 100 ||
      !['face','body','world','none'].includes(lens.tracking) || !Array.isArray(lens.requires) ||
      !Array.isArray(lens.assets) || lens.assets.length > 20 ||
      lens.requires.some(key=>!capabilities.includes(key)) ||
      lens.assets.some(asset=>!asset || !/^[a-zA-Z0-9_-]+\.(png|webp|glb|usdz)$/.test(asset.file) || !/^[a-f0-9]{64}$/.test(asset.sha256))) throw new Error('Manifest Lens invalide.');
  if (lens.tracking === 'face' && !lens.requires.includes('faceLandmarks')) throw new Error('Suivi facial requis.');
  if (!lens.requires.includes('composedPhoto')) throw new Error('Export composé requis.');
  return lens;
}
export function requireCapabilities(lens, measured) {
  validateLens(lens);
  const missing = lens.requires.filter(key=>measured[key] !== true);
  if (missing.length) throw new Error('Capacités indisponibles : '+missing.join(', '));
}
