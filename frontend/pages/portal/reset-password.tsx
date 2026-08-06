import { useState } from 'react';
import { useRouter } from 'next/router';
import Head from 'next/head';
import Link from 'next/link';
import { Zap, Lock, CheckCircle } from 'lucide-react';
import toast from 'react-hot-toast';
import { tenantPortal } from '../../lib/tenantApi';
import { setTenantToken, setTenant } from '../../lib/tenantAuth';

export default function TenantResetPassword() {
  const router = useRouter();
  const { token } = router.query;
  const [password, setPassword] = useState('');
  const [confirm, setConfirm] = useState('');
  const [loading, setLoading] = useState(false);
  const [done, setDone] = useState(false);

  const submit = async () => {
    if (password.length < 8) { toast.error('Password must be at least 8 characters'); return; }
    if (password !== confirm) { toast.error("Passwords don't match"); return; }
    if (typeof token !== 'string') { toast.error('Missing reset token — use the link from your email.'); return; }
    setLoading(true);
    try {
      const res = await tenantPortal.resetPassword(token, password);
      setTenantToken(res.data.access_token);
      setTenant({ id: res.data.tenant_id, full_name: res.data.full_name });
      setDone(true);
      setTimeout(() => router.push('/portal'), 1500);
    } catch (err: any) {
      toast.error(err?.response?.data?.detail || 'This reset link is invalid or has expired.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <>
      <Head><title>Set a New Password — Tenant Portal</title></Head>
      <div style={{ minHeight: '100vh', background: 'var(--bg-app)', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 20 }}>
        <div style={{ width: '100%', maxWidth: 380 }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 10, marginBottom: 28 }}>
            <div style={{ width: 34, height: 34, borderRadius: 8, background: 'linear-gradient(135deg, #FBC02D, #F57F17)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              <Zap size={17} color="var(--bg-app)" strokeWidth={2.5} />
            </div>
            <div>
              <div style={{ fontFamily: 'Syne', fontWeight: 800, fontSize: 17, color: 'var(--text-primary)', lineHeight: 1.1 }}>PropAgent AI</div>
              <div style={{ fontSize: 10, color: '#64748B', fontFamily: 'IBM Plex Mono' }}>TENANT PORTAL</div>
            </div>
          </div>

          <div style={{ background: 'var(--bg-surface)', border: '1px solid var(--border-strong)', borderRadius: 16, padding: 28 }}>
            {done ? (
              <div style={{ textAlign: 'center', padding: '8px 0' }}>
                <CheckCircle size={28} color="#10B981" style={{ marginBottom: 12 }} />
                <p style={{ color: 'var(--text-primary)', fontSize: 14, fontFamily: 'IBM Plex Sans' }}>Password updated — taking you to the portal...</p>
              </div>
            ) : (
              <>
                <h1 style={{ fontFamily: 'Syne', fontWeight: 700, fontSize: 20, color: 'var(--text-primary)', marginBottom: 20, textAlign: 'center' }}>Set a new password</h1>
                <label style={lbl}>New password</label>
                <div style={{ position: 'relative', marginBottom: 14 }}>
                  <Lock size={14} style={{ position: 'absolute', left: 12, top: '50%', transform: 'translateY(-50%)', color: '#64748B' }} />
                  <input type="password" value={password} onChange={e => setPassword(e.target.value)} placeholder="At least 8 characters" autoFocus
                    style={{ ...inp, paddingLeft: 34 }} />
                </div>
                <label style={lbl}>Confirm password</label>
                <div style={{ position: 'relative', marginBottom: 20 }}>
                  <Lock size={14} style={{ position: 'absolute', left: 12, top: '50%', transform: 'translateY(-50%)', color: '#64748B' }} />
                  <input type="password" value={confirm} onChange={e => setConfirm(e.target.value)} onKeyDown={e => e.key === 'Enter' && submit()}
                    style={{ ...inp, paddingLeft: 34 }} />
                </div>
                <button onClick={submit} disabled={loading} style={{ width: '100%', padding: 12, background: 'linear-gradient(135deg, #FBC02D, #F57F17)', color: 'var(--bg-app)', fontWeight: 700, fontFamily: 'Syne', fontSize: 14, border: 'none', borderRadius: 8, cursor: 'pointer' }}>
                  {loading ? 'Updating...' : 'Update password'}
                </button>
              </>
            )}
          </div>

          {!done && (
            <p style={{ textAlign: 'center', marginTop: 20, fontSize: 12, color: '#475569' }}>
              <Link href="/portal/login" style={{ color: '#FBC02D', textDecoration: 'none' }}>Back to sign in</Link>
            </p>
          )}
        </div>
      </div>
    </>
  );
}

const lbl: React.CSSProperties = { display: 'block', marginBottom: 5, fontSize: 12, fontFamily: 'IBM Plex Mono', color: 'var(--text-secondary)' };
const inp: React.CSSProperties = { width: '100%', padding: '10px 12px', background: 'var(--bg-app)', border: '1px solid var(--border-input)', borderRadius: 8, color: 'var(--text-primary)', fontSize: 13, fontFamily: 'IBM Plex Sans', outline: 'none', boxSizing: 'border-box' };
