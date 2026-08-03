import { useEffect, useState } from 'react';
import DashboardLayout from '../../components/DashboardLayout';
import PlanLock, { hasPlanAccess } from '../../components/PlanLock';
import { Radar, Wrench, UserX } from 'lucide-react';
import { predictive as predictiveApi } from '../../lib/api';
import { useLanguage } from '../../lib/LanguageContext';

interface MaintenanceSignal {
  property_id: string; property_name: string; category: string;
  risk_level: string; confidence: number; occurrences_last_year: number;
  most_recent_date: string; explanation: string;
}
interface RenewalSignal {
  lease_id: string; tenant_name: string; unit_number: string | null; property_name: string | null;
  days_until_expiry: number; risk_level: string; risk_score: number; confidence: number; explanation: string;
}

const RISK_COLOR: Record<string, string> = { high: '#EF4444', medium: '#FBC02D', low: '#94A3B8' };

export default function PredictiveInsights() {
  const { t } = useLanguage();
  const [maintenance, setMaintenance] = useState<MaintenanceSignal[]>([]);
  const [renewal, setRenewal] = useState<RenewalSignal[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!hasPlanAccess('enterprise')) return;
    Promise.all([predictiveApi.maintenanceRisk(), predictiveApi.renewalRisk()])
      .then(([m, r]) => { setMaintenance(m.data.signals); setRenewal(r.data.signals); })
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  if (!hasPlanAccess('enterprise')) {
    return <PlanLock minTier="enterprise" titleKey="predictive.title" />;
  }

  return (
    <DashboardLayout>
      <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 6 }}>
        <Radar size={26} color="#FBC02D" />
        <h1 style={{ fontFamily: 'Syne', fontWeight: 800, fontSize: 28, color: 'var(--text-primary)' }}>{t('predictive.title')}</h1>
      </div>
      <p style={{ color: '#64748B', fontSize: 14, marginBottom: 28 }}>{t('predictive.subtitle')}</p>

      {loading ? (
        <div style={{ color: '#64748B', fontFamily: 'IBM Plex Mono' }}>{t('nav.loading')}</div>
      ) : (
        <>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 14 }}>
            <Wrench size={16} color="var(--text-secondary)" />
            <h2 style={{ fontFamily: 'Syne', fontWeight: 700, fontSize: 16, color: 'var(--text-primary)' }}>{t('predictive.maintenanceTitle')}</h2>
          </div>
          {maintenance.length === 0 ? (
            <div style={{ padding: 24, textAlign: 'center', color: '#64748B', background: 'var(--bg-surface)', border: '1px solid var(--border-strong)', borderRadius: 12, marginBottom: 28 }}>
              {t('predictive.maintenanceEmpty')}
            </div>
          ) : (
            <div style={{ display: 'grid', gap: 10, marginBottom: 28 }}>
              {maintenance.map((s, i) => (
                <div key={i} style={{ background: 'var(--bg-surface)', border: '1px solid var(--border-strong)', borderRadius: 12, padding: 16 }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 8 }}>
                    <div>
                      <div style={{ fontFamily: 'Syne', fontWeight: 700, fontSize: 14, color: 'var(--text-primary)' }}>
                        {s.property_name} — {s.category}
                      </div>
                      <div style={{ fontSize: 11, color: '#64748B', fontFamily: 'IBM Plex Mono', marginTop: 2 }}>
                        {t('predictive.confidence')}: {Math.round(s.confidence * 100)}%
                      </div>
                    </div>
                    <span style={{
                      fontSize: 11, padding: '4px 10px', borderRadius: 6, fontFamily: 'IBM Plex Mono',
                      background: `${RISK_COLOR[s.risk_level]}22`, color: RISK_COLOR[s.risk_level],
                    }}>
                      {t(`predictive.risk.${s.risk_level}`)}
                    </span>
                  </div>
                  <p style={{ fontSize: 13, color: 'var(--text-secondary)', lineHeight: 1.5 }}>{s.explanation}</p>
                </div>
              ))}
            </div>
          )}

          <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 14 }}>
            <UserX size={16} color="var(--text-secondary)" />
            <h2 style={{ fontFamily: 'Syne', fontWeight: 700, fontSize: 16, color: 'var(--text-primary)' }}>{t('predictive.renewalTitle')}</h2>
          </div>
          {renewal.length === 0 ? (
            <div style={{ padding: 24, textAlign: 'center', color: '#64748B', background: 'var(--bg-surface)', border: '1px solid var(--border-strong)', borderRadius: 12 }}>
              {t('predictive.renewalEmpty')}
            </div>
          ) : (
            <div style={{ display: 'grid', gap: 10 }}>
              {renewal.map((s, i) => (
                <div key={i} style={{ background: 'var(--bg-surface)', border: '1px solid var(--border-strong)', borderRadius: 12, padding: 16 }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 8 }}>
                    <div>
                      <div style={{ fontFamily: 'Syne', fontWeight: 700, fontSize: 14, color: 'var(--text-primary)' }}>
                        {s.tenant_name} — {s.property_name} {s.unit_number ? `#${s.unit_number}` : ''}
                      </div>
                      <div style={{ fontSize: 11, color: '#64748B', fontFamily: 'IBM Plex Mono', marginTop: 2 }}>
                        {t('predictive.confidence')}: {Math.round(s.confidence * 100)}% · {t('predictive.expiresIn').replace('{n}', String(s.days_until_expiry))}
                      </div>
                    </div>
                    <span style={{
                      fontSize: 11, padding: '4px 10px', borderRadius: 6, fontFamily: 'IBM Plex Mono',
                      background: `${RISK_COLOR[s.risk_level]}22`, color: RISK_COLOR[s.risk_level],
                    }}>
                      {t(`predictive.risk.${s.risk_level}`)}
                    </span>
                  </div>
                  <p style={{ fontSize: 13, color: 'var(--text-secondary)', lineHeight: 1.5 }}>{s.explanation}</p>
                </div>
              ))}
            </div>
          )}
        </>
      )}
    </DashboardLayout>
  );
}
