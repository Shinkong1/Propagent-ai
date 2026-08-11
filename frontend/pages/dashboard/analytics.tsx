import { useEffect, useState } from 'react';
import DashboardLayout from '../../components/DashboardLayout';
import { BarChart, Bar, LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, PieChart, Pie, Cell } from 'recharts';
import { portfolio as portfolioApi, accounting, maintenance as maintenanceApi, leads as leadsApi } from '../../lib/api';
import { getUser } from '../../lib/auth';
import { useLanguage } from '../../lib/LanguageContext';
import { useCurrency } from '../../lib/CurrencyContext';
import { useSidebar } from '../../lib/SidebarContext';
import { parseLocalDate } from '../../lib/date';

const OPEN_STATUSES = ['open', 'in_progress', 'waiting_vendor', 'scheduled'];

const COLORS = ['#3B82F6', '#FBC02D', '#10B981', '#8B5CF6', '#F97316', '#EF4444', '#06B6D4', '#A855F7', '#84CC16'];

const chartStyle = { fontFamily: 'IBM Plex Mono', fontSize: 11, fill: '#64748B' };
const tooltipStyle = { background: 'var(--bg-surface)', border: '1px solid var(--border-strong)', borderRadius: 8, fontFamily: 'IBM Plex Sans', fontSize: 12 };

function labelize(s: string) {
  return s.replace(/_/g, ' ').replace(/\b\w/g, c => c.toUpperCase());
}

function lastSixMonths() {
  const now = new Date();
  return Array.from({ length: 6 }, (_, i) => {
    const d = new Date(now.getFullYear(), now.getMonth() - (5 - i), 1);
    return { key: `${d.getFullYear()}-${d.getMonth()}`, label: d.toLocaleString('en-US', { month: 'short' }) };
  });
}

function buildAnalytics(portfolioData: any, payments: any[], tickets: any[], leads: any[]) {
  const months = lastSixMonths();

  const revenueByMonth = new Map(months.map(m => [m.key, 0]));
  payments.forEach(p => {
    if (p.status !== 'paid' || !p.paid_date) return;
    const d = parseLocalDate(p.paid_date);
    const key = `${d.getFullYear()}-${d.getMonth()}`;
    if (revenueByMonth.has(key)) revenueByMonth.set(key, revenueByMonth.get(key)! + p.amount);
  });
  const REVENUE = months.map(m => ({ month: m.label, revenue: Math.round(revenueByMonth.get(m.key)!) }));

  const ticketsByMonth = new Map(months.map(m => [m.key, { open: 0, resolved: 0 }]));
  tickets.forEach(t => {
    const d = new Date(t.created_at);
    const key = `${d.getFullYear()}-${d.getMonth()}`;
    const bucket = ticketsByMonth.get(key);
    if (!bucket) return;
    if (t.status === 'completed') bucket.resolved += 1;
    else if (OPEN_STATUSES.includes(t.status)) bucket.open += 1;
  });
  const TICKETS = months.map(m => ({ month: m.label, ...ticketsByMonth.get(m.key)! }));

  const catCounts: Record<string, number> = {};
  tickets.forEach(t => { catCounts[t.category] = (catCounts[t.category] || 0) + 1; });
  const totalTickets = tickets.length || 1;
  const CATEGORIES = Object.entries(catCounts)
    .map(([name, count]) => ({ name: labelize(name), value: Math.round((count / totalTickets) * 100) }))
    .sort((a, b) => b.value - a.value);

  const p = portfolioData.portfolio;
  const occupancyPct = p.total_units ? Math.round((p.occupied_units / p.total_units) * 1000) / 10 : 0;
  const collectionRate = p.revenue_mrr ? Math.round((p.collected_30d / p.revenue_mrr) * 1000) / 10 : 0;

  const openTickets = tickets.filter(t => OPEN_STATUSES.includes(t.status));
  const avgOpenAgeDays = openTickets.length
    ? Math.round((openTickets.reduce((sum, t) => sum + (Date.now() - new Date(t.created_at).getTime()), 0) / openTickets.length / 86400000) * 10) / 10
    : 0;

  const closedWon = leads.filter(l => l.status === 'closed_won').length;
  const leadConversionRate = leads.length ? Math.round((closedWon / leads.length) * 1000) / 10 : 0;

  const stats = {
    occupancyPct, occupiedUnits: p.occupied_units, totalUnits: p.total_units,
    collectionRate, collected30d: p.collected_30d, revenueMrr: p.revenue_mrr,
    avgOpenAgeDays, openTicketsCount: openTickets.length,
    leadConversionRate, closedWon, totalLeads: leads.length,
  };

  return { REVENUE, TICKETS, CATEGORIES, stats };
}

export default function Analytics() {
  const { t } = useLanguage();
  const { isMobile } = useSidebar();
  const { formatMoney: fmtMoney, symbol } = useCurrency();
  const [data, setData] = useState<ReturnType<typeof buildAnalytics> | null>(null);
  const [loading, setLoading] = useState(true);
  const [isMaster, setIsMaster] = useState(false);

  useEffect(() => { setIsMaster(!!getUser()?.is_master); }, []);

  useEffect(() => {
    // Lead CRM (and its conversion-rate stat below) is PropAgent AI's own
    // sales pipeline — owner-only. Don't even request it for a regular
    // subscriber, and don't let its absence break the rest of this page.
    const isMaster = !!getUser()?.is_master;
    Promise.all([
      portfolioApi.dashboard(),
      accounting.listPayments(),
      maintenanceApi.list(),
      isMaster ? leadsApi.list() : Promise.resolve({ data: [] }),
    ])
      .then(([portfolioRes, paymentsRes, ticketsRes, leadsRes]) => {
        setData(buildAnalytics(portfolioRes.data, paymentsRes.data, ticketsRes.data, leadsRes.data));
      })
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

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
        <div style={{ color: 'var(--text-muted)' }}>{t('analytics.error')}</div>
      </DashboardLayout>
    );
  }

  const { REVENUE, TICKETS, CATEGORIES, stats } = data;

  const kpis = [
    { label: t('analytics.avgOccupancy'), value: `${stats.occupancyPct}%`, sub: `${stats.occupiedUnits}/${stats.totalUnits} ${t('portfolio.units').toLowerCase()}` },
    { label: t('analytics.collectionRate'), value: `${stats.collectionRate}%`, sub: `${fmtMoney(stats.collected30d)} ${t('analytics.of')} ${fmtMoney(stats.revenueMrr)}/mo` },
    { label: t('analytics.avgOpenTicketAge'), value: `${stats.avgOpenAgeDays}d`, sub: `${stats.openTicketsCount} ${t('analytics.openTickets')}` },
    // Lead conversion is PropAgent's own sales pipeline — owner-only, see above.
    ...(isMaster ? [{ label: t('analytics.leadConversionRate'), value: `${stats.leadConversionRate}%`, sub: `${stats.closedWon}/${stats.totalLeads} ${t('analytics.leads')}` }] : []),
  ];

  return (
    <DashboardLayout>
      <div style={{ maxWidth: 1100 }}>
        <div style={{ marginBottom: 28 }}>
          <h1 style={{ fontFamily: 'Syne', fontWeight: 800, fontSize: 28, color: 'var(--text-primary)', marginBottom: 4 }}>{t('analytics.title')}</h1>
          <p style={{ color: 'var(--text-muted)', fontSize: 14 }}>{t('analytics.subtitle')}</p>
        </div>

        {/* KPIs */}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: 14, marginBottom: 28 }}>
          {kpis.map(({ label, value, sub }) => (
            <div key={label} style={{ background: 'var(--bg-surface)', border: '1px solid var(--border-strong)', borderRadius: 12, padding: '18px 20px' }}>
              <div style={{ fontSize: 11, fontFamily: 'IBM Plex Mono', color: 'var(--text-muted)', marginBottom: 8, letterSpacing: '0.5px' }}>{label.toUpperCase()}</div>
              <div style={{ fontSize: 24, fontFamily: 'IBM Plex Mono', fontWeight: 600, color: 'var(--text-primary)', marginBottom: 4 }}>{value}</div>
              <div style={{ fontSize: 11, fontFamily: 'IBM Plex Mono', color: 'var(--text-muted)' }}>{sub}</div>
            </div>
          ))}
        </div>

        {/* Charts */}
        <div style={{ display: 'grid', gridTemplateColumns: isMobile ? '1fr' : '2fr 1fr', gap: 20, marginBottom: 20 }}>
          {/* Revenue Chart */}
          <div style={{ background: 'var(--bg-surface)', border: '1px solid var(--border-strong)', borderRadius: 12, padding: 24 }}>
            <h3 style={{ fontFamily: 'Syne', fontWeight: 700, fontSize: 15, color: 'var(--text-primary)', marginBottom: 20 }}>{t('analytics.monthlyRevenue')}</h3>
            <ResponsiveContainer width="100%" height={220}>
              <BarChart data={REVENUE} barSize={28}>
                <CartesianGrid strokeDasharray="3 3" stroke="var(--border-strong)" vertical={false} />
                <XAxis dataKey="month" tick={chartStyle} axisLine={false} tickLine={false} />
                <YAxis tick={chartStyle} axisLine={false} tickLine={false} tickFormatter={v => `${symbol}${(v / 1000).toFixed(0)}k`} />
                <Tooltip contentStyle={tooltipStyle} formatter={(v: any) => [fmtMoney(Number(v)), t('analytics.monthlyRevenue')]} />
                <Bar dataKey="revenue" fill="url(#revenueGrad)" radius={[4, 4, 0, 0]} />
                <defs>
                  <linearGradient id="revenueGrad" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor="#FBC02D" />
                    <stop offset="100%" stopColor="#F57F17" stopOpacity={0.6} />
                  </linearGradient>
                </defs>
              </BarChart>
            </ResponsiveContainer>
          </div>

          {/* Category Pie */}
          <div style={{ background: 'var(--bg-surface)', border: '1px solid var(--border-strong)', borderRadius: 12, padding: 24 }}>
            <h3 style={{ fontFamily: 'Syne', fontWeight: 700, fontSize: 15, color: 'var(--text-primary)', marginBottom: 20 }}>{t('analytics.ticketCategories')}</h3>
            {CATEGORIES.length === 0 ? (
              <div style={{ color: '#475569', fontSize: 12, padding: '30px 0', textAlign: 'center' }}>{t('analytics.noTickets')}</div>
            ) : (
              <>
                <ResponsiveContainer width="100%" height={160}>
                  <PieChart>
                    <Pie data={CATEGORIES} dataKey="value" cx="50%" cy="50%" outerRadius={70} innerRadius={45}>
                      {CATEGORIES.map((_, i) => <Cell key={i} fill={COLORS[i % COLORS.length]} />)}
                    </Pie>
                    <Tooltip contentStyle={tooltipStyle} />
                  </PieChart>
                </ResponsiveContainer>
                <div style={{ marginTop: 12 }}>
                  {CATEGORIES.map(({ name, value }, i) => (
                    <div key={name} style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 6 }}>
                      <div style={{ width: 8, height: 8, borderRadius: 2, background: COLORS[i % COLORS.length] }} />
                      <span style={{ fontSize: 11, color: 'var(--text-secondary)', fontFamily: 'IBM Plex Sans', flex: 1 }}>{name}</span>
                      <span style={{ fontSize: 11, fontFamily: 'IBM Plex Mono', color: 'var(--text-primary)' }}>{value}%</span>
                    </div>
                  ))}
                </div>
              </>
            )}
          </div>
        </div>

        {/* Ticket Trends */}
        <div style={{ background: 'var(--bg-surface)', border: '1px solid var(--border-strong)', borderRadius: 12, padding: 24 }}>
          <h3 style={{ fontFamily: 'Syne', fontWeight: 700, fontSize: 15, color: 'var(--text-primary)', marginBottom: 20 }}>{t('analytics.ticketTrends')}</h3>
          <ResponsiveContainer width="100%" height={200}>
            <LineChart data={TICKETS}>
              <CartesianGrid strokeDasharray="3 3" stroke="var(--border-strong)" />
              <XAxis dataKey="month" tick={chartStyle} axisLine={false} tickLine={false} />
              <YAxis tick={chartStyle} axisLine={false} tickLine={false} />
              <Tooltip contentStyle={tooltipStyle} />
              <Line type="monotone" dataKey="open" stroke="#EF4444" strokeWidth={2} dot={false} />
              <Line type="monotone" dataKey="resolved" stroke="#10B981" strokeWidth={2} dot={false} />
            </LineChart>
          </ResponsiveContainer>
          <div style={{ display: 'flex', gap: 20, marginTop: 12 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}><div style={{ width: 12, height: 2, background: '#EF4444' }} /><span style={{ fontSize: 11, color: 'var(--text-muted)', fontFamily: 'IBM Plex Sans' }}>{t('analytics.opened')}</span></div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}><div style={{ width: 12, height: 2, background: '#10B981' }} /><span style={{ fontSize: 11, color: 'var(--text-muted)', fontFamily: 'IBM Plex Sans' }}>{t('analytics.resolved')}</span></div>
          </div>
        </div>
      </div>
    </DashboardLayout>
  );
}
