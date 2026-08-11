import { useState } from 'react';
import { useRouter } from 'next/router';
import Link from 'next/link';
import Head from 'next/head';
import { Zap, Eye, EyeOff, CheckCircle } from 'lucide-react';
import toast from 'react-hot-toast';
import { auth } from '../lib/api';

export default function ResetPassword() {
  const router = useRouter();
  const { token } = router.query;
  const [password, setPassword] = useState('');
  const [confirm, setConfirm] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [done, setDone] = useState(false);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (password.length < 8) { toast.error('Password must be at least 8 characters'); return; }
    if (password !== confirm) { toast.error("Passwords don't match"); return; }
    if (typeof token !== 'string') { toast.error('Missing reset token — use the link from your email.'); return; }
    setLoading(true);
    try {
      await auth.resetPassword(token, password);
      setDone(true);
      setTimeout(() => router.push('/login'), 2000);
    } catch (err: any) {
      toast.error(err?.response?.data?.detail || 'This reset link is invalid or has expired.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <>
      <Head>
        <title>Set a New Password — PropAgent AI</title>
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
            <h1 style={{ fontFamily: 'Syne', fontWeight: 700, fontSize: 24, color: 'var(--text-primary)', marginBottom: 6 }}>Set a new password</h1>
          </div>

          <div style={{ background: 'var(--bg-surface)', border: '1px solid var(--border-strong)', borderRadius: 16, padding: 28 }}>
            {done ? (
              <div style={{ textAlign: 'center', padding: '8px 0' }}>
                <CheckCircle size={28} color="#10B981" style={{ marginBottom: 12 }} />
                <p style={{ color: 'var(--text-primary)', fontSize: 14, fontFamily: 'IBM Plex Sans' }}>Password updated — redirecting to sign in...</p>
              </div>
            ) : (
              <form onSubmit={submit}>
                <div style={{ marginBottom: 16 }}>
                  <label style={labelStyle}>New password</label>
                  <div style={{ position: 'relative' }}>
                    <input
                      type={showPassword ? 'text' : 'password'} required value={password}
                      onChange={e => setPassword(e.target.value)} placeholder="At least 8 characters"
                      style={{ ...inputStyle, paddingRight: 40 }}
                      spellCheck={false} autoCorrect="off" autoCapitalize="off" autoComplete="new-password" autoFocus
                    />
                    <button type="button" onClick={() => setShowPassword(p => !p)} aria-label="Toggle password visibility"
                      style={{ position: 'absolute', right: 10, top: '50%', transform: 'translateY(-50%)', background: 'none', border: 'none', padding: 4, cursor: 'pointer', color: 'var(--text-muted)', display: 'flex', alignItems: 'center' }}>
                      {showPassword ? <EyeOff size={16} /> : <Eye size={16} />}
                    </button>
                  </div>
                </div>
                <div style={{ marginBottom: 24 }}>
                  <label style={labelStyle}>Confirm password</label>
                  <input
                    type={showPassword ? 'text' : 'password'} required value={confirm}
                    onChange={e => setConfirm(e.target.value)} placeholder="••••••••"
                    style={inputStyle} spellCheck={false} autoCorrect="off" autoCapitalize="off" autoComplete="new-password"
                  />
                </div>
                <button type="submit" disabled={loading} style={btnStyle}>
                  {loading ? 'Updating...' : 'Update password'}
                </button>
              </form>
            )}
          </div>

          {!done && (
            <p style={{ textAlign: 'center', marginTop: 20, fontSize: 14, color: 'var(--text-muted)', fontFamily: 'IBM Plex Sans' }}>
              <Link href="/login" style={{ color: '#FBC02D', textDecoration: 'none', fontWeight: 600 }}>Back to sign in</Link>
            </p>
          )}
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
