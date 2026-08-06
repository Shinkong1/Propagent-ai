import { useState } from 'react';
import Link from 'next/link';
import Head from 'next/head';
import { Zap, ArrowLeft, MailCheck } from 'lucide-react';
import toast from 'react-hot-toast';
import { auth } from '../lib/api';

export default function ForgotPassword() {
  const [email, setEmail] = useState('');
  const [loading, setLoading] = useState(false);
  const [sent, setSent] = useState(false);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    try {
      await auth.forgotPassword(email);
      setSent(true);
    } catch {
      // Backend always returns success either way -- a real error here means
      // something's actually down, not "email not found".
      toast.error('Something went wrong — please try again in a moment.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <>
      <Head>
        <title>Reset Password — PropAgent AI</title>
        <meta name="robots" content="noindex" />
      </Head>
      <div style={{ minHeight: '100vh', background: 'var(--bg-app)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
        <div style={{ width: '100%', maxWidth: 420, padding: '0 24px' }}>
          <div style={{ textAlign: 'center', marginBottom: 32 }}>
            <div style={{ display: 'inline-flex', alignItems: 'center', gap: 10, marginBottom: 8 }}>
              <div style={{ width: 36, height: 36, borderRadius: 10, background: 'linear-gradient(135deg, #FBC02D, #F57F17)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                <Zap size={18} color="var(--bg-app)" strokeWidth={2.5} />
              </div>
              <span style={{ fontFamily: 'Syne', fontWeight: 800, fontSize: 20, color: 'var(--text-primary)' }}>PropAgent AI</span>
            </div>
            <h1 style={{ fontFamily: 'Syne', fontWeight: 700, fontSize: 24, color: 'var(--text-primary)', marginBottom: 6 }}>Reset your password</h1>
            <p style={{ color: '#64748B', fontSize: 14, fontFamily: 'IBM Plex Sans' }}>We'll email you a link to set a new one.</p>
          </div>

          <div style={{ background: 'var(--bg-surface)', border: '1px solid var(--border-strong)', borderRadius: 16, padding: 28 }}>
            {sent ? (
              <div style={{ textAlign: 'center', padding: '8px 0' }}>
                <MailCheck size={28} color="#10B981" style={{ marginBottom: 12 }} />
                <p style={{ color: 'var(--text-primary)', fontSize: 14, fontFamily: 'IBM Plex Sans', marginBottom: 4 }}>Check your inbox</p>
                <p style={{ color: '#64748B', fontSize: 13, fontFamily: 'IBM Plex Sans' }}>
                  If <b>{email}</b> has a PropAgent AI account, a reset link is on its way — it expires in 30 minutes.
                </p>
              </div>
            ) : (
              <form onSubmit={submit}>
                <div style={{ marginBottom: 20 }}>
                  <label style={labelStyle}>Email</label>
                  <input
                    type="email" required value={email} onChange={e => setEmail(e.target.value)}
                    placeholder="you@company.com" style={inputStyle}
                    spellCheck={false} autoCorrect="off" autoCapitalize="off" autoComplete="email" autoFocus
                  />
                </div>
                <button type="submit" disabled={loading} style={btnStyle}>
                  {loading ? 'Sending...' : 'Send reset link'}
                </button>
              </form>
            )}
          </div>

          <p style={{ textAlign: 'center', marginTop: 20, fontSize: 14, color: '#64748B', fontFamily: 'IBM Plex Sans' }}>
            <Link href="/login" style={{ color: '#FBC02D', textDecoration: 'none', fontWeight: 600, display: 'inline-flex', alignItems: 'center', gap: 5 }}>
              <ArrowLeft size={13} /> Back to sign in
            </Link>
          </p>
        </div>
      </div>
    </>
  );
}

const labelStyle: React.CSSProperties = {
  display: 'block', marginBottom: 6, fontSize: 12, fontFamily: 'IBM Plex Mono',
  color: 'var(--text-secondary)', letterSpacing: '0.5px',
};
const inputStyle: React.CSSProperties = {
  width: '100%', padding: '10px 14px', background: 'var(--bg-app)',
  border: '1px solid var(--border-input)', borderRadius: 8, color: 'var(--text-primary)',
  fontSize: 14, fontFamily: 'IBM Plex Sans', outline: 'none', boxSizing: 'border-box',
};
const btnStyle: React.CSSProperties = {
  width: '100%', padding: '12px', borderRadius: 8,
  background: 'linear-gradient(135deg, #FBC02D, #F57F17)',
  color: 'var(--bg-app)', fontWeight: 700, fontFamily: 'Syne', fontSize: 15,
  border: 'none', cursor: 'pointer', lineHeight: 1.4, boxSizing: 'border-box',
};
