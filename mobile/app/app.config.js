// Keep installed-app identifiers stable; ORÉVAMI is the public brand.
function targetIsTest(raw) {
  try { const u = new URL(raw); return u.protocol === 'https:' && u.hostname.endsWith('.vercel.app') && u.hostname !== 'my-event-eosin.vercel.app' && !u.username && !u.password && !u.search && !u.hash; } catch { return false; }
}
module.exports = ({ config }) => {
  const release = process.env.MYEVENT_BUILD_PROFILE === 'release';
  const store = process.env.OREVAMI_DISTRIBUTION === 'store';
  const privateBuild = process.env.OREVAMI_DISTRIBUTION === 'private';
  if (privateBuild && (!targetIsTest(process.env.EXPO_PUBLIC_MYEVENT_WEB_URL))) {
    throw new Error('Use npm run build:private after supplying the verified Preview TEST URL.');
  }
  const target = process.env.EXPO_PUBLIC_MYEVENT_WEB_URL?.trim();
  if (store && (!release || target !== 'https://orevami.com')) {
    throw new Error('Store builds require the release profile and https://orevami.com.');
  }
  return {
    ...config,
    owner: 'spegagnemarc',
    extra: { ...config.extra, eas: { projectId: '643c0641-f24a-439d-af9f-bd3f75c77b29' } },
    ...(process.env.OREVAMI_EXPO_OWNER ? { owner: process.env.OREVAMI_EXPO_OWNER } : {}),
    ...(process.env.OREVAMI_EAS_PROJECT_ID ? { extra: { ...config.extra, eas: { projectId: process.env.OREVAMI_EAS_PROJECT_ID } } } : {}),
    name: privateBuild ? 'ORÉVAMI TEST' : release ? 'ORÉVAMI' : 'ORÉVAMI TEST',
    slug: release ? 'myevent-mobile' : config.slug,
    version: '1.0.0',
    icon: './src/assets/orevami/icon-1024.png',
    ios: { ...config.ios, bundleIdentifier: release && !privateBuild ? 'app.myevent.mobile' : config.ios.bundleIdentifier },
    android: { ...config.android, package: release && !privateBuild ? 'app.myevent.mobile' : config.android.package,
      ...(release ? { allowBackup: false, blockedPermissions: ['android.permission.SYSTEM_ALERT_WINDOW'] } : {}),
      adaptiveIcon: { foregroundImage: './src/assets/orevami/adaptive-foreground.png', backgroundColor: '#ffffff' } },
    plugins: [...config.plugins.filter(plugin => (Array.isArray(plugin) ? plugin[0] : plugin) !== 'expo-splash-screen'), ['expo-splash-screen', {
      image: './src/assets/orevami/splash.png', imageWidth: 260,
      resizeMode: 'contain', backgroundColor: '#07131c'
    }]],
    updates: { enabled: false }
  };
};
