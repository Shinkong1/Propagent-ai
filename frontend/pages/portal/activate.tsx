import { useState } from 'react';
import { useRouter } from 'next/router';
import Head from 'next/head';
import { Zap, Lock } from 'lucide-react';
import toast from 'react-hot-toast';
import { tenantPortal } from '../../lib/tenantApi';
import { setTenantToken, setTenant } from '../../lib/tenantAuth';

export default function TenantActivate() {
  const router = useRouter();
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [loading, setLoading] = useState(false);

  const submit = async () => {
    const token = typeof router.query.token === 'string' ? router.query.token : '';
    if (!token) {
      toast.error('This link is missing its invite token — use the link from your email.');
      return;
    }
    if (password.length < 8) {
      toast.error('Password must be at least 8 characters');
      return;
    }
    if (password !== confirmPassword) {
      toast.error("Passwords don't match");
      return;
    }
    setLoading(true);
    try {
      const res = await tenantPortal.activate(token, password);
      setTenantToken(res.data.access_token);
      setTenant({ id: res.data.tenant_id, full_name: res.data.full_name });
      toast.success('Account set up!');
      router.push('/portal');
    } catch (err: any) {
      toast.error(err?.response?.data?.detail || 'Activation failed');
    } finally {
      setLoading(false);
    }
  };

  return (
    <>
      <Head><title>Set Up Your Tenant Portal Account</title></Head>
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
            <h1 style={{ fontFamily: 'Syne', fontWeight: 700, fontSize: 20, color: 'var(--text-primary)', marginBottom: 6, textAlign: 'center' }}>Set your password</h1>
            <p style={{ fontSize: 13, color: 'var(--text-muted)', textAlign: 'center', marginBottom: 20 }}>Create a password to finish setting up your account.</p>

            <label style={lbl}>New Password</label>
            <div style={{ position: 'relative', marginBottom: 14 }}>
              <Lock size={14} style={{ position: 'absolute', left: 12, top: '50%', transform: 'translateY(-50%)', color: 'var(--text-muted)' }} />
              <input type="password" value={password} onChange={e => setPassword(e.target.value)} style={{ ...inp, paddingLeft: 34 }} />
            </div>

            <label style={lbl}>Confirm Password</label>
            <div style={{ position: 'relative', marginBottom: 20 }}>
              <Lock size={14} style={{ position: 'absolute', left: 12, top: '50%', transform: 'translateY(-50%)', color: 'var(--text-muted)' }} />
              <input type="password" value={confirmPassword} onChange={e => setConfirmPassword(e.target.value)} onKeyDown={e => e.key === 'Enter' && submit()}
                style={{ ...inp, paddingLeft: 34 }} />
            </div>

            <button onClick={submit} disabled={loading} style={{ width: '100%', padding: 12, background: 'linear-gradient(135deg, #FBC02D, #F57F17)', color: 'var(--bg-app)', fontWeight: 700, fontFamily: 'Syne', fontSize: 14, border: 'none', borderRadius: 8, cursor: 'pointer' }}>
              {loading ? 'Setting up...' : 'Activate Account'}
            </button>
          </div>
        </div>
      </div>
    </>
  );
}

const lbl: React.CSSProperties = { display: 'block', marginBottom: 5, fontSize: 12, fontFamily: 'IBM Plex Mono', color: 'var(--text-secondary)' };
const inp: React.CSSProperties = { width: '100%', padding: '10px 12px', background: 'var(--bg-app)', border: '1px solid var(--border-input)', borderRadius: 8, color: 'var(--text-primary)', fontSize: 13, fontFamily: 'IBM Plex Sans', outline: 'none', boxSizing: 'border-box' };
