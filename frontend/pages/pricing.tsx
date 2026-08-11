import Head from 'next/head';
import Link from 'next/link';
import { Zap, Check } from 'lucide-react';
import { useState } from 'react';
import { billing } from '../lib/api';
import { isAuthenticated } from '../lib/auth';
import { useRouter } from 'next/router';
import toast from 'react-hot-toast';
import PublicFooter from '../components/PublicFooter';
import SalesChatWidget from '../components/SalesChatWidget';

const PLANS = [
  {
    name: 'Starter', key: 'starter', price: 49, popular: false,
    features: ['3 properties', '25 units', 'AI chat support', 'Maintenance tracking', 'Document uploads & search', 'Rental inquiry & prospect tracking', '100 AI calls/mo', 'Email support'],
  },
  {
    name: 'Professional', key: 'professional', price: 149, popular: true,
    features: ['15 properties', '150 units', 'Voice AI call center', 'Executive AI Assistant', 'Lease & notice generation', 'Inspection AI (photo damage detection)', 'Compliance, Collections & Communications agents', '1,000 AI calls/mo', 'Priority support'],
  },
  {
    name: 'Enterprise', key: 'enterprise', price: 499, popular: false,
    features: ['Unlimited properties', 'Unlimited units', 'Portfolio Dashboard', 'Investment Analysis', 'Pricing Intelligence', 'Full AI autonomy', 'Custom integrations', 'Dedicated CSM', 'Unlimited AI calls', 'SLA guarantee'],
  },
];

export default function Pricing() {
  const router = useRouter();
  const [loading, setLoading] = useState<string | null>(null);

  const handleSelect = async (plan: string) => {
    if (!isAuthenticated()) { router.push('/signup'); return; }
    setLoading(plan);
    try {
      const res = await billing.checkout(plan);
      window.location.href = res.data.url;
    } catch {
      toast.error('Failed to start checkout');
    } finally {
      setLoading(null);
    }
  };

  return (
    <>
      <Head>
        <title>Pricing — PropAgent AI</title>
        <meta name="description" content="Simple, transparent pricing for AI-powered property management. Starter, Professional, and Enterprise plans." />
      </Head>
      <div style={{ minHeight: '100vh', background: 'var(--bg-app)', color: '#E2E8F0' }}>
        <nav style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '20px 48px', borderBottom: '1px solid var(--border-subtle)' }}>
          <Link href="/" style={{ display: 'flex', alignItems: 'center', gap: 10, textDecoration: 'none' }}>
            <div style={{ width: 32, height: 32, borderRadius: 8, background: 'linear-gradient(135deg, #FBC02D, #F57F17)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              <Zap size={16} color="var(--bg-app)" strokeWidth={2.5} />
            </div>
            <span style={{ fontFamily: 'Syne', fontWeight: 800, fontSize: 18, color: 'var(--text-primary)' }}>PropAgent AI</span>
          </Link>
          <Link href={isAuthenticated() ? '/dashboard' : '/login'} style={{ color: 'var(--text-secondary)', textDecoration: 'none', fontSize: 14 }}>
            {isAuthenticated() ? 'Dashboard' : 'Sign in'}
          </Link>
        </nav>

        <div style={{ maxWidth: 1000, margin: '0 auto', padding: '72px 24px' }}>
          {router.query.trialEnded && (
            <div style={{
              background: 'rgba(239,68,68,0.1)', border: '1px solid rgba(239,68,68,0.3)', borderRadius: 10,
              padding: '14px 18px', marginBottom: 32, textAlign: 'center', fontSize: 14, color: '#EF4444', fontFamily: 'IBM Plex Sans',
            }}>
              Your 14-day free trial has ended. Choose a plan below to keep using PropAgent.
            </div>
          )}
          <div style={{ textAlign: 'center', marginBottom: 56 }}>
            <h1 style={{ fontFamily: 'Syne', fontWeight: 800, fontSize: 44, color: 'var(--text-primary)', marginBottom: 14 }}>Simple Pricing</h1>
            <p style={{ color: 'var(--text-muted)', fontSize: 17, fontFamily: 'IBM Plex Sans' }}>Scale your property management AI at any portfolio size</p>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: 20 }}>
            {PLANS.map(plan => (
              <div key={plan.key} style={{
                background: 'var(--bg-surface)',
                border: `1px solid ${plan.popular ? '#FBC02D' : 'var(--border-strong)'}`,
                borderRadius: 16, padding: 28,
                position: 'relative',
                boxShadow: plan.popular ? '0 0 40px rgba(var(--accent-rgb),0.12)' : 'none',
              }}>
                {plan.popular && (
                  <div style={{ position: 'absolute', top: -12, left: '50%', transform: 'translateX(-50%)', background: 'linear-gradient(135deg, #FBC02D, #F57F17)', color: 'var(--bg-app)', fontSize: 11, fontWeight: 700, fontFamily: 'IBM Plex Mono', padding: '4px 14px', borderRadius: 100, letterSpacing: '1px', whiteSpace: 'nowrap' }}>
                    MOST POPULAR
                  </div>
                )}
                <h2 style={{ fontFamily: 'Syne', fontWeight: 700, fontSize: 20, color: 'var(--text-primary)', marginBottom: 4 }}>{plan.name}</h2>
                <div style={{ display: 'flex', alignItems: 'baseline', gap: 4, marginBottom: 20 }}>
                  <span style={{ fontFamily: 'IBM Plex Mono', fontSize: 38, fontWeight: 600, color: plan.popular ? '#FBC02D' : 'var(--text-primary)' }}>${plan.price}</span>
                  <span style={{ color: 'var(--text-muted)', fontSize: 14 }}>/mo</span>
                </div>
                <div style={{ marginBottom: 24 }}>
                  {plan.features.map(f => (
                    <div key={f} style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 10 }}>
                      <Check size={14} color={plan.popular ? '#FBC02D' : '#10B981'} strokeWidth={2.5} />
                      <span style={{ fontSize: 13, color: 'var(--text-secondary)', fontFamily: 'IBM Plex Sans' }}>{f}</span>
                    </div>
                  ))}
                </div>
                <button onClick={() => handleSelect(plan.key)} disabled={loading === plan.key} style={{
                  width: '100%', padding: '12px', borderRadius: 8, cursor: 'pointer',
                  background: plan.popular ? 'linear-gradient(135deg, #FBC02D, #F57F17)' : 'transparent',
                  color: plan.popular ? 'var(--bg-app)' : '#E2E8F0',
                  border: plan.popular ? 'none' : '1px solid var(--border-strong)',
                  fontWeight: 700, fontFamily: 'Syne', fontSize: 14,
                } as any}>
                  {loading === plan.key ? 'Loading...' : 'Get Started'}
                </button>
              </div>
            ))}
          </div>

          <p style={{ textAlign: 'center', marginTop: 32, color: '#475569', fontSize: 13, fontFamily: 'IBM Plex Sans' }}>
            All plans include 14-day free trial · Cancel anytime · No setup fees
          </p>

          <p style={{ textAlign: 'center', marginTop: 20, fontSize: 14, fontFamily: 'IBM Plex Sans' }}>
            <Link href="/compare" style={{ color: '#FBC02D', textDecoration: 'none', fontWeight: 600 }}>
              See how PropAgent AI compares to traditional property management software →
            </Link>
          </p>
        </div>
        <PublicFooter />
      </div>
      <SalesChatWidget />
    </>
  );
}
