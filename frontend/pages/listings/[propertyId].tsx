import { useEffect, useState } from 'react';
import { useRouter } from 'next/router';
import Head from 'next/head';
import { MapPin, Home, DollarSign, Maximize2, CheckCircle, Zap } from 'lucide-react';
import toast from 'react-hot-toast';
import { publicListings } from '../../lib/api';

const EMPTY_FORM = { first_name: '', last_name: '', email: '', phone: '', message: '', desired_move_in: '' };

export default function PublicListing() {
  const router = useRouter();
  const { propertyId } = router.query;
  const [listing, setListing] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);
  const [selectedUnitId, setSelectedUnitId] = useState<string>('');
  const [form, setForm] = useState(EMPTY_FORM);
  const [submitting, setSubmitting] = useState(false);
  const [submitted, setSubmitted] = useState(false);

  useEffect(() => {
    if (!propertyId || typeof propertyId !== 'string') return;
    publicListings.get(propertyId)
      .then(r => setListing(r.data))
      .catch(() => setError(true))
      .finally(() => setLoading(false));
  }, [propertyId]);

  const submitInquiry = async () => {
    if (!form.first_name.trim() || !form.last_name.trim()) {
      toast.error('Name is required');
      return;
    }
    if (!form.email.trim() && !form.phone.trim()) {
      toast.error('Enter an email or phone number so they can reach you back');
      return;
    }
    setSubmitting(true);
    try {
      await publicListings.inquire(propertyId as string, {
        ...form,
        desired_move_in: form.desired_move_in || undefined,
        unit_id: selectedUnitId || undefined,
      });
      setSubmitted(true);
      toast.success('Inquiry sent!');
    } catch (err: any) {
      toast.error(err?.response?.data?.detail || 'Failed to submit — please try again');
    } finally {
      setSubmitting(false);
    }
  };

  if (loading) {
    return <div style={{ minHeight: '100vh', background: 'var(--bg-app)', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--text-muted)', fontFamily: 'IBM Plex Mono' }}>Loading...</div>;
  }

  if (error || !listing) {
    return (
      <div style={{ minHeight: '100vh', background: 'var(--bg-app)', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--text-muted)', textAlign: 'center', padding: 20 }}>
        This listing isn't available — it may have been removed or the link is incorrect.
      </div>
    );
  }

  return (
    <>
      <Head>
        <title>{listing.name} — {listing.city}, {listing.state} | For Rent</title>
        <meta name="description" content={`${listing.units.length} unit(s) available at ${listing.name}, ${listing.address}, ${listing.city}, ${listing.state}.`} />
      </Head>
      <div style={{ minHeight: '100vh', background: 'var(--bg-app)', color: '#E2E8F0' }}>
        <nav style={{ display: 'flex', alignItems: 'center', padding: '20px 24px', borderBottom: '1px solid var(--border-subtle)' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <div style={{ width: 28, height: 28, borderRadius: 7, background: 'linear-gradient(135deg, #FBC02D, #F57F17)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              <Zap size={14} color="var(--bg-app)" strokeWidth={2.5} />
            </div>
            <span style={{ fontFamily: 'Syne', fontWeight: 700, fontSize: 14, color: 'var(--text-secondary)' }}>Listed via PropAgent AI</span>
          </div>
        </nav>

        <div style={{ maxWidth: 720, margin: '0 auto', padding: '40px 20px 80px' }}>
          <h1 style={{ fontFamily: 'Syne', fontWeight: 800, fontSize: 32, color: 'var(--text-primary)', marginBottom: 8 }}>{listing.name}</h1>
          <div style={{ display: 'flex', alignItems: 'center', gap: 6, color: 'var(--text-muted)', fontSize: 14, marginBottom: 20 }}>
            <MapPin size={14} />
            {listing.address}, {listing.city}, {listing.state} {listing.zip_code}
          </div>
          {listing.description && (
            <p style={{ fontSize: 14, lineHeight: 1.7, color: 'var(--text-secondary)', marginBottom: 32 }}>{listing.description}</p>
          )}

          <h2 style={{ fontFamily: 'Syne', fontWeight: 700, fontSize: 18, color: 'var(--text-primary)', marginBottom: 14 }}>
            {listing.units.length} Unit{listing.units.length === 1 ? '' : 's'} Available
          </h2>

          {listing.units.length === 0 ? (
            <div style={{ background: 'var(--bg-surface)', border: '1px solid var(--border-strong)', borderRadius: 12, padding: 24, textAlign: 'center', color: 'var(--text-muted)', fontSize: 14, marginBottom: 32 }}>
              No vacant units right now — check back soon, or submit an inquiry below to be notified.
            </div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 10, marginBottom: 32 }}>
              {listing.units.map((u: any) => (
                <div key={u.id}
                  onClick={() => setSelectedUnitId(u.id)}
                  style={{
                    background: 'var(--bg-surface)', border: `1px solid ${selectedUnitId === u.id ? '#FBC02D' : 'var(--border-strong)'}`,
                    borderRadius: 12, padding: 18, cursor: 'pointer', transition: 'border-color 0.15s',
                  }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8, flexWrap: 'wrap', gap: 8 }}>
                    <span style={{ fontFamily: 'Syne', fontWeight: 700, fontSize: 15, color: 'var(--text-primary)' }}>Unit {u.unit_number}</span>
                    <span style={{ fontFamily: 'IBM Plex Mono', fontSize: 18, fontWeight: 600, color: '#FBC02D' }}>${u.monthly_rent.toLocaleString()}/mo</span>
                  </div>
                  <div style={{ display: 'flex', gap: 16, fontSize: 12, color: 'var(--text-muted)', marginBottom: u.description ? 8 : 0 }}>
                    <span style={{ display: 'flex', alignItems: 'center', gap: 4 }}><Home size={12} /> {u.bedrooms} bd / {u.bathrooms} ba</span>
                    {u.square_feet && <span style={{ display: 'flex', alignItems: 'center', gap: 4 }}><Maximize2 size={12} /> {u.square_feet} sqft</span>}
                  </div>
                  {u.description && <p style={{ fontSize: 13, color: 'var(--text-secondary)', margin: 0 }}>{u.description}</p>}
                  {selectedUnitId === u.id && (
                    <div style={{ marginTop: 10, display: 'flex', alignItems: 'center', gap: 6, fontSize: 12, color: '#FBC02D' }}>
                      <CheckCircle size={13} /> Selected for inquiry below
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}

          {submitted ? (
            <div style={{ background: 'rgba(16,185,129,0.08)', border: '1px solid rgba(16,185,129,0.3)', borderRadius: 14, padding: 28, textAlign: 'center' }}>
              <CheckCircle size={28} color="#10B981" style={{ marginBottom: 10 }} />
              <h3 style={{ fontFamily: 'Syne', fontWeight: 700, fontSize: 16, color: 'var(--text-primary)', marginBottom: 6 }}>Thanks — you're all set!</h3>
              <p style={{ fontSize: 13, color: 'var(--text-muted)' }}>The property manager has been notified and will reach out soon.</p>
            </div>
          ) : (
            <div style={{ background: 'var(--bg-surface)', border: '1px solid var(--border-strong)', borderRadius: 14, padding: 24 }}>
              <h2 style={{ fontFamily: 'Syne', fontWeight: 700, fontSize: 16, color: 'var(--text-primary)', marginBottom: 16 }}>Interested? Send an inquiry</h2>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10, marginBottom: 12 }}>
                <Field label="First Name" value={form.first_name} onChange={v => setForm(p => ({ ...p, first_name: v }))} />
                <Field label="Last Name" value={form.last_name} onChange={v => setForm(p => ({ ...p, last_name: v }))} />
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10, marginBottom: 12 }}>
                <Field label="Email" type="email" value={form.email} onChange={v => setForm(p => ({ ...p, email: v }))} />
                <Field label="Phone" type="tel" value={form.phone} onChange={v => setForm(p => ({ ...p, phone: v }))} />
              </div>
              <div style={{ marginBottom: 12 }}>
                <Field label="Desired Move-in Date" type="date" value={form.desired_move_in} onChange={v => setForm(p => ({ ...p, desired_move_in: v }))} />
              </div>
              <div style={{ marginBottom: 18 }}>
                <label style={lbl}>Message (optional)</label>
                <textarea value={form.message} onChange={e => setForm(p => ({ ...p, message: e.target.value }))}
                  placeholder="Tell them a bit about what you're looking for..."
                  spellCheck autoCorrect="on" autoCapitalize="sentences"
                  style={{ ...inp, height: 80, resize: 'none' } as any} />
              </div>

              <button onClick={submitInquiry} disabled={submitting} style={{
                width: '100%', padding: 12, background: 'linear-gradient(135deg, #FBC02D, #F57F17)', color: 'var(--bg-app)',
                fontWeight: 700, fontFamily: 'Syne', fontSize: 14, border: 'none', borderRadius: 8, cursor: 'pointer',
              }}>
                {submitting ? 'Sending...' : 'Send Inquiry'}
              </button>
            </div>
          )}
        </div>
      </div>
    </>
  );
}

function Field({ label, value, onChange, type = 'text' }: { label: string; value: string; onChange: (v: string) => void; type?: string }) {
  return (
    <div>
      <label style={lbl}>{label}</label>
      <input type={type} value={value} onChange={e => onChange(e.target.value)}
        spellCheck={type === 'text'} autoCorrect={type === 'text' ? 'on' : 'off'}
        style={inp} />
    </div>
  );
}

const lbl: React.CSSProperties = { display: 'block', marginBottom: 5, fontSize: 12, fontFamily: 'IBM Plex Mono', color: 'var(--text-secondary)' };
const inp: React.CSSProperties = { width: '100%', padding: '9px 12px', background: 'var(--bg-app)', border: '1px solid var(--border-input)', borderRadius: 8, color: 'var(--text-primary)', fontSize: 13, fontFamily: 'IBM Plex Sans', outline: 'none', boxSizing: 'border-box' };
