// Mobile shell target.
// The previous Vercel Preview requires Vercel Authentication on physical devices,
// so use the public MyEvent URL by default. Developers can override it locally
// without committing a machine-specific/LAN URL.
const configuredUrl = process.env.EXPO_PUBLIC_MYEVENT_WEB_URL?.trim();
export const WEB_URL = configuredUrl || 'https://my-event-eosin.vercel.app/index.html';
export const WEB_ORIGIN = new URL(WEB_URL).origin;
