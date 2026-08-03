import { useEffect, useState } from 'react';
import DashboardLayout from '../../components/DashboardLayout';
import { TrendingUp, TrendingDown, Minus, ArrowUpCircle } from 'lucide-react';
import { investment as investmentApi } from '../../lib/api';
import { useLanguage } from '../../lib/LanguageContext';
import { useCurrency } from '../../lib/CurrencyContext';
import PlanLock, { hasPlanAccess } from '../../components/PlanLock';

const RECOMMENDATION_COLOR: Record<string, string> = {
  buy: '#10B981', hold: '#3B82F6', refinance: '#FBC02D', sell: '#EF4444',
};
const RECOMMENDATION_ICON: Record<string, any> = {
  buy: ArrowUpCircle, hold: Minus, refinance: TrendingUp, sell: TrendingDown,
};

export default function InvestmentAnalysis() {
  const { t } = useLanguage();
  const { formatMoney: fmtMoney } = useCurrency();
  const [data, setData] = useState<any>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    investmentApi.analysis().then(r => setData(r.data)).catch(() => {}).finally(() => setLoading(false));
  }, []);

  if (!hasPlanAccess('enterprise')) {
    return <PlanLock minTier="enterprise" titleKey="investment.title" />;
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
        <div style={{ color: '#64748B' }}>{t('investment.error')}</div>
      </DashboardLayout>
    );
  }

  const { portfolio, properties } = data;

  const kpis = [
    { label: t('investment.propertiesAnalyzed'), value: portfolio.properties_analyzed },
    { label: t('investment.avgCapRate'), value: portfolio.avg_cap_rate !== null ? `${portfolio.avg_cap_rate}%` : '—' },
    { label: t('investment.totalCashFlow'), value: fmtMoney(portfolio.total_annual_cash_flow), warn: portfolio.total_annual_cash_flow < 0 },
  ];

  return (
    <DashboardLayout>
      <div style={{ maxWidth: 1200 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 6 }}>
          <TrendingUp size={24} color="#FBC02D" />
          <h1 style={{ fontFamily: 'Syne', fontWeight: 800, fontSize: 26, color: 'var(--text-primary)' }}>{t('investment.title')}</h1>
        </div>
        <p style={{ color: '#64748B', fontSize: 14, marginBottom: 24 }}>{t('investment.subtitle')}</p>

        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 12, marginBottom: 20 }}>
          {kpis.map(k => (
            <div key={k.label} style={{ background: 'var(--bg-surface)', border: '1px solid var(--border-strong)', borderRadius: 12, padding: '14px 16px' }}>
              <div style={{ fontSize: 10, fontFamily: 'IBM Plex Mono', color: '#64748B', marginBottom: 6, letterSpacing: '0.5px' }}>{k.label.toUpperCase()}</div>
              <div style={{ fontSize: 22, fontFamily: 'IBM Plex Mono', fontWeight: 600, color: k.warn ? '#EF4444' : 'var(--text-primary)' }}>{k.value}</div>
            </div>
          ))}
        </div>

        <div style={{ display: 'flex', gap: 10, marginBottom: 24, flexWrap: 'wrap' }}>
          {(['buy', 'hold', 'refinance', 'sell'] as const).map(rec => (
            <div key={rec} style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '5px 10px', borderRadius: 6, background: `${RECOMMENDATION_COLOR[rec]}15` }}>
              <div style={{ width: 8, height: 8, borderRadius: '50%', background: RECOMMENDATION_COLOR[rec] }} />
              <span style={{ fontSize: 11, color: RECOMMENDATION_COLOR[rec], fontFamily: 'IBM Plex Mono' }}>
                {t(`investment.recommendation.${rec}`)}: {portfolio.by_recommendation[rec]}
              </span>
            </div>
          ))}
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(340px, 1fr))', gap: 16 }}>
          {properties.map((p: any) => {
            const Icon = p.recommendation ? RECOMMENDATION_ICON[p.recommendation] : null;
            return (
              <div key={p.property_id} style={{ background: 'var(--bg-surface)', border: '1px solid var(--border-strong)', borderRadius: 12, padding: 20 }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 14 }}>
                  <h3 style={{ fontFamily: 'Syne', fontWeight: 700, fontSize: 16, color: 'var(--text-primary)' }}>{p.property_name}</h3>
                  {p.recommendation && (
                    <span style={{ display: 'flex', alignItems: 'center', gap: 5, fontSize: 11, padding: '4px 10px', borderRadius: 6, background: `${RECOMMENDATION_COLOR[p.recommendation]}20`, color: RECOMMENDATION_COLOR[p.recommendation], fontFamily: 'IBM Plex Mono', fontWeight: 600, textTransform: 'uppercase' }}>
                      {Icon && <Icon size={12} />} {t(`investment.recommendation.${p.recommendation}`)}
                    </span>
                  )}
                </div>

                {p.insufficient_data ? (
                  <p style={{ fontSize: 12, color: '#64748B', lineHeight: 1.5 }}>{p.explanation}</p>
                ) : (
                  <>
                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12, marginBottom: 14 }}>
                      <div>
                        <div style={{ fontSize: 10, color: '#64748B', fontFamily: 'IBM Plex Mono', marginBottom: 3 }}>{t('investment.capRate')}</div>
                        <div style={{ fontSize: 16, color: 'var(--text-primary)', fontFamily: 'IBM Plex Mono', fontWeight: 600 }}>{p.cap_rate}%</div>
                      </div>
                      <div>
                        <div style={{ fontSize: 10, color: '#64748B', fontFamily: 'IBM Plex Mono', marginBottom: 3 }}>{t('investment.dscr')}</div>
                        <div style={{ fontSize: 16, color: p.dscr < 1 ? '#EF4444' : 'var(--text-primary)', fontFamily: 'IBM Plex Mono', fontWeight: 600 }}>{p.dscr}</div>
                      </div>
                      <div>
                        <div style={{ fontSize: 10, color: '#64748B', fontFamily: 'IBM Plex Mono', marginBottom: 3 }}>{t('investment.noi')}</div>
                        <div style={{ fontSize: 14, color: 'var(--text-secondary)', fontFamily: 'IBM Plex Mono' }}>{fmtMoney(p.noi)}</div>
                      </div>
                      <div>
                        <div style={{ fontSize: 10, color: '#64748B', fontFamily: 'IBM Plex Mono', marginBottom: 3 }}>{t('investment.cashFlow')}</div>
                        <div style={{ fontSize: 14, color: p.annual_cash_flow < 0 ? '#EF4444' : '#10B981', fontFamily: 'IBM Plex Mono' }}>{fmtMoney(p.annual_cash_flow)}</div>
                      </div>
                      <div>
                        <div style={{ fontSize: 10, color: '#64748B', fontFamily: 'IBM Plex Mono', marginBottom: 3 }}>{t('investment.roi')}</div>
                        <div style={{ fontSize: 14, color: p.roi < 0 ? '#EF4444' : 'var(--text-secondary)', fontFamily: 'IBM Plex Mono' }}>{p.roi}%</div>
                      </div>
                      <div>
                        <div style={{ fontSize: 10, color: '#64748B', fontFamily: 'IBM Plex Mono', marginBottom: 3 }}>{t('investment.purchasePrice')}</div>
                        <div style={{ fontSize: 14, color: 'var(--text-secondary)', fontFamily: 'IBM Plex Mono' }}>{fmtMoney(p.purchase_price)}</div>
                      </div>
                    </div>
                    <p style={{ fontSize: 12, color: 'var(--text-secondary)', lineHeight: 1.5, paddingTop: 12, borderTop: '1px solid var(--border-subtle)' }}>{p.explanation}</p>
                    {p.confidence && (
                      <div style={{ fontSize: 10, color: '#475569', marginTop: 6, fontFamily: 'IBM Plex Mono' }}>{t('investment.confidence')}: {Math.round(p.confidence * 100)}%</div>
                    )}
                  </>
                )}
              </div>
            );
          })}
        </div>
        <p style={{ marginTop: 20, fontSize: 11, color: '#475569' }}>{t('investment.note')}</p>
      </div>
    </DashboardLayout>
  );
}
