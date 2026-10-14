// Keep installed-app identifiers stable; ORÉVAMI is the public brand.
module.exports = ({ config }) => {
  const release = process.env.MYEVENT_BUILD_PROFILE === 'release';
  const store = process.env.OREVAMI_DISTRIBUTION === 'store';
  const target = process.env.EXPO_PUBLIC_MYEVENT_WEB_URL?.trim();
  if (store && (!release || target !== 'https://orevami.com')) {
    throw new Error('Store builds require the release profile and https://orevami.com.');
  }
  return {
    ...config,
    name: release ? 'ORÉVAMI' : 'ORÉVAMI TEST',
    slug: release ? 'myevent-mobile' : config.slug,
    version: '1.0.0',
    icon: './src/assets/orevami/icon.png',
    ios: { ...config.ios, bundleIdentifier: release ? 'app.myevent.mobile' : config.ios.bundleIdentifier },
    android: { ...config.android, package: release ? 'app.myevent.mobile' : config.android.package,
      ...(release ? { allowBackup: false, blockedPermissions: ['android.permission.SYSTEM_ALERT_WINDOW'] } : {}),
      adaptiveIcon: undefined },
    plugins: [...config.plugins.filter(plugin => (Array.isArray(plugin) ? plugin[0] : plugin) !== 'expo-splash-screen'), ['expo-splash-screen', {
      image: './src/assets/orevami/splash.png', imageWidth: 260,
      resizeMode: 'contain', backgroundColor: '#07131c'
    }]],
    updates: { enabled: false }
  };
};
