// Development identity stays separate from the autonomous Release application.
module.exports = ({ config }) => {
  const release = process.env.MYEVENT_BUILD_PROFILE === 'release';
  return {
    ...config,
    name: release ? 'MyEvent' : config.name,
    slug: release ? 'myevent-mobile' : config.slug,
    icon: './src/assets/app-icon.png',
    ios: { ...config.ios, bundleIdentifier: release ? 'app.myevent.mobile' : config.ios.bundleIdentifier },
    android: { ...config.android, package: release ? 'app.myevent.mobile' : config.android.package,
      ...(release ? { allowBackup: false, blockedPermissions: ['android.permission.SYSTEM_ALERT_WINDOW'] } : {}),
      adaptiveIcon: { foregroundImage: './src/assets/app-icon.png', backgroundColor: '#07131c' } },
    plugins: [...config.plugins.filter(plugin => (Array.isArray(plugin) ? plugin[0] : plugin) !== 'expo-splash-screen'), ['expo-splash-screen', {
      image: './src/assets/app-icon.png', imageWidth: 180,
      resizeMode: 'contain', backgroundColor: '#07131c'
    }]],
    updates: { enabled: false }
  };
};
