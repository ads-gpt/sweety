import { api } from '@/lib/api';

export const pushSupported = () =>
  typeof window !== 'undefined' && 'serviceWorker' in navigator && 'PushManager' in window && 'Notification' in window;

const urlBase64ToUint8Array = (base64) => {
  const padded = base64 + '='.repeat((4 - (base64.length % 4)) % 4);
  const raw = atob(padded.replace(/-/g, '+').replace(/_/g, '/'));
  return Uint8Array.from(raw, (c) => c.charCodeAt(0));
};

const registration = () => navigator.serviceWorker.ready;

/** Is this browser currently subscribed to push for Sweety? */
export async function currentSubscription() {
  if (!pushSupported()) return null;
  return (await registration()).pushManager.getSubscription();
}

/** Ask permission, subscribe this device and register it with the server. */
export async function enablePush() {
  if (!pushSupported()) throw new Error('This browser does not support push notifications.');
  const { enabled, publicKey } = await api.pushKey();
  if (!enabled) throw new Error('Push notifications are not configured on this server.');
  const permission = await Notification.requestPermission();
  if (permission !== 'granted') throw new Error('Notifications are blocked. Allow them in your browser settings to turn this on.');
  const reg = await registration();
  const sub = (await reg.pushManager.getSubscription()) ?? (await reg.pushManager.subscribe({ userVisibleOnly: true, applicationServerKey: urlBase64ToUint8Array(publicKey) }));
  await api.pushSubscribe(sub.toJSON());
  return sub;
}

export async function disablePush() {
  const sub = await currentSubscription();
  if (!sub) return;
  await api.pushUnsubscribe(sub.endpoint).catch(() => {});
  await sub.unsubscribe();
}
