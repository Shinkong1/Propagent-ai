import { useState } from 'react';
import { useRouter } from 'next/router';
import Head from 'next/head';
import Link from 'next/link';
import { Zap, Mail, Lock } from 'lucide-react';
import toast from 'react-hot-toast';
import { tenantPortal } from '../../lib/tenantApi';
import { setTenantToken, setTenant } from '../../lib/tenantAuth';

export default function TenantLogin() {
  const router = useRouter();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);

  const submit = async () => {
    if (!email.trim() || !password) {
      toast.error('Enter your email and password');
      return;
    }
    setLoading(true);
    try {
      const res = await tenantPortal.login(email.trim(), password);
      setTenantToken(res.data.access_token);
      setTenant({ id: res.data.tenant_id, full_name: res.data.full_name });
      router.push('/portal');
    } catch (err: any) {
      toast.error(err?.response?.data?.detail || 'Login failed');
    } finally {
      setLoading(false);
    }
  };

  return (
    <>
      <Head><title>Tenant Portal — Sign In</title></Head>
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
            <h1 style={{ fontFamily: 'Syne', fontWeight: 700, fontSize: 20, color: 'var(--text-primary)', marginBottom: 20, textAlign: 'center' }}>Sign in</h1>

            <label style={lbl}>Email</label>
            <div style={{ position: 'relative', marginBottom: 14 }}>
              <Mail size={14} style={{ position: 'absolute', left: 12, top: '50%', transform: 'translateY(-50%)', color: '#64748B' }} />
              <input type="email" value={email} onChange={e => setEmail(e.target.value)} onKeyDown={e => e.key === 'Enter' && submit()}
                spellCheck={false} autoCorrect="off" autoCapitalize="off"
                style={{ ...inp, paddingLeft: 34 }} />
            </div>

            <label style={lbl}>Password</label>
            <div style={{ position: 'relative', marginBottom: 8 }}>
              <Lock size={14} style={{ position: 'absolute', left: 12, top: '50%', transform: 'translateY(-50%)', color: '#64748B' }} />
              <input type="password" value={password} onChange={e => setPassword(e.target.value)} onKeyDown={e => e.key === 'Enter' && submit()}
                style={{ ...inp, paddingLeft: 34 }} />
            </div>
            <div style={{ textAlign: 'right', marginBottom: 20 }}>
              <Link href="/portal/forgot-password" style={{ fontSize: 12, color: '#64748B', textDecoration: 'none' }}>Forgot password?</Link>
            </div>

            <button onClick={submit} disabled={loading} style={{ width: '100%', padding: 12, background: 'linear-gradient(135deg, #FBC02D, #F57F17)', color: 'var(--bg-app)', fontWeight: 700, fontFamily: 'Syne', fontSize: 14, border: 'none', borderRadius: 8, cursor: 'pointer' }}>
              {loading ? 'Signing in...' : 'Sign In'}
            </button>
          </div>

          <p style={{ textAlign: 'center', marginTop: 20, fontSize: 12, color: '#475569' }}>
            Property manager? <Link href="/login" style={{ color: '#FBC02D', textDecoration: 'none' }}>Sign in here</Link>
          </p>
        </div>
      </div>
    </>
  );
}

const lbl: React.CSSProperties = { display: 'block', marginBottom: 5, fontSize: 12, fontFamily: 'IBM Plex Mono', color: 'var(--text-secondary)' };
const inp: React.CSSProperties = { width: '100%', padding: '10px 12px', background: 'var(--bg-app)', border: '1px solid var(--border-input)', borderRadius: 8, color: 'var(--text-primary)', fontSize: 13, fontFamily: 'IBM Plex Sans', outline: 'none', boxSizing: 'border-box' };
