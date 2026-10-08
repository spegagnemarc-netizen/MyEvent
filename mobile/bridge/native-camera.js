/* Injected by the iOS shell only. The deployed web camera remains unchanged. */
(function () {
  'use strict';
  const handler = window.webkit?.messageHandlers?.myeventCamera;
  if (!handler || window !== window.top || window.myeventNativeCamera) return;
  let pending = false;
  function decodePhoto(result) {
    if (!result || result.version !== 1 || result.mime !== 'image/jpeg' ||
        typeof result.base64 !== 'string' || !/^[A-Za-z0-9+/]+={0,2}$/.test(result.base64) ||
        result.base64.length > Math.ceil(4 * 1024 * 1024 / 3) * 4) throw new Error('Photo native invalide.');
    const binary = atob(result.base64);
    const bytes = Uint8Array.from(binary, c => c.charCodeAt(0));
    if (bytes.length < 4 || bytes.length > 4 * 1024 * 1024 || bytes[0] !== 255 || bytes[1] !== 216 ||
        bytes[bytes.length - 2] !== 255 || bytes[bytes.length - 1] !== 217) throw new Error('JPEG natif invalide.');
    return new File([bytes], 'MyEvent-native.jpg', { type: 'image/jpeg' });
  }
  async function capturePhoto() {
    if (pending) throw new Error('Une prise de vue est déjà ouverte.');
    pending = true;
    const video = document.getElementById('myeventCameraVideo');
    video?.srcObject?.getTracks().forEach(track => track.stop());
    if (video) video.srcObject = null;
    try {
      const result = await handler.postMessage({ version: 1, action: 'capturePhoto' });
      if (result?.version === 1 && result.cancelled === true) return null;
      return decodePhoto(result);
    } finally { pending = false; }
  }
  async function importPhoto() {
    const file = await capturePhoto();
    const input = document.getElementById('cameraFileInput');
    const open = document.getElementById('socialBottomCreate');
    if (!file) { open?.click(); return; }
    if (!input || !open || typeof DataTransfer !== 'function') throw new Error('Import caméra web indisponible.');
    // Reuse the existing import/preview pipeline. No upload or publication from the bridge.
    open.click();
    const transfer = new DataTransfer(); transfer.items.add(file); input.files = transfer.files;
    input.dispatchEvent(new Event('change', { bubbles: true }));
  }
  window.myeventNativeCamera = Object.freeze({ version: 1, capturePhoto, importPhoto });
  function mount() {
    const gallery = document.getElementById('cameraGalleryBtn');
    if (!gallery || document.getElementById('cameraNativeBtn')) return;
    const button = document.createElement('button');
    button.id = 'cameraNativeBtn'; button.type = 'button'; button.className = gallery.className;
    button.textContent = 'Caméra iPhone';
    button.addEventListener('click', async () => {
      button.disabled = true;
      try { await importPhoto(); }
      catch (error) {
        document.getElementById('socialBottomCreate')?.click();
        const hint = document.getElementById('cameraHint'); if (hint) hint.textContent = error.message;
      }
      finally { button.disabled = false; }
    });
    gallery.insertAdjacentElement('afterend', button);
  }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', mount, { once: true }); else mount();
})();
