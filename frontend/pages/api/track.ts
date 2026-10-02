// Receives a page-view beacon from lib/siteTracking.ts, adds what only the
// hosting edge can see (coarse location), hashes the visitor, and forwards it
// to the FastAPI backend (POST /site-traffic/track). The raw IP and user agent
// stop here -- only a daily-rotating hash and the coarse country/region/city
// go on to be stored. See backend/models/site_visit.py.
//
// Needs ANALYTICS_TRACK_SECRET set to the same value here (Vercel env) and on
// the Render backend; without it this does nothing, so tracking is simply off.
import type { NextApiRequest, NextApiResponse } from 'next';
import crypto from 'crypto';

const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8000';
const SECRET = process.env.ANALYTICS_TRACK_SECRET || '';

const BOT_RE = /bot|crawl|spider|slurp|preview|headless|lighthouse|pingdom|uptime|monitor|facebookexternalhit|python-requests|curl|wget|httpclient|axios|node-fetch|go-http|java\//i;
const UNTRACKED_PREFIXES = ['/dashboard', '/portal', '/oauth', '/api', '/admin'];

function header(req: NextApiRequest, name: string): string {
  const v = req.headers[name];
  return (Array.isArray(v) ? v[0] : v) || '';
}

function deviceFor(ua: string): 'mobile' | 'tablet' | 'desktop' {
  if (/ipad|tablet|kindle|silk/i.test(ua)) return 'tablet';
  if (/mobi|android|iphone|ipod/i.test(ua)) return 'mobile';
  return 'desktop';
}

function str(v: unknown, max: number): string | undefined {
  return typeof v === 'string' && v.trim() ? v.trim().slice(0, max) : undefined;
}

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  // Always answer 204 -- the browser doesn't care and shouldn't learn why a beacon was dropped.
  if (req.method !== 'POST' || !SECRET) return res.status(204).end();

  // Cheap guard against drive-by posts from other sites; not real security
  // (headers can be forged), just keeps stray cross-site noise out.
  const origin = header(req, 'origin');
  if (origin) {
    let host = '';
    try { host = new URL(origin).hostname; } catch { /* ignore */ }
    if (host !== 'propagent.app' && !host.endsWith('.propagent.app')) return res.status(204).end();
  }

  const ua = header(req, 'user-agent');
  if (!ua || BOT_RE.test(ua)) return res.status(204).end();

  const body = (req.body && typeof req.body === 'object') ? req.body : {};
  const path = str(body.path, 300);
  if (!path || !path.startsWith('/') || UNTRACKED_PREFIXES.some(p => path === p || path.startsWith(p + '/'))) {
    return res.status(204).end();
  }

  const ip = header(req, 'x-forwarded-for').split(',')[0].trim() || req.socket.remoteAddress || '';
  const day = new Date().toISOString().slice(0, 10);   // salt rotates daily, so a hash can't follow anyone across days
  const visitorHash = crypto.createHash('sha256').update(`${ip}|${ua}|${day}|${SECRET}`).digest('hex');

  let city = header(req, 'x-vercel-ip-city');
  try { city = decodeURIComponent(city); } catch { /* keep as-is */ }

  const payload = {
    path,
    is_entry: body.is_entry === true,
    source: str(body.source, 120),
    referrer_host: str(body.referrer_host, 200),
    utm_medium: str(body.utm_medium, 120),
    utm_campaign: str(body.utm_campaign, 120),
    country: str(header(req, 'x-vercel-ip-country'), 2),
    region: str(header(req, 'x-vercel-ip-country-region'), 100),
    city: str(city, 100),
    device: deviceFor(ua),
    visitor_hash: visitorHash,
  };

  // Serverless functions can be frozen once the response is sent, so wait
  // for the forward -- but bounded, and the browser never waits on this.
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 3000);
  try {
    await fetch(`${API_URL}/site-traffic/track`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'X-Track-Secret': SECRET },
      body: JSON.stringify(payload),
      signal: controller.signal,
    });
  } catch { /* analytics failure is never surfaced */ } finally {
    clearTimeout(timer);
  }
  return res.status(204).end();
}
