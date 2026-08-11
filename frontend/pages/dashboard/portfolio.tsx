import { Fragment, useEffect, useState } from 'react';
import DashboardLayout from '../../components/DashboardLayout';
import { Boxes, ChevronDown, ChevronUp } from 'lucide-react';
import { portfolio as portfolioApi } from '../../lib/api';
import { useLanguage } from '../../lib/LanguageContext';
import { useCurrency } from '../../lib/CurrencyContext';
import PlanLock, { hasPlanAccess } from '../../components/PlanLock';
import ExportButtons from '../../components/ExportButtons';

const GRADE_COLOR: Record<string, string> = { A: '#10B981', B: '#3B82F6', C: '#FBC02D', D: '#F97316', F: '#EF4444' };

export default function PortfolioDashboard() {
  const { t } = useLanguage();
  const { formatMoney: fmtMoney } = useCurrency();
  const [data, setData] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [expanded, setExpanded] = useState<string | null>(null);

  useEffect(() => {
    portfolioApi.dashboard().then(r => setData(r.data)).catch(() => {}).finally(() => setLoading(false));
  }, []);

  if (!hasPlanAccess('enterprise')) {
    return <PlanLock minTier="enterprise" titleKey="portfolio.title" />;
  }

  if (loading) {
    return (
      <DashboardLayout>
        <div style={{ color: 'var(--text-muted)', fontFamily: 'IBM Plex Mono' }}>{t('nav.loading')}</div>
      </DashboardLayout>
    );
  }

  if (!data) {
    return (
      <DashboardLayout>
        <div style={{ color: 'var(--text-muted)' }}>{t('portfolio.error')}</div>
      </DashboardLayout>
    );
  }

  const p = data.portfolio;

  const kpis = [
    { label: t('portfolio.totalProperties'), value: p.total_properties },
    { label: t('portfolio.totalUnits'), value: `${p.occupied_units}/${p.total_units}` },
    { label: t('portfolio.vacancyRate'), value: `${p.vacancy_rate}%` },
    { label: t('portfolio.revenueMrr'), value: fmtMoney(p.revenue_mrr) },
    { label: t('portfolio.cashFlow30d'), value: fmtMoney(p.cash_flow_30d), warn: p.cash_flow_30d < 0 },
    { label: t('portfolio.delinquent'), value: fmtMoney(p.delinquent_amount), warn: p.delinquent_amount > 0 },
    { label: t('portfolio.leaseExpirations'), value: `${p.leases_expiring_30} / ${p.leases_expiring_60} / ${p.leases_expiring_90}` },
    { label: t('portfolio.maintenanceBacklog'), value: p.maintenance_open, warn: p.maintenance_open > 0 },
    { label: t('portfolio.capex'), value: fmtMoney(p.capex_trailing_12mo) },
    { label: t('portfolio.avgHealthScore'), value: p.avg_health_score ?? '—' },
  ];

  return (
    <DashboardLayout>
      <div style={{ maxWidth: 1200 }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 6, flexWrap: 'wrap', gap: 12 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
            <Boxes size={24} color="#FBC02D" />
            <h1 style={{ fontFamily: 'Syne', fontWeight: 800, fontSize: 26, color: 'var(--text-primary)' }}>{t('portfolio.title')}</h1>
          </div>
          <ExportButtons onExport={(format) => portfolioApi.exportDashboard(format)} filenameBase="portfolio_dashboard" />
        </div>
        <p style={{ color: 'var(--text-muted)', fontSize: 14, marginBottom: 24 }}>{t('portfolio.subtitle')}</p>

        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(150px, 1fr))', gap: 12, marginBottom: 28 }}>
          {kpis.map(k => (
            <div key={k.label} style={{ background: 'var(--bg-surface)', border: '1px solid var(--border-strong)', borderRadius: 12, padding: '14px 16px' }}>
              <div style={{ fontSize: 10, fontFamily: 'IBM Plex Mono', color: 'var(--text-muted)', marginBottom: 6, letterSpacing: '0.5px' }}>{k.label.toUpperCase()}</div>
              <div style={{ fontSize: 19, fontFamily: 'IBM Plex Mono', fontWeight: 600, color: k.warn ? '#EF4444' : 'var(--text-primary)' }}>{k.value}</div>
            </div>
          ))}
        </div>

        <h2 style={{ fontFamily: 'Syne', fontWeight: 700, fontSize: 16, color: 'var(--text-primary)', marginBottom: 12 }}>{t('portfolio.byProperty')}</h2>
        <div style={{ background: 'var(--bg-surface)', border: '1px solid var(--border-strong)', borderRadius: 12, overflow: 'hidden' }}>
          <div style={{ overflowX: 'auto' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', minWidth: 780 }}>
              <thead>
                <tr style={{ borderBottom: '1px solid var(--border-strong)' }}>
                  {[t('portfolio.property'), t('portfolio.units'), t('portfolio.vacancyRate'), t('portfolio.revenueMrr'),
                    t('portfolio.cashFlow30d'), t('portfolio.delinquent'), t('portfolio.maintenanceBacklog'), t('portfolio.healthScore')].map(h => (
                    <th key={h} style={{ padding: '10px 14px', textAlign: 'left', fontSize: 10, fontFamily: 'IBM Plex Mono', color: 'var(--text-muted)', letterSpacing: '0.5px', whiteSpace: 'nowrap' }}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {data.properties.map((row: any) => (
                  <Fragment key={row.property_id}>
                    <tr onClick={() => setExpanded(expanded === row.property_id ? null : row.property_id)}
                      style={{ borderBottom: '1px solid var(--border-subtle)', cursor: 'pointer' }}>
                      <td style={{ padding: '12px 14px', fontSize: 13, color: 'var(--text-primary)', fontFamily: 'IBM Plex Sans', fontWeight: 600, whiteSpace: 'nowrap' }}>{row.property_name}</td>
                      <td style={{ padding: '12px 14px', fontSize: 12, fontFamily: 'IBM Plex Mono', color: 'var(--text-secondary)' }}>{row.occupied_units}/{row.total_units}</td>
                      <td style={{ padding: '12px 14px', fontSize: 12, fontFamily: 'IBM Plex Mono', color: 'var(--text-secondary)' }}>{row.vacancy_rate}%</td>
                      <td style={{ padding: '12px 14px', fontSize: 12, fontFamily: 'IBM Plex Mono', color: 'var(--text-primary)' }}>{fmtMoney(row.revenue_mrr)}</td>
                      <td style={{ padding: '12px 14px', fontSize: 12, fontFamily: 'IBM Plex Mono', color: row.cash_flow_30d < 0 ? '#EF4444' : '#10B981' }}>{fmtMoney(row.cash_flow_30d)}</td>
                      <td style={{ padding: '12px 14px', fontSize: 12, fontFamily: 'IBM Plex Mono', color: row.delinquent_amount > 0 ? '#EF4444' : '#64748B' }}>{fmtMoney(row.delinquent_amount)}</td>
                      <td style={{ padding: '12px 14px', fontSize: 12, fontFamily: 'IBM Plex Mono', color: row.maintenance_open > 0 ? '#F97316' : '#64748B' }}>{row.maintenance_open}</td>
                      <td style={{ padding: '12px 14px' }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                          <span style={{ display: 'inline-flex', alignItems: 'center', justifyContent: 'center', width: 24, height: 24, borderRadius: 6, background: `${GRADE_COLOR[row.health_grade]}20`, color: GRADE_COLOR[row.health_grade], fontSize: 12, fontWeight: 700, fontFamily: 'Syne' }}>
                            {row.health_grade}
                          </span>
                          <span style={{ fontSize: 12, fontFamily: 'IBM Plex Mono', color: 'var(--text-secondary)' }}>{row.health_score}</span>
                          {expanded === row.property_id ? <ChevronUp size={13} color="#64748B" /> : <ChevronDown size={13} color="#64748B" />}
                        </div>
                      </td>
                    </tr>
                    {expanded === row.property_id && (
                      <tr style={{ borderBottom: '1px solid var(--border-subtle)', background: 'rgba(255,255,255,0.02)' }}>
                        <td colSpan={8} style={{ padding: '14px' }}>
                          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: 12 }}>
                            {row.health_factors.map((f: any) => (
                              <div key={f.name}>
                                <div style={{ fontSize: 10, color: 'var(--text-muted)', fontFamily: 'IBM Plex Mono', textTransform: 'uppercase', marginBottom: 3 }}>{t(`portfolio.factor.${f.name}`)}</div>
                                <div style={{ fontSize: 13, color: 'var(--text-primary)', fontFamily: 'IBM Plex Mono', marginBottom: 2 }}>{f.score}/100</div>
                                <div style={{ fontSize: 11, color: 'var(--text-secondary)' }}>{f.detail}</div>
                              </div>
                            ))}
                          </div>
                          <div style={{ marginTop: 12, fontSize: 11, color: '#475569', display: 'flex', gap: 20 }}>
                            <span>{t('portfolio.leaseExpirations')}: {row.leases_expiring_30}/{row.leases_expiring_60}/{row.leases_expiring_90}</span>
                            <span>{t('portfolio.capex')}: {fmtMoney(row.capex_trailing_12mo)}</span>
                          </div>
                        </td>
                      </tr>
                    )}
                  </Fragment>
                ))}
              </tbody>
            </table>
          </div>
        </div>
        <p style={{ marginTop: 14, fontSize: 11, color: '#475569' }}>{t('portfolio.note')}</p>
      </div>
    </DashboardLayout>
  );
}
