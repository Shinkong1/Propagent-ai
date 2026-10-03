import { useEffect, useState } from 'react';
import { BarChart3 } from 'lucide-react';
import { admin as adminApi } from '../lib/api';

// Owner-only "who's visiting the public site, and from where" panel for the
// Marketing Hub. Data comes from GET /admin/site-traffic, fed by the
// first-party tracker (lib/siteTracking.ts -> pages/api/track.ts ->
// backend /site-traffic/track). No raw IPs are stored anywhere in that chain.

type Row = { label: string; count: number };
type Summary = {
  days: number; views: number; visitors: number; sessions: number; demo_requests: number; signups: number;
  daily: { date: string; views: number; visitors: number }[];
  top_pages: Row[]; sources: Row[]; campaigns: Row[]; countries: Row[]; regions: Row[]; devices: Row[]; signup_sources: Row[];
};

const PERIODS = [7, 30, 90] as const;
const card: React.CSSProperties = { background: 'var(--bg-surface)', border: '1px solid var(--border-strong)', borderRadius: 12, padding: 16 };
const heading: React.CSSProperties = { fontFamily: 'Syne', fontWeight: 700, fontSize: 13, color: 'var(--text-primary)', marginBottom: 10 };

function countryName(code: string): string {
  try { return new Intl.DisplayNames(['en'], { type: 'region' }).of(code) || code; } catch { return code; }
}

function Tile({ label, value }: { label: string; value: number }) {
  return (
    <div style={{ ...card, flex: '1 1 130px', minWidth: 130 }}>
      <div style={{ fontFamily: 'IBM Plex Mono', fontWeight: 500, fontSize: 24, color: 'var(--text-primary)' }}>{value.toLocaleString()}</div>
      <div style={{ fontSize: 12, color: 'var(--text-muted)', marginTop: 2 }}>{label}</div>
    </div>
  );
}

function RankList({ title, rows, format, empty = 'Nothing yet' }: { title: string; rows: Row[]; format?: (l: string) => string; empty?: string }) {
  const max = Math.max(1, ...rows.map(r => r.count));
  return (
    <div style={{ ...card, minWidth: 0 }}>
      <div style={heading}>{title}</div>
      {rows.length === 0 ? (
        <div style={{ fontSize: 12, color: 'var(--text-muted)' }}>{empty}</div>
      ) : rows.map(r => (
        <div key={r.label} style={{ position: 'relative', marginBottom: 6, borderRadius: 6, overflow: 'hidden' }}>
          <div style={{ position: 'absolute', inset: 0, width: `${(r.count / max) * 100}%`, background: 'rgba(251,192,45,0.14)' }} />
          <div style={{ position: 'relative', display: 'flex', justifyContent: 'space-between', gap: 10, padding: '5px 8px', fontSize: 12.5 }}>
            <span style={{ color: 'var(--text-secondary)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{format ? format(r.label) : r.label}</span>
            <span style={{ fontFamily: 'IBM Plex Mono', color: 'var(--text-primary)', flexShrink: 0 }}>{r.count.toLocaleString()}</span>
          </div>
        </div>
      ))}
    </div>
  );
}

export default function SiteTrafficPanel() {
  const [days, setDays] = useState<number>(30);
  const [data, setData] = useState<Summary | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [attempt, setAttempt] = useState(0);

  useEffect(() => {
    let cancelled = false;
    setError(null);
    adminApi.siteTraffic(days)
      .then(r => { if (!cancelled) setData(r.data); })
      .catch(err => {
        if (cancelled) return;
        const status = err?.response?.status;
        const detail = err?.response?.data?.detail;
        // A restarting Render service answers with no JSON body at all (or no response), so say that
        // instead of a bare failure -- it's the most common reason this panel errors right after a deploy.
        setError(detail ? String(detail)
          : status ? `The server returned an error (${status}).`
          : 'Could not reach the server. It may be restarting after a deploy.');
      });
    return () => { cancelled = true; };
  }, [days, attempt]);

  const maxViews = Math.max(1, ...(data?.daily.map(d => d.views) || [1]));

  return (
    <div style={{ marginBottom: 32 }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: 10, marginBottom: 14 }}>
        <h2 style={{ display: 'flex', alignItems: 'center', gap: 8, fontFamily: 'Syne', fontWeight: 700, fontSize: 16, color: 'var(--text-primary)' }}>
          <BarChart3 size={16} color="#FBC02D" /> Website traffic
        </h2>
        <div style={{ display: 'flex', gap: 6 }}>
          {PERIODS.map(p => (
            <button key={p} onClick={() => setDays(p)} aria-pressed={days === p}
              style={{
                padding: '5px 11px', borderRadius: 6, fontSize: 11.5, fontFamily: 'IBM Plex Mono', cursor: 'pointer',
                background: days === p ? 'rgba(251,192,45,0.12)' : 'var(--bg-app)',
                border: `1px solid ${days === p ? 'rgba(251,192,45,0.4)' : 'var(--border-strong)'}`,
                color: days === p ? 'var(--pa-gold-text, #FBC02D)' : 'var(--text-secondary)',
              }}>
              {p}d
            </button>
          ))}
        </div>
      </div>

      {error && (
        <div style={{ ...card, fontSize: 12.5, color: '#EF4444', display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12, flexWrap: 'wrap' }}>
          <span>{error}</span>
          <button onClick={() => setAttempt(a => a + 1)} style={{ padding: '5px 11px', borderRadius: 6, fontSize: 11.5, fontFamily: 'IBM Plex Mono', cursor: 'pointer', background: 'var(--bg-app)', border: '1px solid var(--border-strong)', color: 'var(--text-secondary)' }}>Retry</button>
        </div>
      )}
      {!data && !error && <div style={{ ...card, fontSize: 12.5, color: 'var(--text-muted)' }}>Loading…</div>}

      {data && (
        <>
          {data.views === 0 && (
            <div style={{ ...card, marginBottom: 12, fontSize: 12.5, lineHeight: 1.6, color: 'var(--text-secondary)', border: '1px solid rgba(251,192,45,0.3)' }}>
              <b style={{ color: 'var(--text-primary)' }}>No visits recorded yet.</b> Tracking stays off until the same secret is set on both sides:
              add <code style={{ fontFamily: 'IBM Plex Mono' }}>ANALYTICS_TRACK_SECRET</code> (any long random string) to the Render backend
              <i> and </i> the Vercel project, then redeploy. Your own visits while signed in as owner are never counted.
            </div>
          )}

          <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap', marginBottom: 12 }}>
            <Tile label="Unique visitors" value={data.visitors} />
            <Tile label="Page views" value={data.views} />
            <Tile label="Demo requests" value={data.demo_requests} />
            <Tile label="New signups" value={data.signups} />
          </div>

          <div style={{ ...card, marginBottom: 12 }}>
            <div style={heading}>Page views per day</div>
            <div role="img" aria-label={`Page views per day over the last ${data.days} days`}
              style={{ display: 'flex', alignItems: 'flex-end', gap: data.days > 30 ? 1 : 3, height: 90 }}>
              {data.daily.map(d => (
                <div key={d.date} title={`${d.date}: ${d.views} views, ${d.visitors} visitors`}
                  style={{ flex: 1, minWidth: 1, height: `${Math.max(2, (d.views / maxViews) * 100)}%`, background: d.views ? '#FBC02D' : 'var(--border-strong)', borderRadius: 2, opacity: d.views ? 0.85 : 0.5 }} />
              ))}
            </div>
            <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: 6, fontSize: 10.5, fontFamily: 'IBM Plex Mono', color: 'var(--text-muted)' }}>
              <span>{data.daily[0]?.date}</span><span>{data.daily[data.daily.length - 1]?.date}</span>
            </div>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))', gap: 10 }}>
            <RankList title="Where visitors came from" rows={data.sources} empty="No traffic sources yet" />
            <RankList title="Top pages" rows={data.top_pages} />
            <RankList title="Countries" rows={data.countries} format={countryName} />
            <RankList title="Regions" rows={data.regions} />
            <RankList title="Campaigns (utm_campaign)" rows={data.campaigns} empty="Tag links with ?utm_campaign=… to see them here" />
            <RankList title="Where signups came from" rows={data.signup_sources} empty="No attributed signups yet" />
            <RankList title="Devices" rows={data.devices} />
          </div>
          <div style={{ marginTop: 10, fontSize: 11, color: 'var(--text-muted)', lineHeight: 1.5 }}>
            Counts are anonymous: no IP addresses or cookies are stored, and a visitor can only be counted as unique within a single day. Location is approximate.
            Tip: add <code style={{ fontFamily: 'IBM Plex Mono' }}>?utm_source=linkedin&amp;utm_campaign=launch</code> to links you post to see exactly which post sent someone.
          </div>
        </>
      )}
    </div>
  );
}
