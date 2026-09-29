import { Platform } from 'react-native';

import { supabase } from '@/lib/supabase';

/**
 * Push notifications for the web app (installed to the home screen or open in
 * a browser). Each device signs up separately; the server sends to all of a
 * person's devices.
 *
 * - on: this device gets push notifications.
 * - off: it can, once the person turns them on.
 * - needs-install: iPhone and iPad only allow push once the app is added to
 *   the Home Screen and opened from there.
 * - blocked: the person said no in the browser; only browser settings undo it.
 * - unsupported: this browser can't do push.
 */
export type PushStatus = 'on' | 'off' | 'needs-install' | 'blocked' | 'unsupported';

const web = Platform.OS === 'web' && typeof window !== 'undefined';

function isAppleMobile() {
  const ua = navigator.userAgent;
  // iPadOS reports itself as a Mac with a touch screen.
  return /iPhone|iPad|iPod/.test(ua) || (/Macintosh/.test(ua) && navigator.maxTouchPoints > 1);
}

function installed() {
  return (
    window.matchMedia?.('(display-mode: standalone)').matches ||
    (navigator as Navigator & { standalone?: boolean }).standalone === true
  );
}

/** Registers the service worker that shows pushes. Safe to call on every start. */
export async function registerServiceWorker() {
  if (!web || !('serviceWorker' in navigator)) return null;
  try {
    return await navigator.serviceWorker.register('/sw.js');
  } catch {
    return null;
  }
}

async function currentSubscription() {
  const registration = await navigator.serviceWorker.getRegistration();
  return (await registration?.pushManager?.getSubscription()) ?? null;
}

export async function pushStatus(): Promise<PushStatus> {
  if (!web || !('serviceWorker' in navigator)) return 'unsupported';
  if (isAppleMobile() && !installed()) return 'needs-install';
  if (!('PushManager' in window) || !('Notification' in window)) return 'unsupported';
  if (Notification.permission === 'denied') return 'blocked';
  if (Notification.permission !== 'granted') return 'off';
  return (await currentSubscription()) ? 'on' : 'off';
}

async function publicKey() {
  const { data, error } = await supabase.rpc('push_public_key');
  if (error) throw error;
  if (data) return data;
  // The very first sign-up anywhere: the server makes the keys.
  const made = await supabase.functions.invoke<{ publicKey: string }>('notify-email', { body: { action: 'push-key' } });
  if (made.error || !made.data?.publicKey) throw new Error('Push notifications aren’t available right now.');
  return made.data.publicKey;
}

function keyBytes(base64url: string) {
  const base64 = (base64url + '='.repeat((4 - (base64url.length % 4)) % 4)).replace(/-/g, '+').replace(/_/g, '/');
  return Uint8Array.from(atob(base64), (c) => c.charCodeAt(0));
}

async function save(subscription: PushSubscription) {
  const json = subscription.toJSON();
  const { error } = await supabase.rpc('save_push_subscription', {
    p_endpoint: json.endpoint!,
    p_p256dh: json.keys!.p256dh,
    p_auth: json.keys!.auth,
    p_user_agent: navigator.userAgent,
  });
  if (error) throw error;
}

/** Asks the browser for permission and signs this device up. Call from a button press. */
export async function turnOnPush() {
  // Must come first: browsers only show the prompt straight after a tap.
  const permission = await Notification.requestPermission();
  if (permission !== 'granted') {
    throw new Error('Notifications are blocked for this site. Allow them in your browser settings, then try again.');
  }
  const registration = (await registerServiceWorker()) ?? (await navigator.serviceWorker.ready);
  await navigator.serviceWorker.ready;
  const existing = await registration.pushManager.getSubscription();
  const subscription =
    existing ??
    (await registration.pushManager.subscribe({
      userVisibleOnly: true,
      applicationServerKey: keyBytes(await publicKey()),
    }));
  await save(subscription);
}

/** Stops push on this device. */
export async function turnOffPush() {
  const subscription = await currentSubscription();
  if (!subscription) return;
  await supabase.from('push_subscriptions').delete().eq('endpoint', subscription.endpoint);
  await subscription.unsubscribe();
}

/**
 * On each start, re-links this device to whoever is signed in, so a shared
 * device's pushes follow the current person.
 */
export async function syncPush() {
  if ((await pushStatus()) !== 'on') return;
  const subscription = await currentSubscription();
  if (subscription) await save(subscription).catch(() => {});
}

/** Before signing out: stop sending this person's notifications here. */
export async function forgetThisDevice() {
  if (!web || !('serviceWorker' in navigator)) return;
  const subscription = await currentSubscription().catch(() => null);
  if (subscription) {
    await supabase
      .from('push_subscriptions')
      .delete()
      .eq('endpoint', subscription.endpoint)
      .then(
        () => {},
        () => {},
      );
  }
}
