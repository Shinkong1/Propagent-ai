import { useState } from 'react';
import Link from 'next/link';
import Head from 'next/head';
import { Zap, CheckCircle, Mail } from 'lucide-react';
import toast from 'react-hot-toast';
import { publicContact } from '../lib/api';

const EMPTY = { name: '', email: '', company: '', message: '' };

export default function Contact() {
  const [form, setForm] = useState(EMPTY);
  const [submitting, setSubmitting] = useState(false);
  const [sent, setSent] = useState(false);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.name.trim() || !form.email.trim() || !form.message.trim()) {
      toast.error('Name, email, and a message are required');
      return;
    }
    setSubmitting(true);
    try {
      await publicContact.sendSales(form);
      setSent(true);
    } catch (err: any) {
      toast.error(err?.response?.data?.detail || 'Failed to send — please try again.');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <>
      <Head>
        <title>Talk to Us — PropAgent AI</title>
        <meta name="description" content="Questions about PropAgent AI for your property management company? Get in touch before you sign up." />
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

        <div style={{ maxWidth: 560, margin: '0 auto', padding: '56px 20px 80px' }}>
          <h1 style={{ fontFamily: 'Syne', fontWeight: 800, fontSize: 32, color: 'var(--text-primary)', marginBottom: 10 }}>Talk to us</h1>
          <p style={{ color: 'var(--text-muted)', fontSize: 14.5, marginBottom: 32, lineHeight: 1.6 }}>
            Managing a larger portfolio, or want a walkthrough before you commit? Tell us a bit about what you're running and we'll get back to you —
            no pressure to sign up first. Prefer to just try it? <Link href="/signup" style={{ color: '#FBC02D' }}>Start a free trial</Link> instead.
          </p>

          {sent ? (
            <div style={{ background: 'rgba(16,185,129,0.08)', border: '1px solid rgba(16,185,129,0.3)', borderRadius: 14, padding: 28, textAlign: 'center' }}>
              <CheckCircle size={28} color="#10B981" style={{ marginBottom: 10 }} />
              <h3 style={{ fontFamily: 'Syne', fontWeight: 700, fontSize: 16, color: 'var(--text-primary)', marginBottom: 6 }}>Message sent</h3>
              <p style={{ fontSize: 13, color: 'var(--text-muted)' }}>We'll reply to {form.email} soon.</p>
            </div>
          ) : (
            <form onSubmit={submit} style={{ background: 'var(--bg-surface)', border: '1px solid var(--border-strong)', borderRadius: 14, padding: 24 }}>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10, marginBottom: 12 }}>
                <Field label="Name" value={form.name} onChange={v => setForm(p => ({ ...p, name: v }))} />
                <Field label="Email" type="email" value={form.email} onChange={v => setForm(p => ({ ...p, email: v }))} />
              </div>
              <div style={{ marginBottom: 12 }}>
                <Field label="Company (optional)" value={form.company} onChange={v => setForm(p => ({ ...p, company: v }))} />
              </div>
              <div style={{ marginBottom: 18 }}>
                <label style={lbl}>What are you looking for?</label>
                <textarea value={form.message} onChange={e => setForm(p => ({ ...p, message: e.target.value }))}
                  placeholder="How many units/properties, what you're currently using, questions you have..."
                  spellCheck autoCorrect="on" autoCapitalize="sentences"
                  style={{ ...inp, height: 110, resize: 'none' } as any} />
              </div>
              <button type="submit" disabled={submitting} style={{
                width: '100%', padding: 12, background: 'linear-gradient(135deg, #FBC02D, #F57F17)', color: 'var(--bg-app)',
                fontWeight: 700, fontFamily: 'Syne', fontSize: 14, border: 'none', borderRadius: 8, cursor: 'pointer',
                display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8,
              }}>
                <Mail size={14} /> {submitting ? 'Sending...' : 'Send message'}
              </button>
            </form>
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
