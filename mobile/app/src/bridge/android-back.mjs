// Modal back is handled by onRequestClose. At the WebView root let Android exit.
export function handleAndroidBack({ cameraOpen, transferPending, canGoBack, closeCamera, goBack }) {
  if (transferPending) return true;
  if (cameraOpen) { closeCamera(); return true; }
  if (canGoBack) { goBack(); return true; }
  return false;
}
