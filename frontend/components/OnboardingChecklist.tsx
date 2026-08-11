import { useState } from 'react';
import { useRouter } from 'next/router';
import { CheckCircle2, Circle, X, Sparkles, ArrowRight } from 'lucide-react';

const DISMISS_KEY = 'onboardingChecklistDismissed';

export default function OnboardingChecklist({ stats }: { stats: any }) {
  const router = useRouter();
  const [dismissed, setDismissed] = useState(() => {
    if (typeof window === 'undefined') return false;
    return localStorage.getItem(DISMISS_KEY) === '1';
  });

  if (!stats || dismissed) return null;

  const steps = [
    { key: 'property', label: 'Add your first property', done: (stats.total_properties || 0) > 0, href: '/dashboard/properties' },
    { key: 'unit', label: 'Add a unit', done: (stats.total_units || 0) > 0, href: '/dashboard/properties' },
    { key: 'tenant', label: 'Add your first tenant', done: (stats.tenant_count || 0) > 0, href: '/dashboard/tenants' },
  ];

  // Real, data-driven -- once every step is genuinely done, this disappears
  // on its own without needing to be dismissed.
  const allDone = steps.every(s => s.done);
  if (allDone) return null;

  const doneCount = steps.filter(s => s.done).length;
  const nextStep = steps.find(s => !s.done);

  const dismiss = () => {
    localStorage.setItem(DISMISS_KEY, '1');
    setDismissed(true);
  };

  return (
    <div style={{
      background: 'linear-gradient(135deg, rgba(251,192,45,0.07), var(--bg-surface))',
      border: '1px solid rgba(251,192,45,0.25)', borderRadius: 12, padding: '18px 22px', marginBottom: 24,
    }}>
      <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 12, marginBottom: 14, flexWrap: 'wrap' }}>
        <div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 4 }}>
            <Sparkles size={15} color="#FBC02D" />
            <h2 style={{ fontFamily: 'Syne', fontWeight: 700, fontSize: 15, color: 'var(--text-primary)' }}>Get set up</h2>
            <span style={{ fontSize: 11, fontFamily: 'IBM Plex Mono', color: 'var(--text-muted)' }}>{doneCount}/{steps.length}</span>
          </div>
          <p style={{ fontSize: 12.5, color: 'var(--text-muted)', margin: 0 }}>A few steps to get your portfolio live and your AI workforce actually doing something.</p>
        </div>
        <button onClick={dismiss} aria-label="Dismiss" style={{ background: 'none', border: 'none', color: 'var(--text-muted)', cursor: 'pointer', padding: 4, flexShrink: 0 }}>
          <X size={15} />
        </button>
      </div>

      <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }}>
        {steps.map(s => (
          <div
            key={s.key}
            onClick={() => !s.done && router.push(s.href)}
            style={{
              display: 'flex', alignItems: 'center', gap: 8, padding: '9px 14px', borderRadius: 8,
              background: s.done ? 'rgba(16,185,129,0.08)' : 'var(--bg-app)',
              border: `1px solid ${s.done ? 'rgba(16,185,129,0.25)' : 'var(--border-strong)'}`,
              cursor: s.done ? 'default' : 'pointer', fontSize: 13, fontFamily: 'IBM Plex Sans',
              color: s.done ? '#10B981' : 'var(--text-secondary)',
            }}
          >
            {s.done ? <CheckCircle2 size={15} /> : <Circle size={15} />}
            <span style={{ textDecoration: s.done ? 'line-through' : 'none' }}>{s.label}</span>
          </div>
        ))}
        <div
          onClick={() => router.push('/dashboard/ai-workforce')}
          style={{
            display: 'flex', alignItems: 'center', gap: 6, padding: '9px 14px', borderRadius: 8,
            background: 'rgba(251,192,45,0.1)', border: '1px solid rgba(251,192,45,0.3)',
            cursor: 'pointer', fontSize: 13, fontFamily: 'Syne', fontWeight: 600, color: '#FBC02D',
          }}
        >
          Explore your AI Workforce <ArrowRight size={13} />
        </div>
      </div>

      {nextStep && (
        <p style={{ fontSize: 11.5, color: '#475569', marginTop: 12, marginBottom: 0 }}>
          Next: {nextStep.label.toLowerCase()} — everything else (AI leasing, maintenance, screening) starts working the moment you have real data to work with.
        </p>
      )}
    </div>
  );
}
