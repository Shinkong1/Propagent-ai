import { useEffect, useState } from 'react';
import { useRouter } from 'next/router';
import DashboardLayout from '../../components/DashboardLayout';
import MetricCard from '../../components/MetricCard';
import { Building2, Users, Wrench, DollarSign, TrendingUp, MessageSquare, Send, X } from 'lucide-react';
import { properties, maintenance, leads as leadsApi } from '../../lib/api';
import { getUser } from '../../lib/auth';
import toast from 'react-hot-toast';
import { useLanguage } from '../../lib/LanguageContext';
import { useCurrency } from '../../lib/CurrencyContext';

const LEAD_STATUS_ORDER = ['new', 'contacted', 'interested', 'demo_scheduled', 'negotiating', 'closed_won', 'closed_lost'];
const LEAD_STATUS_COLOR: any = {
  new: '#3B82F6', contacted: '#8B5CF6', interested: '#FBC02D', demo_scheduled: '#F97316',
  negotiating: '#EC4899', closed_won: '#10B981', closed_lost: '#64748B',
};

export default function Dashboard() {
  const { t } = useLanguage();
  const { formatMoney } = useCurrency();
  const router = useRouter();
  const [isMaster, setIsMaster] = useState(false);
  const [stats, setStats] = useState<any>(null);
  const [tickets, setTickets] = useState<any[]>([]);
  const [leadsList, setLeadsList] = useState<any[]>([]);
  const [chat, setChat] = useState({ input: '', messages: [] as any[], loading: false });

  const [activeModal, setActiveModal] = useState<'revenue' | 'units' | 'ai' | 'leads' | null>(null);
  const [revenueData, setRevenueData] = useState<any>(null);
  const [unitsData, setUnitsData] = useState<any>(null);
  const [aiData, setAiData] = useState<any>(null);
  const [modalLoading, setModalLoading] = useState(false);

  useEffect(() => { setIsMaster(!!getUser()?.is_master); }, []);

  useEffect(() => {
    properties.stats().then(r => setStats(r.data)).catch(() => setStats({
      total_properties: 0, total_units: 0, occupied_units: 0,
      vacancy_rate: 0, open_tickets: 0, monthly_revenue: 0
    }));
    maintenance.list().then(r => setTickets(r.data?.slice(0, 5) || [])).catch(() => {});
    properties.aiActivity().then(r => setAiData(r.data)).catch(() => {});
  }, []);

  // Lead CRM is PropAgent AI's own sales pipeline (owner-only) — only fetch
  // it, and only show the widget, for the master account.
  useEffect(() => {
    if (isMaster) leadsApi.list().then(r => setLeadsList(r.data || [])).catch(() => {});
  }, [isMaster]);

  const activeLeadsCount = leadsList.filter(l => l.status !== 'closed_won' && l.status !== 'closed_lost').length;

  const openModal = (modal: 'revenue' | 'units' | 'ai') => {
    setActiveModal(modal);
    setModalLoading(true);
    if (modal === 'revenue') {
      properties.revenueTrend().then(r => setRevenueData(r.data)).catch(() => setRevenueData(null)).finally(() => setModalLoading(false));
    } else if (modal === 'units') {
      properties.unitsDetail().then(r => setUnitsData(r.data)).catch(() => setUnitsData(null)).finally(() => setModalLoading(false));
    } else if (modal === 'ai') {
      properties.aiActivity().then(r => setAiData(r.data)).catch(() => setAiData(null)).finally(() => setModalLoading(false));
    }
  };

  const sendMessage = async () => {
    if (!chat.input.trim()) return;
    const userMsg = chat.input;
    setChat(p => ({ ...p, input: '', loading: true, messages: [...p.messages, { role: 'user', content: userMsg }] }));
    try {
      const res = await maintenance.chat({ message: userMsg, channel: 'chat' });
      setChat(p => ({
        ...p, loading: false,
        messages: [...p.messages, { role: 'assistant', content: res.data.response, intent: res.data.intent }]
      }));
    } catch {
      setChat(p => ({
        ...p, loading: false,
        messages: [...p.messages, { role: 'assistant', content: 'I\'m here to help! How can I assist you today?' }]
      }));
    }
  };

  const PRIORITY_COLOR: any = { emergency: '#EF4444', high: '#F97316', medium: '#FBC02D', low: '#10B981' };
  const STATUS_COLOR: any = { open: '#FBC02D', in_progress: '#3B82F6', scheduled: '#8B5CF6', completed: '#10B981' };

  const closeModal = () => setActiveModal(null);

  return (
    <DashboardLayout>
      <div style={{ maxWidth: 1200 }}>
        {/* Header */}
        <div style={{ marginBottom: 28 }}>
          <h1 style={{ fontFamily: 'Syne', fontWeight: 800, fontSize: 28, color: 'var(--text-primary)', marginBottom: 4 }}>
            {t('dashboard.portfolioOverview')}
          </h1>
          <p style={{ color: '#64748B', fontSize: 14, fontFamily: 'IBM Plex Sans' }}>
            Real-time metrics across your property portfolio
          </p>
        </div>

        {/* Metrics Grid */}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: 16, marginBottom: 28 }}>
          <MetricCard label={t('dashboard.totalProperties')} value={stats?.total_properties ?? '—'} subtext="active" color="#FBC02D" icon={<Building2 size={18} />} trend={{ value: 12, label: 'this month' }} onClick={() => router.push('/dashboard/properties')} />
          <MetricCard label={t('dashboard.occupiedUnits')} value={`${stats?.occupied_units ?? '—'}/${stats?.total_units ?? '—'}`} subtext={`${stats?.vacancy_rate ?? 0}% ${t('dashboard.vacancyRate').toLowerCase()}`} color="#3B82F6" icon={<Users size={18} />} onClick={() => openModal('units')} />
          <MetricCard label={t('dashboard.monthlyRevenue')} value={stats ? formatMoney(stats.monthly_revenue) : '—'} subtext="from active leases" color="#10B981" icon={<DollarSign size={18} />} onClick={() => openModal('revenue')} />
          <MetricCard label={t('dashboard.openTickets')} value={stats?.open_tickets ?? '—'} subtext="maintenance" color="#F97316" icon={<Wrench size={18} />} onClick={() => router.push('/dashboard/maintenance')} />
          <MetricCard label="AI Responses" value={aiData?.total ?? '—'} subtext="last 30 days" color="#8B5CF6" icon={<MessageSquare size={18} />} onClick={() => openModal('ai')} />
          {isMaster && (
            <MetricCard label="Leads Pipeline" value={activeLeadsCount} subtext="active prospects" color="#EC4899" icon={<TrendingUp size={18} />} onClick={() => setActiveModal('leads')} />
          )}
        </div>

        {/* Bottom: Recent Tickets + AI Chat */}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: 20 }}>

          {/* Recent Tickets */}
          <div style={{ background: 'var(--bg-surface)', border: '1px solid var(--border-strong)', borderRadius: 12, padding: 20 }}>
            <h2 style={{ fontFamily: 'Syne', fontWeight: 700, fontSize: 16, color: 'var(--text-primary)', marginBottom: 16 }}>
              Recent Maintenance
            </h2>
            {tickets.length === 0 ? (
              <p style={{ color: '#475569', fontSize: 13, fontFamily: 'IBM Plex Sans' }}>No tickets yet</p>
            ) : (
              tickets.map((t: any) => (
                <div key={t.id} onClick={() => router.push(`/dashboard/maintenance?ticket=${t.id}`)}
                  style={{ padding: '10px 0', borderBottom: '1px solid var(--border-subtle)', display: 'flex', alignItems: 'center', justifyContent: 'space-between', cursor: 'pointer' }}
                  onMouseEnter={e => { (e.currentTarget as HTMLElement).style.background = 'var(--hover-overlay)'; }}
                  onMouseLeave={e => { (e.currentTarget as HTMLElement).style.background = 'transparent'; }}>
                  <div>
                    <div style={{ fontSize: 13, color: '#E2E8F0', fontFamily: 'IBM Plex Sans', marginBottom: 2 }}>{t.title}</div>
                    <div style={{ fontSize: 11, color: '#64748B', fontFamily: 'IBM Plex Mono' }}>{t.category}</div>
                  </div>
                  <div style={{ display: 'flex', gap: 6 }}>
                    <span style={{ fontSize: 10, padding: '3px 8px', borderRadius: 4, background: `${PRIORITY_COLOR[t.priority]}20`, color: PRIORITY_COLOR[t.priority], fontFamily: 'IBM Plex Mono' }}>
                      {t.priority}
                    </span>
                    <span style={{ fontSize: 10, padding: '3px 8px', borderRadius: 4, background: `${STATUS_COLOR[t.status]}20`, color: STATUS_COLOR[t.status], fontFamily: 'IBM Plex Mono' }}>
                      {t.status?.replace('_', ' ')}
                    </span>
                  </div>
                </div>
              ))
            )}
          </div>

          {/* AI Chat */}
          <div style={{ background: 'var(--bg-surface)', border: '1px solid var(--border-strong)', borderRadius: 12, display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
            <div style={{ padding: '16px 20px', borderBottom: '1px solid var(--border-subtle)', display: 'flex', alignItems: 'center', gap: 10 }}>
              <div style={{ width: 8, height: 8, borderRadius: '50%', background: '#10B981' }} />
              <h2 style={{ fontFamily: 'Syne', fontWeight: 700, fontSize: 16, color: 'var(--text-primary)' }}>
                Tenant AI Assistant
              </h2>
            </div>
            <div style={{ flex: 1, padding: 16, overflowY: 'auto', minHeight: 200, maxHeight: 280 }}>
              {chat.messages.length === 0 && (
                <div style={{ color: '#475569', fontSize: 13, fontFamily: 'IBM Plex Sans', textAlign: 'center', marginTop: 40 }}>
                  Try: "My heater is broken" or "Is unit 4B available?"
                </div>
              )}
              {chat.messages.map((m: any, i: number) => (
                <div key={i} style={{ marginBottom: 12, display: 'flex', justifyContent: m.role === 'user' ? 'flex-end' : 'flex-start' }}>
                  <div style={{
                    maxWidth: '85%', padding: '8px 12px', borderRadius: 10, fontSize: 13,
                    fontFamily: 'IBM Plex Sans', lineHeight: 1.5,
                    background: m.role === 'user' ? 'rgba(var(--accent-rgb),0.15)' : 'var(--border-subtle)',
                    color: m.role === 'user' ? '#FBC02D' : '#E2E8F0',
                    border: `1px solid ${m.role === 'user' ? 'rgba(var(--accent-rgb),0.3)' : 'var(--border-strong)'}`,
                  }}>
                    {m.content}
                    {m.intent && <div style={{ fontSize: 10, color: '#475569', marginTop: 4, fontFamily: 'IBM Plex Mono' }}>intent: {m.intent}</div>}
                  </div>
                </div>
              ))}
              {chat.loading && (
                <div style={{ color: '#64748B', fontSize: 12, fontFamily: 'IBM Plex Mono' }}>AI thinking...</div>
              )}
            </div>
            <div style={{ padding: '12px 16px', borderTop: '1px solid var(--border-subtle)', display: 'flex', gap: 8 }}>
              <input
                value={chat.input}
                onChange={e => setChat(p => ({ ...p, input: e.target.value }))}
                onKeyDown={e => e.key === 'Enter' && sendMessage()}
                placeholder="Ask anything..."
                style={{ flex: 1, padding: '8px 12px', background: 'var(--bg-app)', border: '1px solid var(--border-input)', borderRadius: 8, color: 'var(--text-primary)', fontSize: 13, fontFamily: 'IBM Plex Sans', outline: 'none' }}
                spellCheck autoCorrect="on" autoCapitalize="sentences"
              />
              <button onClick={sendMessage} style={{ padding: '8px 12px', background: '#FBC02D', border: 'none', borderRadius: 8, cursor: 'pointer', color: 'var(--bg-app)' }}>
                <Send size={14} strokeWidth={2.5} />
              </button>
            </div>
          </div>
        </div>

        {/* Monthly Revenue drill-down */}
        {activeModal === 'revenue' && (
          <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.8)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000, padding: 20 }} onClick={closeModal}>
            <div style={{ background: 'var(--bg-surface)', border: '1px solid var(--border-strong)', borderRadius: 16, padding: 28, width: '100%', maxWidth: 460, maxHeight: '80vh', overflowY: 'auto' }} onClick={e => e.stopPropagation()}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
                <h2 style={{ fontFamily: 'Syne', fontWeight: 700, fontSize: 18, color: 'var(--text-primary)' }}>Monthly Revenue</h2>
                <button onClick={closeModal} style={{ background: 'none', border: 'none', color: '#64748B', cursor: 'pointer' }}><X size={18} /></button>
              </div>
              {modalLoading ? (
                <div style={{ color: '#64748B', fontFamily: 'IBM Plex Mono', fontSize: 13 }}>Loading...</div>
              ) : revenueData?.trend?.length ? (
                <>
                  {!revenueData.has_payment_history && (
                    <p style={{ fontSize: 12, color: '#F97316', marginBottom: 14 }}>No recorded rent payments yet — bars show $0 until payments are logged in Accounting.</p>
                  )}
                  <div style={{ display: 'grid', gap: 10 }}>
                    {(() => {
                      const max = Math.max(...revenueData.trend.map((r: any) => r.amount), 1);
                      return revenueData.trend.map((r: any) => (
                        <div key={r.month}>
                          <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 4 }}>
                            <span style={{ fontSize: 12, color: 'var(--text-secondary)', fontFamily: 'IBM Plex Mono' }}>{r.month}</span>
                            <span style={{ fontSize: 12, color: 'var(--text-primary)', fontFamily: 'IBM Plex Mono', fontWeight: 600 }}>{formatMoney(r.amount)}</span>
                          </div>
                          <div style={{ height: 8, background: 'var(--bg-app)', borderRadius: 4, overflow: 'hidden' }}>
                            <div style={{ height: '100%', width: `${(r.amount / max) * 100}%`, background: 'linear-gradient(90deg, #10B981, #FBC02D)', borderRadius: 4 }} />
                          </div>
                        </div>
                      ));
                    })()}
                  </div>
                </>
              ) : (
                <div style={{ color: '#475569', fontSize: 13 }}>No revenue data available.</div>
              )}
            </div>
          </div>
        )}

        {/* Occupied Units drill-down */}
        {activeModal === 'units' && (
          <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.8)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000, padding: 20 }} onClick={closeModal}>
            <div style={{ background: 'var(--bg-surface)', border: '1px solid var(--border-strong)', borderRadius: 16, padding: 28, width: '100%', maxWidth: 500, maxHeight: '80vh', overflowY: 'auto' }} onClick={e => e.stopPropagation()}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
                <h2 style={{ fontFamily: 'Syne', fontWeight: 700, fontSize: 18, color: 'var(--text-primary)' }}>Units</h2>
                <button onClick={closeModal} style={{ background: 'none', border: 'none', color: '#64748B', cursor: 'pointer' }}><X size={18} /></button>
              </div>
              {modalLoading ? (
                <div style={{ color: '#64748B', fontFamily: 'IBM Plex Mono', fontSize: 13 }}>Loading...</div>
              ) : unitsData?.units?.length ? (
                <div style={{ display: 'grid', gap: 8 }}>
                  {unitsData.units.map((u: any) => (
                    <div key={u.unit_id} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '10px 12px', border: '1px solid var(--border-strong)', borderRadius: 8 }}>
                      <div>
                        <div style={{ fontSize: 13, color: 'var(--text-primary)', fontFamily: 'IBM Plex Sans', fontWeight: 600 }}>{u.property_name} · Unit {u.unit_number}</div>
                        <div style={{ fontSize: 12, color: '#64748B', marginTop: 2 }}>{u.is_occupied ? (u.tenant_name || 'Occupied') : 'Vacant'}</div>
                      </div>
                      <span style={{ fontSize: 10, padding: '3px 8px', borderRadius: 4, background: u.is_occupied ? 'rgba(16,185,129,0.15)' : 'rgba(239,68,68,0.15)', color: u.is_occupied ? '#10B981' : '#EF4444', fontFamily: 'IBM Plex Mono' }}>
                        {u.is_occupied ? 'Occupied' : 'Vacant'}
                      </span>
                    </div>
                  ))}
                </div>
              ) : (
                <div style={{ color: '#475569', fontSize: 13 }}>No units found.</div>
              )}
            </div>
          </div>
        )}

        {/* AI Responses drill-down */}
        {activeModal === 'ai' && (
          <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.8)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000, padding: 20 }} onClick={closeModal}>
            <div style={{ background: 'var(--bg-surface)', border: '1px solid var(--border-strong)', borderRadius: 16, padding: 28, width: '100%', maxWidth: 460, maxHeight: '80vh', overflowY: 'auto' }} onClick={e => e.stopPropagation()}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
                <h2 style={{ fontFamily: 'Syne', fontWeight: 700, fontSize: 18, color: 'var(--text-primary)' }}>AI Activity</h2>
                <button onClick={closeModal} style={{ background: 'none', border: 'none', color: '#64748B', cursor: 'pointer' }}><X size={18} /></button>
              </div>
              <p style={{ fontSize: 11, color: '#475569', marginBottom: 16 }}>
                Real log of AI feature calls, last 30 days. Full conversation transcripts aren't stored anywhere in the app — this shows when and which AI features ran, not the content of each response.
              </p>
              {modalLoading ? (
                <div style={{ color: '#64748B', fontFamily: 'IBM Plex Mono', fontSize: 13 }}>Loading...</div>
              ) : aiData ? (
                <>
                  <div style={{ display: 'flex', gap: 16, marginBottom: 18, flexWrap: 'wrap' }}>
                    {Object.entries(aiData.by_feature || {}).map(([feature, count]: any) => (
                      <div key={feature} style={{ background: 'var(--bg-app)', border: '1px solid var(--border-strong)', borderRadius: 8, padding: '8px 12px' }}>
                        <div style={{ fontSize: 10, color: '#64748B', fontFamily: 'IBM Plex Mono', textTransform: 'uppercase' }}>{feature.replace('_', ' ')}</div>
                        <div style={{ fontSize: 16, color: 'var(--text-primary)', fontFamily: 'IBM Plex Mono', fontWeight: 700 }}>{count}</div>
                      </div>
                    ))}
                  </div>
                  {aiData.recent?.length > 0 ? (
                    <div style={{ display: 'grid', gap: 6 }}>
                      {aiData.recent.map((c: any, i: number) => (
                        <div key={i} style={{ display: 'flex', justifyContent: 'space-between', padding: '6px 0', borderBottom: '1px solid var(--border-subtle)' }}>
                          <span style={{ fontSize: 12, color: 'var(--text-secondary)', fontFamily: 'IBM Plex Mono' }}>{c.feature.replace('_', ' ')}</span>
                          <span style={{ fontSize: 11, color: '#64748B', fontFamily: 'IBM Plex Mono' }}>{new Date(c.created_at).toLocaleString()}</span>
                        </div>
                      ))}
                    </div>
                  ) : (
                    <div style={{ color: '#475569', fontSize: 13 }}>No AI calls logged in the last 30 days.</div>
                  )}
                </>
              ) : (
                <div style={{ color: '#475569', fontSize: 13 }}>No AI activity data available.</div>
              )}
            </div>
          </div>
        )}

        {/* Leads Pipeline drill-down */}
        {isMaster && activeModal === 'leads' && (
          <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.8)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000, padding: 20 }} onClick={closeModal}>
            <div style={{ background: 'var(--bg-surface)', border: '1px solid var(--border-strong)', borderRadius: 16, padding: 28, width: '100%', maxWidth: 500, maxHeight: '80vh', overflowY: 'auto' }} onClick={e => e.stopPropagation()}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
                <h2 style={{ fontFamily: 'Syne', fontWeight: 700, fontSize: 18, color: 'var(--text-primary)' }}>Leads Pipeline</h2>
                <button onClick={closeModal} style={{ background: 'none', border: 'none', color: '#64748B', cursor: 'pointer' }}><X size={18} /></button>
              </div>
              {leadsList.length === 0 ? (
                <div style={{ color: '#475569', fontSize: 13 }}>No leads yet.</div>
              ) : (
                LEAD_STATUS_ORDER.filter(s => leadsList.some(l => l.status === s)).map(status => (
                  <div key={status} style={{ marginBottom: 16 }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 8 }}>
                      <div style={{ width: 8, height: 8, borderRadius: '50%', background: LEAD_STATUS_COLOR[status] }} />
                      <span style={{ fontSize: 12, fontFamily: 'IBM Plex Mono', color: LEAD_STATUS_COLOR[status], textTransform: 'uppercase' }}>
                        {status.replace('_', ' ')} ({leadsList.filter(l => l.status === status).length})
                      </span>
                    </div>
                    <div style={{ display: 'grid', gap: 6 }}>
                      {leadsList.filter(l => l.status === status).map(l => (
                        <div key={l.id} onClick={() => { closeModal(); router.push('/dashboard/leads'); }}
                          style={{ display: 'flex', justifyContent: 'space-between', padding: '8px 10px', border: '1px solid var(--border-strong)', borderRadius: 8, cursor: 'pointer' }}>
                          <span style={{ fontSize: 13, color: 'var(--text-primary)', fontFamily: 'IBM Plex Sans' }}>{l.first_name} {l.last_name}{l.company ? ` · ${l.company}` : ''}</span>
                          <span style={{ fontSize: 11, color: '#64748B', fontFamily: 'IBM Plex Mono' }}>score {l.score}</span>
                        </div>
                      ))}
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>
        )}
      </div>
    </DashboardLayout>
  );
}
