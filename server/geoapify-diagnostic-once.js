// Temporary diagnostic, Preview only. No provider payload or credential is returned.
let attempt;
const definitions = [
  ['restaurants', 'catering.restaurant,catering.fast_food'],
  ['culture', 'entertainment'],
  ['outdoors', 'leisure.park,leisure.spa,sport']
];
async function measure([family, categories]) {
  const started = performance.now();
  const result = { family, categories, status: null, phase: 'fetch', timeoutMs: 10000 };
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), result.timeoutMs);
  const url = new URL('https://api.geoapify.com/v2/places');
  url.search = new URLSearchParams({ apiKey: process.env.GEOAPIFY_API_KEY, categories,
    filter: 'circle:6.0797,44.5596,20000', bias: 'proximity:6.0797,44.5596', limit: '100', lang: 'fr' }).toString();
  try {
    const response = await fetch(url, { signal: controller.signal });
    result.headersMs = Math.round(performance.now() - started);
    result.status = response.status;
    if (!response.ok) {
      result.errorType = 'PROVIDER_HTTP';
      return result;
    }
    result.phase = 'json';
    const data = await response.json();
    result.features = Array.isArray(data?.features) ? data.features.length : null;
    result.namedFeatures = Array.isArray(data?.features) ? data.features.filter(f => f.properties?.name || f.properties?.['name:fr']).length : null;
    result.valid = Array.isArray(data?.features);
    result.phase = 'complete';
    if (!result.valid) result.errorType = 'INVALID_RESPONSE';
    return result;
  } catch (error) {
    result.errorType = controller.signal.aborted ? 'INTERNAL_TIMEOUT' :
      result.phase === 'json' ? 'RESPONSE_PROCESSING' : 'NETWORK';
    result.errorName = ['AbortError', 'TimeoutError', 'TypeError', 'SyntaxError'].includes(error?.name) ? error.name : 'OtherError';
    const code = error?.cause?.code || error?.code;
    if (typeof code === 'string' && /^(E[A-Z_]+|UND_ERR_[A-Z_]+)$/.test(code)) result.networkCode = code;
    return result;
  } finally {
    clearTimeout(timer);
    result.durationMs = Math.round(performance.now() - started);
  }
}
module.exports = async function diagnostic(req, res) {
  res.setHeader('Cache-Control', 'no-store');
  if (process.env.VERCEL_ENV !== 'preview') return res.status(404).json({error:'Not found'});
  if (Date.now() > 1792064040852) return res.status(410).json({error:'Diagnostic expired; no provider call made'});
  if (req.method !== 'GET') return res.status(405).json({error:'GET only'});
  if (!process.env.GEOAPIFY_API_KEY) return res.status(503).json({error:'Preview credential unavailable; no provider call made'});
  // Subsequent requests to this warm instance reuse the same result, never retry.
  if (!attempt) attempt = Promise.allSettled(definitions.map(measure)).then(rows => {
    const measurements = rows.map((r,i) => r.status === 'fulfilled' ? r.value : {family:definitions[i][0],errorType:'INSTRUMENTATION_ERROR'});
    const validFamilies = measurements.filter(r => r.valid).map(r => r.family);
    return { center:'Gap', radiusKm:20, maxProviderCalls:3, concurrent:true, measurements,
      allSettled: {validFamilies, partial:validFamilies.length>0 && validFamilies.length<3},
      legacyPromiseAllWouldFail: measurements.some(r => !r.valid) };
  });
  return res.status(200).json(await attempt);
};
