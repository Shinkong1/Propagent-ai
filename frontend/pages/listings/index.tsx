import { useEffect, useState } from 'react';
import Link from 'next/link';
import Head from 'next/head';
import { MapPin, Home, Search, Zap, Building2 } from 'lucide-react';
import { publicListings } from '../../lib/api';

export default function ListingsDirectory() {
  const [listings, setListings] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [city, setCity] = useState('');
  const [state, setState] = useState('');

  const load = (params?: { city?: string; state?: string }) => {
    setLoading(true);
    publicListings.browse(params)
      .then(r => setListings(r.data || []))
      .catch(() => setListings([]))
      .finally(() => setLoading(false));
  };

  useEffect(() => { load(); }, []);

  const search = (e: React.FormEvent) => {
    e.preventDefault();
    load({ city: city.trim() || undefined, state: state.trim() || undefined });
  };

  return (
    <>
      <Head>
        <title>Browse Rentals — Apartments &amp; Homes for Rent | PropAgent AI</title>
        <meta name="description" content="Search available apartments and rental homes listed by property managers on PropAgent AI. Browse by city and state." />
      </Head>
      <div style={{ minHeight: '100vh', background: 'var(--bg-app)', color: '#E2E8F0' }}>
        <nav style={{ display: 'flex', alignItems: 'center', padding: '20px 24px', borderBottom: '1px solid var(--border-subtle)' }}>
          <Link href="/" style={{ display: 'flex', alignItems: 'center', gap: 10, textDecoration: 'none' }}>
            <div style={{ width: 28, height: 28, borderRadius: 7, background: 'linear-gradient(135deg, #FBC02D, #F57F17)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              <Zap size={14} color="var(--bg-app)" strokeWidth={2.5} />
            </div>
            <span style={{ fontFamily: 'Syne', fontWeight: 700, fontSize: 14, color: 'var(--text-secondary)' }}>PropAgent AI</span>
          </Link>
        </nav>

        <div style={{ maxWidth: 960, margin: '0 auto', padding: '48px 20px 80px' }}>
          <h1 style={{ fontFamily: 'Syne', fontWeight: 800, fontSize: 34, color: 'var(--text-primary)', marginBottom: 8 }}>Browse Rentals</h1>
          <p style={{ color: '#64748B', fontSize: 14, marginBottom: 28 }}>
            Available apartments and homes listed directly by their property managers.
          </p>

          <form onSubmit={search} style={{ display: 'flex', gap: 10, marginBottom: 32, flexWrap: 'wrap' }}>
            <input value={city} onChange={e => setCity(e.target.value)} placeholder="City"
              style={{ flex: '1 1 200px', padding: '11px 14px', background: 'var(--bg-surface)', border: '1px solid var(--border-strong)', borderRadius: 8, color: 'var(--text-primary)', fontSize: 13, fontFamily: 'IBM Plex Sans', outline: 'none' }} />
            <input value={state} onChange={e => setState(e.target.value)} placeholder="State"
              style={{ flex: '0 1 120px', padding: '11px 14px', background: 'var(--bg-surface)', border: '1px solid var(--border-strong)', borderRadius: 8, color: 'var(--text-primary)', fontSize: 13, fontFamily: 'IBM Plex Sans', outline: 'none' }} />
            <button type="submit" style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '11px 20px', background: 'linear-gradient(135deg, #FBC02D, #F57F17)', color: 'var(--bg-app)', fontWeight: 700, fontFamily: 'Syne', fontSize: 13, border: 'none', borderRadius: 8, cursor: 'pointer' }}>
              <Search size={14} /> Search
            </button>
          </form>

          {loading ? (
            <div style={{ color: '#64748B', fontFamily: 'IBM Plex Mono' }}>Loading...</div>
          ) : listings.length === 0 ? (
            <div style={{ background: 'var(--bg-surface)', border: '1px solid var(--border-strong)', borderRadius: 12, padding: 48, textAlign: 'center', color: '#64748B' }}>
              <Building2 size={28} style={{ margin: '0 auto 12px', opacity: 0.3, display: 'block' }} />
              No listings found{city || state ? ' for that search' : ' yet'}. Check back soon.
            </div>
          ) : (
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(260px, 1fr))', gap: 16 }}>
              {listings.map((l: any) => (
                <Link key={l.id} href={`/listings/${l.id}`} style={{ textDecoration: 'none' }}>
                  <div style={{ background: 'var(--bg-surface)', border: '1px solid var(--border-strong)', borderRadius: 12, padding: 18, height: '100%', cursor: 'pointer' }}>
                    <div style={{ fontFamily: 'Syne', fontWeight: 700, fontSize: 15, color: 'var(--text-primary)', marginBottom: 6 }}>{l.name}</div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 5, fontSize: 12, color: '#64748B', marginBottom: 12 }}>
                      <MapPin size={11} /> {l.city}, {l.state}
                    </div>
                    <div style={{ fontFamily: 'IBM Plex Mono', fontSize: 17, fontWeight: 600, color: '#FBC02D', marginBottom: 8 }}>
                      ${l.min_rent.toLocaleString()}{l.max_rent !== l.min_rent ? `–$${l.max_rent.toLocaleString()}` : ''}/mo
                    </div>
                    <div style={{ display: 'flex', gap: 14, fontSize: 12, color: '#64748B' }}>
                      <span style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
                        <Home size={12} /> {l.min_bedrooms === l.max_bedrooms ? `${l.min_bedrooms} bd` : `${l.min_bedrooms}-${l.max_bedrooms} bd`}
                      </span>
                      <span>{l.unit_count} unit{l.unit_count === 1 ? '' : 's'} available</span>
                    </div>
                  </div>
                </Link>
              ))}
            </div>
          )}
        </div>
      </div>
    </>
  );
}
