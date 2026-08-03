import { useEffect, useState } from 'react';
import DashboardLayout from '../../components/DashboardLayout';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts';
import { LineChart } from 'lucide-react';
import { pricingIntel as pricingApi } from '../../lib/api';
import { useLanguage } from '../../lib/LanguageContext';
import { useCurrency } from '../../lib/CurrencyContext';
import PlanLock, { hasPlanAccess } from '../../components/PlanLock';

const POSITION_COLOR: Record<string, string> = { overpriced: '#F97316', underpriced: '#EF4444', at_market: '#10B981' };
const REC_COLOR: Record<string, string> = { raise_rent: '#3B82F6', offer_concession: '#F97316', list_at_market: '#FBC02D' };

const chartStyle = { fontFamily: 'IBM Plex Mono', fontSize: 11, fill: '#64748B' };
const tooltipStyle = { background: 'var(--bg-surface)', border: '1px solid var(--border-strong)', borderRadius: 8, fontFamily: 'IBM Plex Sans', fontSize: 12 };

export default function PricingIntelligence() {
  const { t } = useLanguage();
  const { formatMoney: fmtMoney } = useCurrency();
  const [data, setData] = useState<any>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    pricingApi.analysis().then(r => setData(r.data)).catch(() => {}).finally(() => setLoading(false));
  }, []);

  if (!hasPlanAccess('enterprise')) {
    return <PlanLock minTier="enterprise" titleKey="pricingIntel.title" />;
  }

  if (loading) {
    return (
      <DashboardLayout>
        <div style={{ color: '#64748B', fontFamily: 'IBM Plex Mono' }}>{t('nav.loading')}</div>
      </DashboardLayout>
    );
  }

  if (!data) {
    return (
      <DashboardLayout>
        <div style={{ color: '#64748B' }}>{t('pricingIntel.error')}</div>
      </DashboardLayout>
    );
  }

  const { portfolio, units, seasonal_demand, seasonal_demand_sample_size } = data;
  const actionable = units.filter((u: any) => u.recommendation);

  const kpis = [
    { label: t('pricingIntel.totalUnits'), value: portfolio.total_units },
    { label: t('pricingIntel.vacantUnits'), value: portfolio.vacant_units },
    { label: t('pricingIntel.underpriced'), value: portfolio.underpriced_count, warn: portfolio.underpriced_count > 0 },
    { label: t('pricingIntel.overpriced'), value: portfolio.overpriced_count, warn: portfolio.overpriced_count > 0 },
    { label: t('pricingIntel.vacancyForecast90'), value: portfolio.vacancy_forecast.next_90_days },
  ];

  return (
    <DashboardLayout>
      <div style={{ maxWidth: 1200 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 6 }}>
          <LineChart size={24} color="#FBC02D" />
          <h1 style={{ fontFamily: 'Syne', fontWeight: 800, fontSize: 26, color: 'var(--text-primary)' }}>{t('pricingIntel.title')}</h1>
        </div>
        <p style={{ color: '#64748B', fontSize: 14, marginBottom: 24 }}>{t('pricingIntel.subtitle')}</p>

        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(5, 1fr)', gap: 12, marginBottom: 24 }}>
          {kpis.map(k => (
            <div key={k.label} style={{ background: 'var(--bg-surface)', border: '1px solid var(--border-strong)', borderRadius: 12, padding: '14px 16px' }}>
              <div style={{ fontSize: 10, fontFamily: 'IBM Plex Mono', color: '#64748B', marginBottom: 6, letterSpacing: '0.5px' }}>{k.label.toUpperCase()}</div>
              <div style={{ fontSize: 22, fontFamily: 'IBM Plex Mono', fontWeight: 600, color: k.warn ? '#EF4444' : 'var(--text-primary)' }}>{k.value}</div>
            </div>
          ))}
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: '1fr', gap: 20, marginBottom: 24 }}>
          <div style={{ background: 'var(--bg-surface)', border: '1px solid var(--border-strong)', borderRadius: 12, padding: 24 }}>
            <h3 style={{ fontFamily: 'Syne', fontWeight: 700, fontSize: 15, color: 'var(--text-primary)', marginBottom: 6 }}>{t('pricingIntel.seasonalDemand')}</h3>
            <p style={{ fontSize: 11, color: '#64748B', marginBottom: 16 }}>
              {seasonal_demand_sample_size > 0
                ? t('pricingIntel.seasonalNote').replace('{n}', seasonal_demand_sample_size)
                : t('pricingIntel.noLeaseHistory')}
            </p>
            <ResponsiveContainer width="100%" height={180}>
              <BarChart data={seasonal_demand} barSize={20}>
                <CartesianGrid strokeDasharray="3 3" stroke="var(--border-strong)" vertical={false} />
                <XAxis dataKey="month" tick={chartStyle} axisLine={false} tickLine={false} />
                <YAxis tick={chartStyle} axisLine={false} tickLine={false} allowDecimals={false} />
                <Tooltip contentStyle={tooltipStyle} formatter={(v: any) => [v, t('pricingIntel.leaseStarts')]} />
                <Bar dataKey="lease_starts" fill="#FBC02D" radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>

        <h2 style={{ fontFamily: 'Syne', fontWeight: 700, fontSize: 16, color: 'var(--text-primary)', marginBottom: 4 }}>{t('pricingIntel.recommendations')}</h2>
        <p style={{ fontSize: 12, color: '#64748B', marginBottom: 12 }}>{t('pricingIntel.recommendationsSubtitle')}</p>

        {actionable.length === 0 ? (
          <div style={{ textAlign: 'center', padding: '40px', color: '#475569', background: 'var(--bg-surface)', border: '1px solid var(--border-strong)', borderRadius: 12, marginBottom: 20 }}>
            {t('pricingIntel.noActionNeeded')}
          </div>
        ) : (
          <div style={{ display: 'grid', gap: 10, marginBottom: 24 }}>
            {actionable.map((u: any) => (
              <div key={u.unit_id} style={{ background: 'var(--bg-surface)', border: '1px solid var(--border-strong)', borderRadius: 10, padding: 16, display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 16 }}>
                <div style={{ flex: 1 }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 4 }}>
                    <span style={{ fontFamily: 'Syne', fontWeight: 700, fontSize: 14, color: 'var(--text-primary)' }}>{u.property_name} · {u.unit_number}</span>
                    <span style={{ fontSize: 10, padding: '2px 7px', borderRadius: 4, background: `${REC_COLOR[u.recommendation]}20`, color: REC_COLOR[u.recommendation], fontFamily: 'IBM Plex Mono' }}>
                      {t(`pricingIntel.action.${u.recommendation}`)}
                    </span>
                  </div>
                  <p style={{ fontSize: 12, color: 'var(--text-secondary)', lineHeight: 1.5 }}>{u.explanation}</p>
                  <div style={{ fontSize: 10, color: '#475569', marginTop: 4, fontFamily: 'IBM Plex Mono' }}>{t('investment.confidence')}: {Math.round(u.confidence * 100)}%</div>
                </div>
                <div style={{ textAlign: 'right', flexShrink: 0 }}>
                  <div style={{ fontSize: 18, fontFamily: 'IBM Plex Mono', fontWeight: 600, color: 'var(--text-primary)' }}>{fmtMoney(u.monthly_rent)}</div>
                  <div style={{ fontSize: 11, color: '#64748B' }}>{t('pricingIntel.cohortAvg')}: {fmtMoney(u.cohort_avg)}</div>
                </div>
              </div>
            ))}
          </div>
        )}

        <h2 style={{ fontFamily: 'Syne', fontWeight: 700, fontSize: 16, color: 'var(--text-primary)', marginBottom: 12 }}>{t('pricingIntel.allUnits')}</h2>
        <div style={{ background: 'var(--bg-surface)', border: '1px solid var(--border-strong)', borderRadius: 12, overflow: 'hidden' }}>
          <div style={{ overflowX: 'auto' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', minWidth: 760 }}>
              <thead>
                <tr style={{ borderBottom: '1px solid var(--border-strong)' }}>
                  {[t('portfolio.property'), t('pricingIntel.unit'), t('pricingIntel.bedrooms'), t('pricingIntel.rent'), t('pricingIntel.cohortAvg'), t('pricingIntel.deviation'), t('pricingIntel.position')].map(h => (
                    <th key={h} style={{ padding: '10px 14px', textAlign: 'left', fontSize: 10, fontFamily: 'IBM Plex Mono', color: '#64748B', letterSpacing: '0.5px', whiteSpace: 'nowrap' }}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {units.map((u: any) => (
                  <tr key={u.unit_id} style={{ borderBottom: '1px solid var(--border-subtle)' }}>
                    <td style={{ padding: '10px 14px', fontSize: 12, color: 'var(--text-primary)', whiteSpace: 'nowrap' }}>{u.property_name}</td>
                    <td style={{ padding: '10px 14px', fontSize: 12, color: 'var(--text-secondary)' }}>{u.unit_number}</td>
                    <td style={{ padding: '10px 14px', fontSize: 12, color: 'var(--text-secondary)' }}>{u.bedrooms}</td>
                    <td style={{ padding: '10px 14px', fontSize: 12, fontFamily: 'IBM Plex Mono', color: 'var(--text-primary)' }}>{fmtMoney(u.monthly_rent)}</td>
                    <td style={{ padding: '10px 14px', fontSize: 12, fontFamily: 'IBM Plex Mono', color: '#64748B' }}>{u.cohort_avg ? fmtMoney(u.cohort_avg) : '—'}</td>
                    <td style={{ padding: '10px 14px', fontSize: 12, fontFamily: 'IBM Plex Mono', color: u.deviation_pct > 0 ? '#10B981' : u.deviation_pct < 0 ? '#EF4444' : 'var(--text-secondary)' }}>
                      {u.deviation_pct !== null ? `${u.deviation_pct > 0 ? '+' : ''}${u.deviation_pct}%` : '—'}
                    </td>
                    <td style={{ padding: '10px 14px' }}>
                      <span style={{ fontSize: 10, padding: '2px 8px', borderRadius: 4, background: `${POSITION_COLOR[u.position]}20`, color: POSITION_COLOR[u.position], fontFamily: 'IBM Plex Mono' }}>
                        {t(`pricingIntel.positionLabel.${u.position}`)}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
        <p style={{ marginTop: 20, fontSize: 11, color: '#475569' }}>{t('pricingIntel.note')}</p>
      </div>
    </DashboardLayout>
  );
}
