export function cropForRatio(width, height, ratio) {
  const ratios = {'4:3': 3/4, '1:1': 1, '9:16': 9/16};
  if (!Number.isInteger(width) || !Number.isInteger(height) || width < 1 || height < 1 || !(ratio in ratios)) throw new Error('Dimensions invalides.');
  const target = ratios[ratio];
  const cropWidth = Math.max(1, Math.min(width, Math.floor(height * target)));
  const cropHeight = Math.max(1, Math.min(height, Math.floor(cropWidth / target)));
  return {originX: Math.floor((width-cropWidth)/2), originY: Math.floor((height-cropHeight)/2), width: cropWidth, height: cropHeight};
}
export function pinchZoom(initial, distance, initialDistance) {
  if (![initial,distance,initialDistance].every(Number.isFinite) || initialDistance <= 0 || distance <= 0) return initial;
  return Math.max(0, Math.min(1, initial + Math.log2(distance / initialDistance) / 4));
}
