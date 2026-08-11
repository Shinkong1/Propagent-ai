import Link from 'next/link';
import { Lock } from 'lucide-react';
import { getUser } from '../lib/auth';
import { useLanguage } from '../lib/LanguageContext';
import DashboardLayout from './DashboardLayout';

export type PlanTier = 'professional' | 'enterprise';

export function hasPlanAccess(minTier: PlanTier): boolean {
  const plan = getUser()?.plan;
  if (minTier === 'professional') return plan === 'professional' || plan === 'enterprise';
  return plan === 'enterprise';
}

export default function PlanLock({ minTier, titleKey }: { minTier: PlanTier; titleKey: string }) {
  const { t } = useLanguage();
  const messageKey = minTier === 'professional' ? 'planGate.professionalRequired' : 'planGate.enterpriseRequired';

  return (
    <DashboardLayout>
      <div style={{ maxWidth: 640, margin: '80px auto', textAlign: 'center' }}>
        <div style={{ width: 56, height: 56, borderRadius: 14, background: 'rgba(var(--accent-rgb),0.1)', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 20px' }}>
          <Lock size={26} color="#FBC02D" />
        </div>
        <h1 style={{ fontFamily: 'Syne', fontWeight: 800, fontSize: 24, color: 'var(--text-primary)', marginBottom: 10 }}>{t(titleKey)}</h1>
        <p style={{ color: 'var(--text-muted)', fontSize: 14, marginBottom: 24 }}>{t(messageKey)}</p>
        <Link href="/pricing" style={{ display: 'inline-flex', alignItems: 'center', gap: 8, padding: '11px 22px', background: 'linear-gradient(135deg, #FBC02D, #F57F17)', color: 'var(--bg-app)', borderRadius: 8, fontWeight: 700, fontFamily: 'Syne', fontSize: 14, textDecoration: 'none' }}>
          {t('executive.upgradeCta')}
        </Link>
      </div>
    </DashboardLayout>
  );
}
