// First-party visitor analytics, browser side. Posts to our own /api/track
// route (pages/api/track.ts), which adds coarse location from the hosting
// edge, hashes the visitor, and forwards to the backend -- see
// backend/models/site_visit.py for exactly what ends up stored (no IP, no
// cookies, no user agent, no query strings).
import { getUser } from './auth';

const SESSION_KEY = 'pa_session';
const FIRST_TOUCH_KEY = 'pa_first_touch';

// Logged-in app screens and auth callbacks aren't marketing-site traffic.
const UNTRACKED_PREFIXES = ['/dashboard', '/portal', '/oauth', '/api', '/admin'];

function isTrackable(path: string): boolean {
  return !UNTRACKED_PREFIXES.some(p => path === p || path.startsWith(p + '/'));
}

function optedOut(): boolean {
  const nav = navigator as Navigator & { globalPrivacyControl?: boolean };
  return nav.doNotTrack === '1' || (window as any).doNotTrack === '1' || nav.globalPrivacyControl === true;
}

function cleanHost(host: string): string {
  return host.toLowerCase().replace(/^www\./, '');
}

function safeGet(store: Storage, key: string): string | null {
  try { return store.getItem(key); } catch { return null; }
}
function safeSet(store: Storage, key: string, value: string) {
  try { store.setItem(key, value); } catch { /* storage blocked -- tracking still works, just can't dedupe the session */ }
}

// Where this browsing session started: an explicit ?utm_source wins, then
// the referring site's host. Same-site referrers are in-app navigation, not a source.
function entryAttribution() {
  const params = new URLSearchParams(window.location.search);
  let referrerHost: string | undefined;
  try {
    if (document.referrer) {
      const host = cleanHost(new URL(document.referrer).host);
      if (host && host !== cleanHost(window.location.host)) referrerHost = host;
    }
  } catch { /* malformed referrer -- treat as direct */ }
  const utmSource = params.get('utm_source') || undefined;
  return {
    source: utmSource || referrerHost,
    referrer_host: referrerHost,
    utm_medium: params.get('utm_medium') || undefined,
    utm_campaign: params.get('utm_campaign') || undefined,
  };
}

export function trackPageview(path: string) {
  if (typeof window === 'undefined') return;
  if (!isTrackable(path) || optedOut()) return;
  if (['localhost', '127.0.0.1'].includes(window.location.hostname)) return;
  if (getUser()?.is_master) return;   // don't count the owner's own visits

  const isEntry = safeGet(sessionStorage, SESSION_KEY) === null;
  if (isEntry) safeSet(sessionStorage, SESSION_KEY, '1');

  const attribution = isEntry ? entryAttribution() : {};
  if (isEntry && safeGet(localStorage, FIRST_TOUCH_KEY) === null) {
    const a = attribution as ReturnType<typeof entryAttribution>;
    const label = (a.source || 'direct') + (a.utm_campaign ? `/${a.utm_campaign}` : '');
    safeSet(localStorage, FIRST_TOUCH_KEY, label.slice(0, 160));
  }

  fetch('/api/track', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ path, is_entry: isEntry, ...attribution }),
    keepalive: true,
  }).catch(() => { /* analytics must never affect the page */ });
}

// First-ever source for this browser, e.g. "linkedin/launch-post" or "direct".
// Sent with signup and demo requests so conversions can be tied to a channel.
export function getFirstTouchSource(): string | undefined {
  if (typeof window === 'undefined') return undefined;
  return safeGet(localStorage, FIRST_TOUCH_KEY) || undefined;
}
