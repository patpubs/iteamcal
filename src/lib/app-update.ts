import { Platform } from 'react-native';

// A Home Screen app on iPhone can stay open for days on the version it first
// loaded. Each time it comes back to the front, check whether a newer version
// has been deployed and reload into it.

const BUNDLE = /\/_expo\/static\/js\/web\/[^"']+\.js/;

function loadedBundle() {
  for (const script of Array.from(document.scripts)) {
    const match = BUNDLE.exec(script.src);
    if (match) return match[0];
  }
  return null;
}

async function checkForUpdate() {
  const current = loadedBundle();
  if (!current) return;
  try {
    const res = await fetch('/', { cache: 'no-store' });
    if (!res.ok) return;
    const latest = BUNDLE.exec(await res.text())?.[0];
    if (latest && latest !== current) window.location.reload();
  } catch {
    // Offline or blocked: try again next time.
  }
}

/** Starts checking for new versions on the web. Safe to call more than once. */
let started = false;
export function watchForUpdates() {
  if (Platform.OS !== 'web' || started || typeof document === 'undefined') return;
  started = true;
  document.addEventListener('visibilitychange', () => {
    if (document.visibilityState === 'visible') checkForUpdate();
  });
  // Also check now and then while the app stays open.
  setInterval(checkForUpdate, 30 * 60 * 1000);
}
