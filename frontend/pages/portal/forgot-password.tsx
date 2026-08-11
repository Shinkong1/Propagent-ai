import { useState } from 'react';
import Head from 'next/head';
import Link from 'next/link';
import { Zap, Mail, MailCheck, ArrowLeft } from 'lucide-react';
import toast from 'react-hot-toast';
import { tenantPortal } from '../../lib/tenantApi';

export default function TenantForgotPassword() {
  const [email, setEmail] = useState('');
  const [loading, setLoading] = useState(false);
  const [sent, setSent] = useState(false);

  const submit = async () => {
    if (!email.trim()) { toast.error('Enter your email'); return; }
    setLoading(true);
    try {
      await tenantPortal.forgotPassword(email.trim());
      setSent(true);
    } catch {
      toast.error('Something went wrong — please try again in a moment.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <>
      <Head><title>Reset Password — Tenant Portal</title></Head>
      <div style={{ minHeight: '100vh', background: 'var(--bg-app)', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 20 }}>
        <div style={{ width: '100%', maxWidth: 380 }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 10, marginBottom: 28 }}>
            <div style={{ width: 34, height: 34, borderRadius: 8, background: 'linear-gradient(135deg, #FBC02D, #F57F17)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              <Zap size={17} color="var(--bg-app)" strokeWidth={2.5} />
            </div>
            <div>
              <div style={{ fontFamily: 'Syne', fontWeight: 800, fontSize: 17, color: 'var(--text-primary)', lineHeight: 1.1 }}>PropAgent AI</div>
              <div style={{ fontSize: 10, color: 'var(--text-muted)', fontFamily: 'IBM Plex Mono' }}>TENANT PORTAL</div>
            </div>
          </div>

          <div style={{ background: 'var(--bg-surface)', border: '1px solid var(--border-strong)', borderRadius: 16, padding: 28 }}>
            {sent ? (
              <div style={{ textAlign: 'center', padding: '8px 0' }}>
                <MailCheck size={28} color="#10B981" style={{ marginBottom: 12 }} />
                <p style={{ color: 'var(--text-primary)', fontSize: 14, fontFamily: 'IBM Plex Sans', marginBottom: 4 }}>Check your inbox</p>
                <p style={{ color: 'var(--text-muted)', fontSize: 13, fontFamily: 'IBM Plex Sans' }}>If <b>{email}</b> has a tenant portal account, a reset link is on its way — it expires in 1 hour.</p>
              </div>
            ) : (
              <>
                <h1 style={{ fontFamily: 'Syne', fontWeight: 700, fontSize: 20, color: 'var(--text-primary)', marginBottom: 8, textAlign: 'center' }}>Reset your password</h1>
                <p style={{ fontSize: 13, color: 'var(--text-muted)', textAlign: 'center', marginBottom: 20 }}>We'll email you a link to set a new one.</p>
                <label style={lbl}>Email</label>
                <div style={{ position: 'relative', marginBottom: 20 }}>
                  <Mail size={14} style={{ position: 'absolute', left: 12, top: '50%', transform: 'translateY(-50%)', color: 'var(--text-muted)' }} />
                  <input type="email" value={email} onChange={e => setEmail(e.target.value)} onKeyDown={e => e.key === 'Enter' && submit()}
                    spellCheck={false} autoCorrect="off" autoCapitalize="off" autoFocus
                    style={{ ...inp, paddingLeft: 34 }} />
                </div>
                <button onClick={submit} disabled={loading} style={{ width: '100%', padding: 12, background: 'linear-gradient(135deg, #FBC02D, #F57F17)', color: 'var(--bg-app)', fontWeight: 700, fontFamily: 'Syne', fontSize: 14, border: 'none', borderRadius: 8, cursor: 'pointer' }}>
                  {loading ? 'Sending...' : 'Send reset link'}
                </button>
              </>
            )}
          </div>

          <p style={{ textAlign: 'center', marginTop: 20, fontSize: 12, color: '#475569' }}>
            <Link href="/portal/login" style={{ color: '#FBC02D', textDecoration: 'none', display: 'inline-flex', alignItems: 'center', gap: 5 }}>
              <ArrowLeft size={12} /> Back to sign in
            </Link>
          </p>
        </div>
      </div>
    </>
  );
}

const lbl: React.CSSProperties = { display: 'block', marginBottom: 5, fontSize: 12, fontFamily: 'IBM Plex Mono', color: 'var(--text-secondary)' };
const inp: React.CSSProperties = { width: '100%', padding: '10px 12px', background: 'var(--bg-app)', border: '1px solid var(--border-input)', borderRadius: 8, color: 'var(--text-primary)', fontSize: 13, fontFamily: 'IBM Plex Sans', outline: 'none', boxSizing: 'border-box' };
