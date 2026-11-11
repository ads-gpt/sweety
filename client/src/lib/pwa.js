// Service worker registration + "Install app" prompt capture. Imported once from main.jsx
// so the browser's beforeinstallprompt event isn't missed before the Settings page mounts.
let deferred = null;
const listeners = new Set();
const notify = () => listeners.forEach((fn) => fn());

if (typeof window !== 'undefined') {
  window.addEventListener('beforeinstallprompt', (e) => {
    e.preventDefault();
    deferred = e;
    notify();
  });
  window.addEventListener('appinstalled', () => {
    deferred = null;
    notify();
  });
}

export const canInstall = () => Boolean(deferred);
export const isInstalled = () =>
  typeof window !== 'undefined' && (window.matchMedia?.('(display-mode: standalone)').matches || window.navigator.standalone === true);
export const isIos = () => typeof navigator !== 'undefined' && /iphone|ipad|ipod/i.test(navigator.userAgent);

export function onInstallChange(fn) {
  listeners.add(fn);
  return () => listeners.delete(fn);
}

export async function promptInstall() {
  if (!deferred) return false;
  deferred.prompt();
  const { outcome } = await deferred.userChoice;
  deferred = null;
  notify();
  return outcome === 'accepted';
}

export function registerServiceWorker() {
  if (typeof window === 'undefined' || !('serviceWorker' in navigator)) return;
  window.addEventListener('load', () => {
    navigator.serviceWorker.register('/sw.js').catch((err) => console.warn('Service worker registration failed:', err));
  });
}
