import { useEffect, useState } from 'react';
import { useRouter } from 'next/router';
import DashboardLayout from '../../components/DashboardLayout';
import {
  ShieldAlert, Crown, Building2, Users, DollarSign, Sparkles, MessageSquare,
  TrendingUp, Activity, BarChart3, Search, Database, Server, Cpu, Plug, AlertOctagon, Repeat, Gift, X, Send,
  Link2, ExternalLink, Copy, Github, CreditCard, Phone, Mail, Timer, Cloud, KeyRound, Megaphone,
  ShieldCheck, Trash2, Plus, Star,
} from 'lucide-react';
import Link from 'next/link';
import { admin as adminApi } from '../../lib/api';
import { getUser, setUser } from '../../lib/auth';
import { useLanguage } from '../../lib/LanguageContext';
import { useCurrency } from '../../lib/CurrencyContext';
import toast from 'react-hot-toast';

const PLANS = ['starter', 'professional', 'enterprise'];
const PLAN_COLOR: Record<string, string> = { starter: '#64748B', professional: '#FBC02D', enterprise: '#8B5CF6' };
const TABS = ['subscribers', 'revenue', 'growth', 'platform', 'links', 'testimonials', 'analytics'] as const;
type Tab = typeof TABS[number];
const TAB_ICON: Record<Tab, any> = { subscribers: Users, revenue: DollarSign, growth: TrendingUp, platform: Activity, links: Link2, testimonials: Star, analytics: BarChart3 };

const SITE_URL = 'https://propagent.app';
const API_URL = 'https://propagent-api.onrender.com';

const EXTERNAL_SERVICES = [
  { name: 'Render', role: 'Backend hosting, deploy logs, env vars', url: 'https://dashboard.render.com', icon: Server },
  { name: 'Vercel', role: 'Frontend hosting, deploy logs, env vars', url: 'https://vercel.com/dashboard', icon: Cloud },
  { name: 'Stripe', role: 'Payments, subscriptions, Connect accounts', url: 'https://dashboard.stripe.com', icon: CreditCard },
  { name: 'Neon', role: 'Postgres database', url: 'https://console.neon.tech', icon: Database },
  { name: 'Resend', role: 'Email sending — password resets, invites, notifications', url: 'https://resend.com/emails', icon: Mail },
  { name: 'Twilio', role: 'Voice AI + SMS', url: 'https://console.twilio.com', icon: Phone },
  { name: 'cron-job.org', role: 'Hourly outreach queue trigger', url: 'https://console.cron-job.org', icon: Timer },
  { name: 'Google Cloud Console', role: 'Google Sign-In OAuth credentials', url: 'https://console.cloud.google.com', icon: KeyRound },
  { name: 'Google Search Console', role: 'Search indexing, submitted sitemap status', url: 'https://search.google.com/search-console', icon: KeyRound },
  { name: 'GitHub', role: 'Source code', url: 'https://github.com/Shinkong1/Propagent-ai', icon: Github },
  { name: 'API Docs', role: 'Live interactive backend API reference', url: `${API_URL}/docs`, icon: Plug },
];

const SHARE_LINKS = [
  { label: 'Homepage', url: SITE_URL },
  { label: 'Pricing', url: `${SITE_URL}/pricing` },
  { label: 'Browse Rentals directory', url: `${SITE_URL}/listings` },
  { label: 'Sign up', url: `${SITE_URL}/signup` },
  { label: 'Sitemap (for Google Search Console)', url: `${SITE_URL}/sitemap.xml` },
];

function copyLink(url: string) {
  navigator.clipboard.writeText(url);
  toast.success('Copied');
}

function KpiCard({ label, value, sub, icon: Icon, onClick }: { label: string; value: any; sub?: string; icon: any; onClick?: () => void }) {
  return (
    <div
      onClick={onClick}
      style={{
        background: 'var(--bg-surface)', border: '1px solid var(--border-strong)', borderRadius: 12, padding: '14px 16px',
        cursor: onClick ? 'pointer' : 'default',
      }}
      onMouseEnter={e => { if (onClick) (e.currentTarget as HTMLElement).style.borderColor = 'rgba(251,192,45,0.4)'; }}
      onMouseLeave={e => { (e.currentTarget as HTMLElement).style.borderColor = 'var(--border-strong)'; }}
    >
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 8 }}>
        <Icon size={14} color="#FBC02D" />
        <div style={{ fontSize: 10, fontFamily: 'IBM Plex Mono', color: '#64748B', letterSpacing: '0.5px' }}>{label.toUpperCase()}</div>
      </div>
      <div style={{ fontSize: 22, fontFamily: 'IBM Plex Mono', fontWeight: 600, color: 'var(--text-primary)' }}>{value}</div>
      {sub && <div style={{ fontSize: 11, color: '#64748B', marginTop: 2 }}>{sub}</div>}
      {onClick && <div style={{ fontSize: 10, color: '#FBC02D', marginTop: 6 }}>View breakdown →</div>}
    </div>
  );
}

function MiniBarChart({ data, valueKey, labelKey }: { data: any[]; valueKey: string; labelKey: string }) {
  const max = Math.max(1, ...data.map(d => d[valueKey]));
  return (
    <div style={{ display: 'flex', alignItems: 'flex-end', gap: 8, height: 120, padding: '0 4px' }}>
      {data.map((d, i) => (
        <div key={i} style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 6 }}>
          <div style={{ fontSize: 11, color: 'var(--text-secondary)', fontFamily: 'IBM Plex Mono' }}>{d[valueKey]}</div>
          <div style={{
            width: '100%', maxWidth: 28, borderRadius: '4px 4px 0 0',
            height: Math.max(3, (d[valueKey] / max) * 80),
            background: 'linear-gradient(180deg, #FBC02D, #F57F17)',
          }} />
          <div style={{ fontSize: 9, color: '#64748B', fontFamily: 'IBM Plex Mono', whiteSpace: 'nowrap' }}>{d[labelKey]}</div>
        </div>
      ))}
    </div>
  );
}

const badge = (bg: string, color: string): React.CSSProperties => ({
  fontSize: 10, padding: '3px 8px', borderRadius: 4, fontFamily: 'IBM Plex Mono', background: bg, color,
});

const sectionTitle: React.CSSProperties = {
  fontFamily: 'Syne', fontWeight: 700, fontSize: 14, color: 'var(--text-primary)',
  marginBottom: 12, display: 'flex', alignItems: 'center', gap: 8,
};

export default function OwnerAdmin() {
  const router = useRouter();
  const { t } = useLanguage();
  const { formatMoney } = useCurrency();
  const isMaster = getUser()?.is_master;
  const [tab, setTab] = useState<Tab>('subscribers');
  const [loading, setLoading] = useState(true);

  // Subscribers tab state
  const [metrics, setMetrics] = useState<any>(null);
  const [orgs, setOrgs] = useState<any[]>([]);
  const [users, setUsers] = useState<any[]>([]);
  const [messages, setMessages] = useState<any[]>([]);
  const [selectedMessage, setSelectedMessage] = useState<any>(null);
  const [activityOrg, setActivityOrg] = useState<any>(null); // the org row whose activity modal is open
  const [orgActivity, setOrgActivity] = useState<any>(null);
  const [loadingActivity, setLoadingActivity] = useState(false);
  const [cancelingSubscription, setCancelingSubscription] = useState(false);
  const [replyText, setReplyText] = useState('');
  const [sendingReply, setSendingReply] = useState(false);
  const [savingOrgId, setSavingOrgId] = useState<string | null>(null);
  const [savingUserId, setSavingUserId] = useState<string | null>(null);
  const [subSearch, setSubSearch] = useState('');
  const [subStatus, setSubStatus] = useState('all');

  // Other tabs
  const [revenue, setRevenue] = useState<any>(null);
  const [revenueModal, setRevenueModal] = useState<'mrr' | 'arr' | 'arpu' | null>(null);
  const [growth, setGrowth] = useState<any>(null);
  const [platform, setPlatform] = useState<any>(null);
  const [businessAnalytics, setBusinessAnalytics] = useState<any>(null);

  useEffect(() => {
    if (!router.isReady) return;
    const q = router.query.tab;
    if (typeof q === 'string' && (TABS as readonly string[]).includes(q)) setTab(q as Tab);
  }, [router.isReady, router.query.tab]);

  const goTab = (next: Tab) => {
    setTab(next);
    router.push({ pathname: '/dashboard/admin', query: { tab: next } }, undefined, { shallow: true });
  };

  const load = () => {
    Promise.all([
      adminApi.metrics(), adminApi.listOrganizations(), adminApi.listUsers(), adminApi.listMessages(),
      adminApi.revenue(), adminApi.growth(), adminApi.platformHealth(), adminApi.businessAnalytics(),
    ])
      .then(([m, o, u, msg, rev, gr, ph, ba]) => {
        setMetrics(m.data);
        setOrgs(o.data || []);
        setUsers(u.data || []);
        setMessages(msg.data || []);
        setRevenue(rev.data);
        setGrowth(gr.data);
        setPlatform(ph.data);
        setBusinessAnalytics(ba.data);
      })
      .catch(() => {})
      .finally(() => setLoading(false));
  };

  useEffect(() => {
    if (isMaster) load();
    else setLoading(false);
  }, []);

  const changeOrgPlan = async (orgId: string, plan: string) => {
    setSavingOrgId(orgId);
    try {
      const res = await adminApi.updateOrganization(orgId, { plan });
      setOrgs(prev => prev.map(o => o.id === orgId ? res.data : o));
      const user = getUser();
      if (user && user.organization_id === orgId) {
        setUser({ ...user, plan });
        toast.success(t('admin.planChanged'));
        setTimeout(() => window.location.reload(), 700);
        return;
      }
      toast.success(t('admin.planChanged'));
    } catch (err: any) {
      toast.error(err?.response?.data?.detail || t('admin.actionFailed'));
    } finally {
      setSavingOrgId(null);
    }
  };

  const toggleOrgActive = async (orgId: string, isActive: boolean) => {
    setSavingOrgId(orgId);
    try {
      const res = await adminApi.updateOrganization(orgId, { is_active: isActive });
      setOrgs(prev => prev.map(o => o.id === orgId ? res.data : o));
      toast.success(t('admin.saved'));
    } catch (err: any) {
      toast.error(err?.response?.data?.detail || t('admin.actionFailed'));
    } finally {
      setSavingOrgId(null);
    }
  };

  const openActivity = async (org: any) => {
    setActivityOrg(org);
    setOrgActivity(null);
    setLoadingActivity(true);
    try {
      const res = await adminApi.orgActivity(org.id);
      setOrgActivity(res.data);
    } catch (err: any) {
      toast.error(err?.response?.data?.detail || t('admin.actionFailed'));
    } finally {
      setLoadingActivity(false);
    }
  };

  const cancelSubscription = async () => {
    if (!activityOrg) return;
    if (!confirm(`Cancel ${activityOrg.name}'s subscription at the end of their current billing period? This mirrors what they'd see using "Manage Subscription" themselves.`)) return;
    setCancelingSubscription(true);
    try {
      await adminApi.cancelOrgSubscription(activityOrg.id);
      toast.success('Subscription scheduled to cancel at period end');
      openActivity(activityOrg); // refresh the modal's data
    } catch (err: any) {
      toast.error(err?.response?.data?.detail || t('admin.actionFailed'));
    } finally {
      setCancelingSubscription(false);
    }
  };

  const toggleUserActive = async (userId: string, isActive: boolean) => {
    setSavingUserId(userId);
    try {
      const res = await adminApi.updateUser(userId, { is_active: isActive });
      setUsers(prev => prev.map(u => u.id === userId ? res.data : u));
      toast.success(t('admin.saved'));
    } catch (err: any) {
      toast.error(err?.response?.data?.detail || t('admin.actionFailed'));
    } finally {
      setSavingUserId(null);
    }
  };

  const sendReply = async () => {
    if (!selectedMessage || !replyText.trim()) return;
    setSendingReply(true);
    try {
      const res = await adminApi.replyToMessage(selectedMessage.id, replyText.trim());
      setMessages(prev => prev.map(m => m.id === selectedMessage.id ? res.data : m));
      setSelectedMessage(res.data);
      setReplyText('');
      if (res.data.reply_status === 'sent') {
        toast.success('Reply sent');
      } else {
        toast.error('Reply could not be delivered by email — check SMTP settings. It has been saved on the message.');
      }
    } catch (err: any) {
      toast.error(err?.response?.data?.detail || t('admin.actionFailed'));
    } finally {
      setSendingReply(false);
    }
  };

  if (!isMaster) {
    return (
      <DashboardLayout>
        <div style={{ maxWidth: 640, margin: '80px auto', textAlign: 'center' }}>
          <div style={{ width: 56, height: 56, borderRadius: 14, background: 'rgba(239,68,68,0.1)', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 20px' }}>
            <ShieldAlert size={26} color="#EF4444" />
          </div>
          <h1 style={{ fontFamily: 'Syne', fontWeight: 800, fontSize: 24, color: 'var(--text-primary)', marginBottom: 10 }}>{t('admin.title')}</h1>
          <p style={{ color: '#64748B', fontSize: 14 }}>{t('admin.unauthorized')}</p>
        </div>
      </DashboardLayout>
    );
  }

  if (loading) {
    return (
      <DashboardLayout>
        <div style={{ color: '#64748B', fontFamily: 'IBM Plex Mono' }}>{t('nav.loading')}</div>
      </DashboardLayout>
    );
  }

  const filteredOrgs = orgs.filter(o => {
    if (subSearch && !o.name.toLowerCase().includes(subSearch.toLowerCase())) return false;
    if (subStatus !== 'all') {
      const status = o.is_active ? 'active' : 'inactive';
      if (status !== subStatus) return false;
    }
    return true;
  });

  return (
    <DashboardLayout>
      <div style={{ maxWidth: 1200 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 6 }}>
          <Crown size={24} color="#FBC02D" />
          <h1 style={{ fontFamily: 'Syne', fontWeight: 800, fontSize: 26, color: 'var(--text-primary)' }}>{t('admin.title')}</h1>
        </div>
        <p style={{ color: '#64748B', fontSize: 14, marginBottom: 20 }}>{t('admin.subtitle')}</p>

        <div style={{ display: 'flex', gap: 6, marginBottom: 24, borderBottom: '1px solid var(--border-strong)', flexWrap: 'wrap' }}>
          {TABS.map(tb => {
            const Icon = TAB_ICON[tb];
            const active = tab === tb;
            return (
              <button key={tb} onClick={() => goTab(tb)} style={{
                display: 'flex', alignItems: 'center', gap: 7, padding: '10px 16px',
                background: 'transparent', border: 'none', cursor: 'pointer',
                color: active ? '#FBC02D' : 'var(--text-secondary)',
                borderBottom: active ? '2px solid #FBC02D' : '2px solid transparent',
                fontFamily: 'Syne', fontWeight: 600, fontSize: 13, marginBottom: -1,
              }}>
                <Icon size={14} /> {t(`admin.tab.${tb}`)}
              </button>
            );
          })}
        </div>

        {tab === 'subscribers' && (
          <>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: 12, marginBottom: 20 }}>
              <KpiCard label={t('admin.organizations')} value={metrics?.total_organizations} sub={`${metrics?.active_organizations} ${t('admin.active')}`} icon={Building2} />
              <KpiCard label={t('admin.users')} value={metrics?.total_users} sub={`${metrics?.active_users} ${t('admin.active')}`} icon={Users} />
              <KpiCard label={t('admin.newThisMonth')} value={metrics?.new_organizations_this_month} sub={t('admin.newThisMonthSub')} icon={Sparkles} />
            </div>

            {metrics && (
              <div style={{ display: 'flex', gap: 10, marginBottom: 20, flexWrap: 'wrap' }}>
                {PLANS.map(p => (
                  <div key={p} style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '5px 10px', borderRadius: 6, background: `${PLAN_COLOR[p]}15` }}>
                    <div style={{ width: 8, height: 8, borderRadius: '50%', background: PLAN_COLOR[p] }} />
                    <span style={{ fontSize: 11, color: PLAN_COLOR[p], fontFamily: 'IBM Plex Mono' }}>
                      {t(`admin.plan.${p}`)}: {metrics.orgs_by_plan[p] || 0}
                    </span>
                  </div>
                ))}
              </div>
            )}

            <div style={{ display: 'flex', gap: 10, marginBottom: 16, flexWrap: 'wrap' }}>
              <div style={{ position: 'relative', flex: 1, minWidth: 200 }}>
                <Search size={14} color="#64748B" style={{ position: 'absolute', left: 12, top: 11 }} />
                <input
                  value={subSearch} onChange={e => setSubSearch(e.target.value)}
                  placeholder={t('admin.searchSubscribers')}
                  style={{ width: '100%', padding: '9px 12px 9px 34px', background: 'var(--bg-surface)', border: '1px solid var(--border-strong)', borderRadius: 8, color: 'var(--text-primary)', fontSize: 13, outline: 'none', boxSizing: 'border-box' }}
                />
              </div>
              <select value={subStatus} onChange={e => setSubStatus(e.target.value)} style={{ padding: '9px 14px', background: 'var(--bg-surface)', border: '1px solid var(--border-strong)', borderRadius: 8, color: 'var(--text-secondary)', fontSize: 13 }}>
                <option value="all">{t('admin.allStatuses')}</option>
                <option value="active">{t('admin.active')}</option>
                <option value="inactive">{t('admin.inactive')}</option>
              </select>
            </div>

            <div style={{ background: 'var(--bg-surface)', border: '1px solid var(--border-strong)', borderRadius: 12, overflow: 'hidden', marginBottom: 32 }}>
              <div style={{ overflowX: 'auto' }}>
                <table style={{ width: '100%', borderCollapse: 'collapse', minWidth: 1020 }}>
                  <thead>
                    <tr style={{ borderBottom: '1px solid var(--border-strong)' }}>
                      {[t('admin.name'), t('admin.planCol'), t('admin.usersCol'), t('admin.propertiesCol'), t('admin.unitsCol'), t('admin.aiCallsCol'), t('admin.statusCol'), t('admin.createdCol'), t('admin.activityCol')].map(h => (
                        <th key={h} style={{ padding: '10px 14px', textAlign: 'left', fontSize: 10, fontFamily: 'IBM Plex Mono', color: '#64748B', letterSpacing: '0.5px', whiteSpace: 'nowrap' }}>{h}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {filteredOrgs.map(o => (
                      <tr key={o.id} style={{ borderBottom: '1px solid var(--border-subtle)' }}>
                        <td style={{ padding: '10px 14px', fontSize: 13, color: 'var(--text-primary)', fontWeight: 600 }}>
                          {o.name}
                          {o.is_master_org && <span style={{ marginLeft: 6, fontSize: 9, padding: '2px 6px', borderRadius: 4, background: 'rgba(251,192,45,0.15)', color: '#FBC02D', fontFamily: 'IBM Plex Mono' }}>{t('admin.owner')}</span>}
                        </td>
                        <td style={{ padding: '10px 14px' }}>
                          <select
                            value={o.plan}
                            disabled={savingOrgId === o.id}
                            onChange={e => changeOrgPlan(o.id, e.target.value)}
                            style={{ background: 'var(--bg-app)', border: '1px solid var(--border-input)', borderRadius: 6, color: PLAN_COLOR[o.plan], fontSize: 12, fontFamily: 'IBM Plex Mono', padding: '4px 8px' }}
                          >
                            {PLANS.map(p => <option key={p} value={p}>{t(`admin.plan.${p}`)}</option>)}
                          </select>
                        </td>
                        <td style={{ padding: '10px 14px', fontSize: 13, color: 'var(--text-secondary)', fontFamily: 'IBM Plex Mono' }}>{o.user_count}</td>
                        <td style={{ padding: '10px 14px', fontSize: 13, color: 'var(--text-secondary)', fontFamily: 'IBM Plex Mono' }}>{o.property_count}</td>
                        <td style={{ padding: '10px 14px', fontSize: 13, color: 'var(--text-secondary)', fontFamily: 'IBM Plex Mono' }}>{o.unit_count}</td>
                        <td style={{ padding: '10px 14px', fontSize: 13, color: 'var(--text-secondary)', fontFamily: 'IBM Plex Mono' }}>{o.ai_calls_this_period}</td>
                        <td style={{ padding: '10px 14px' }}>
                          <button
                            onClick={() => toggleOrgActive(o.id, !o.is_active)}
                            disabled={savingOrgId === o.id}
                            style={{ ...badge(o.is_active ? 'rgba(16,185,129,0.15)' : 'rgba(239,68,68,0.15)', o.is_active ? '#10B981' : '#EF4444'), cursor: 'pointer', border: 'none' }}>
                            {o.is_active ? t('admin.active') : t('admin.inactive')}
                          </button>
                        </td>
                        <td style={{ padding: '10px 14px', fontSize: 11, fontFamily: 'IBM Plex Mono', color: '#64748B', whiteSpace: 'nowrap' }}>{new Date(o.created_at).toLocaleDateString()}</td>
                        <td style={{ padding: '10px 14px' }}>
                          <button
                            onClick={() => openActivity(o)}
                            style={{ display: 'flex', alignItems: 'center', gap: 5, background: 'var(--bg-app)', border: '1px solid var(--border-strong)', borderRadius: 6, color: 'var(--text-secondary)', fontSize: 11, fontFamily: 'IBM Plex Mono', padding: '5px 9px', cursor: 'pointer' }}
                          >
                            <Activity size={11} /> {t('admin.viewActivity')}
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>

            <h2 style={{ fontFamily: 'Syne', fontWeight: 700, fontSize: 16, color: 'var(--text-primary)', marginBottom: 12, display: 'flex', alignItems: 'center', gap: 8 }}>
              <Users size={16} color="#FBC02D" /> {t('admin.usersTable')}
            </h2>
            <div style={{ background: 'var(--bg-surface)', border: '1px solid var(--border-strong)', borderRadius: 12, overflow: 'hidden', marginBottom: 32 }}>
              <div style={{ overflowX: 'auto' }}>
                <table style={{ width: '100%', borderCollapse: 'collapse', minWidth: 800 }}>
                  <thead>
                    <tr style={{ borderBottom: '1px solid var(--border-strong)' }}>
                      {[t('admin.name'), t('admin.emailCol'), t('admin.organizationCol'), t('admin.roleCol'), t('admin.statusCol')].map(h => (
                        <th key={h} style={{ padding: '10px 14px', textAlign: 'left', fontSize: 10, fontFamily: 'IBM Plex Mono', color: '#64748B', letterSpacing: '0.5px', whiteSpace: 'nowrap' }}>{h}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {users.map(u => (
                      <tr key={u.id} style={{ borderBottom: '1px solid var(--border-subtle)' }}>
                        <td style={{ padding: '10px 14px', fontSize: 13, color: 'var(--text-primary)', fontWeight: 600 }}>
                          {u.full_name}
                          {u.is_master && <span style={{ marginLeft: 6, fontSize: 9, padding: '2px 6px', borderRadius: 4, background: 'rgba(251,192,45,0.15)', color: '#FBC02D', fontFamily: 'IBM Plex Mono' }}>{t('admin.owner')}</span>}
                        </td>
                        <td style={{ padding: '10px 14px', fontSize: 12, color: 'var(--text-secondary)', fontFamily: 'IBM Plex Mono' }}>{u.email}</td>
                        <td style={{ padding: '10px 14px', fontSize: 12, color: 'var(--text-secondary)' }}>{u.organization_name || '—'}</td>
                        <td style={{ padding: '10px 14px', fontSize: 12, color: 'var(--text-secondary)', textTransform: 'capitalize' }}>{u.role}</td>
                        <td style={{ padding: '10px 14px' }}>
                          <button
                            onClick={() => toggleUserActive(u.id, !u.is_active)}
                            disabled={savingUserId === u.id || u.is_master}
                            title={u.is_master ? t('admin.cannotDeactivateSelf') : ''}
                            style={{ ...badge(u.is_active ? 'rgba(16,185,129,0.15)' : 'rgba(239,68,68,0.15)', u.is_active ? '#10B981' : '#EF4444'), cursor: u.is_master ? 'default' : 'pointer', border: 'none', opacity: u.is_master ? 0.6 : 1 }}>
                            {u.is_active ? t('admin.active') : t('admin.inactive')}
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>

            <h2 style={{ fontFamily: 'Syne', fontWeight: 700, fontSize: 16, color: 'var(--text-primary)', margin: '0 0 12px', display: 'flex', alignItems: 'center', gap: 8 }}>
              <MessageSquare size={16} color="#FBC02D" /> {t('admin.messagesTable')}
            </h2>
            <p style={{ fontSize: 12, color: '#64748B', marginBottom: 12 }}>{t('admin.messagesSubtitle')}</p>
            <div style={{ background: 'var(--bg-surface)', border: '1px solid var(--border-strong)', borderRadius: 12, overflow: 'hidden' }}>
              <div style={{ overflowX: 'auto' }}>
                <table style={{ width: '100%', borderCollapse: 'collapse', minWidth: 900 }}>
                  <thead>
                    <tr style={{ borderBottom: '1px solid var(--border-strong)' }}>
                      {[t('admin.sourceCol'), t('admin.senderCol'), t('admin.organizationCol'), t('admin.subjectCol'), t('admin.emailStatusCol'), t('admin.createdCol')].map(h => (
                        <th key={h} style={{ padding: '10px 14px', textAlign: 'left', fontSize: 10, fontFamily: 'IBM Plex Mono', color: '#64748B', letterSpacing: '0.5px', whiteSpace: 'nowrap' }}>{h}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {messages.length === 0 ? (
                      <tr><td colSpan={6} style={{ textAlign: 'center', padding: '40px', color: '#475569' }}>{t('admin.noMessages')}</td></tr>
                    ) : messages.map(m => (
                      <tr
                        key={m.id}
                        onClick={() => { setSelectedMessage(m); setReplyText(''); }}
                        style={{ borderBottom: '1px solid var(--border-subtle)', cursor: 'pointer' }}
                        onMouseEnter={e => { (e.currentTarget as HTMLElement).style.background = 'var(--hover-overlay)'; }}
                        onMouseLeave={e => { (e.currentTarget as HTMLElement).style.background = 'transparent'; }}
                      >
                        <td style={{ padding: '10px 14px' }}>
                          <span style={badge(m.source === 'chat' ? 'rgba(139,92,246,0.15)' : 'rgba(59,130,246,0.15)', m.source === 'chat' ? '#8B5CF6' : '#3B82F6')}>
                            {t(`admin.source.${m.source}`)}
                          </span>
                        </td>
                        <td style={{ padding: '10px 14px', fontSize: 12, color: 'var(--text-primary)' }}>
                          {m.sender_name || '—'}
                          <div style={{ fontSize: 11, color: '#64748B' }}>{m.sender_email || ''}</div>
                        </td>
                        <td style={{ padding: '10px 14px', fontSize: 12, color: 'var(--text-secondary)' }}>{m.organization_name || '—'}</td>
                        <td style={{ padding: '10px 14px', fontSize: 12, color: 'var(--text-secondary)', maxWidth: 280, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                          {m.subject}
                          {m.replied_at && <span style={{ marginLeft: 6, fontSize: 10, color: '#10B981' }}>↩ replied</span>}
                        </td>
                        <td style={{ padding: '10px 14px' }}>
                          <span style={badge(m.email_status === 'sent' ? 'rgba(16,185,129,0.15)' : m.email_status === 'failed' ? 'rgba(239,68,68,0.15)' : 'rgba(100,116,139,0.15)', m.email_status === 'sent' ? '#10B981' : m.email_status === 'failed' ? '#EF4444' : '#64748B')}>
                            {t(`admin.emailStatus.${m.email_status}`)}
                          </span>
                        </td>
                        <td style={{ padding: '10px 14px', fontSize: 11, fontFamily: 'IBM Plex Mono', color: '#64748B', whiteSpace: 'nowrap' }}>{new Date(m.created_at).toLocaleString()}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          </>
        )}

        {tab === 'revenue' && revenue && (
          <>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: 12, marginBottom: 20 }}>
              <KpiCard label={t('admin.mrr')} value={formatMoney(revenue.mrr)} sub={t('admin.mrrSub')} icon={DollarSign} onClick={() => setRevenueModal('mrr')} />
              <KpiCard label={t('admin.arr')} value={formatMoney(revenue.arr)} sub={t('admin.arrSub')} icon={TrendingUp} onClick={() => setRevenueModal('arr')} />
              <KpiCard label={t('admin.arpu')} value={formatMoney(revenue.arpu)} sub={t('admin.arpuSub')} icon={Users} onClick={() => setRevenueModal('arpu')} />
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: 12, marginBottom: 20 }}>
              <KpiCard label={t('admin.churnRate')} value={revenue.churn_rate_30d !== null ? `${revenue.churn_rate_30d}%` : '—'} sub={revenue.churn_note || t('admin.churnSub')} icon={Repeat} />
              <KpiCard label={t('admin.ltv')} value={revenue.ltv !== null ? formatMoney(revenue.ltv) : '—'} sub={t('admin.ltvSub')} icon={Gift} />
            </div>
            <p style={{ fontSize: 12, color: '#64748B' }}>{t('admin.revenueNote')}</p>
          </>
        )}

        {tab === 'growth' && growth && (
          <>
            <h2 style={{ fontFamily: 'Syne', fontWeight: 700, fontSize: 16, color: 'var(--text-primary)', marginBottom: 12 }}>{t('admin.signupTrend')}</h2>
            <div style={{ background: 'var(--bg-surface)', border: '1px solid var(--border-strong)', borderRadius: 12, padding: 20, marginBottom: 24 }}>
              <MiniBarChart data={growth.signup_trend} valueKey="signups" labelKey="month" />
            </div>

            <h2 style={{ fontFamily: 'Syne', fontWeight: 700, fontSize: 16, color: 'var(--text-primary)', marginBottom: 12 }}>{t('admin.conversionFunnel')}</h2>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: 12, marginBottom: 24 }}>
              <KpiCard label={t('admin.funnelSignups')} value={growth.conversion_funnel.signups} icon={Users} />
              <KpiCard label={t('admin.funnelActive')} value={growth.conversion_funnel.active} icon={Activity} />
              <KpiCard label={t('admin.funnelPaid')} value={growth.conversion_funnel.paid_plan} icon={DollarSign} />
            </div>

            <h2 style={{ fontFamily: 'Syne', fontWeight: 700, fontSize: 16, color: 'var(--text-primary)', marginBottom: 12 }}>{t('admin.referralLeaderboard')}</h2>
            <div style={{ background: 'var(--bg-surface)', border: '1px solid var(--border-strong)', borderRadius: 12, overflow: 'hidden', marginBottom: 16 }}>
              {growth.referral_leaderboard.length === 0 ? (
                <div style={{ padding: 24, textAlign: 'center', color: '#64748B', fontSize: 13 }}>{t('admin.noReferrals')}</div>
              ) : growth.referral_leaderboard.map((r: any, i: number) => (
                <div key={i} style={{ display: 'flex', justifyContent: 'space-between', padding: '10px 16px', borderTop: i === 0 ? 'none' : '1px solid var(--border-subtle)' }}>
                  <span style={{ fontSize: 13, color: 'var(--text-primary)' }}>{r.organization_name}</span>
                  <span style={{ fontSize: 12, color: '#64748B', fontFamily: 'IBM Plex Mono' }}>{r.referred_count} {t('admin.referrals')}</span>
                </div>
              ))}
            </div>
            <p style={{ fontSize: 12, color: '#64748B' }}>{t('admin.marketingNote')}</p>
          </>
        )}

        {tab === 'platform' && platform && (
          <>
            <h2 style={{ fontFamily: 'Syne', fontWeight: 700, fontSize: 16, color: 'var(--text-primary)', marginBottom: 12 }}>{t('admin.systemHealth')}</h2>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: 12, marginBottom: 20 }}>
              <div style={{ background: 'var(--bg-surface)', border: '1px solid var(--border-strong)', borderRadius: 12, padding: 16, display: 'flex', alignItems: 'center', gap: 12 }}>
                <Database size={20} color={platform.health.database_ok ? '#10B981' : '#EF4444'} />
                <div>
                  <div style={{ fontSize: 12, color: 'var(--text-primary)', fontWeight: 600 }}>{t('admin.database')}</div>
                  <div style={{ fontSize: 11, color: platform.health.database_ok ? '#10B981' : '#EF4444' }}>{platform.health.database_ok ? t('admin.online') : t('admin.offline')}</div>
                </div>
              </div>
              <div style={{ background: 'var(--bg-surface)', border: '1px solid var(--border-strong)', borderRadius: 12, padding: 16, display: 'flex', alignItems: 'center', gap: 12 }}>
                <Server size={20} color={platform.health.redis_ok ? '#10B981' : '#EF4444'} />
                <div>
                  <div style={{ fontSize: 12, color: 'var(--text-primary)', fontWeight: 600 }}>Redis</div>
                  <div style={{ fontSize: 11, color: platform.health.redis_ok ? '#10B981' : '#EF4444' }}>{platform.health.redis_ok ? t('admin.online') : t('admin.offline')}</div>
                </div>
              </div>
              <div style={{ background: 'var(--bg-surface)', border: '1px solid var(--border-strong)', borderRadius: 12, padding: 16, display: 'flex', alignItems: 'center', gap: 12 }}>
                <Cpu size={20} color={
                  platform.health.celery_workers_online ? '#10B981'
                    : platform.health.cron_scheduler_configured ? '#64748B'
                    : '#EF4444'
                } />
                <div>
                  <div style={{ fontSize: 12, color: 'var(--text-primary)', fontWeight: 600 }}>{t('admin.workers')}</div>
                  <div style={{ fontSize: 11, color: platform.health.celery_workers_online ? '#10B981' : platform.health.cron_scheduler_configured ? '#64748B' : '#EF4444' }}>
                    {platform.health.celery_workers_online
                      ? `${platform.health.celery_workers_online} ${t('admin.online')}`
                      : platform.health.cron_scheduler_configured
                      ? 'Not deployed — using free cron scheduler'
                      : 'Not configured — nothing is automated'}
                  </div>
                </div>
              </div>
            </div>
            {!platform.health.celery_workers_online && (
              <p style={{ fontSize: 11, color: '#64748B', marginTop: -10, marginBottom: 20, lineHeight: 1.6 }}>
                No paid background-worker service is deployed, so this tile shows 0 by design — that's expected, not a malfunction. Scheduled jobs (outreach sending, lead re-engagement, trial nurture emails, billing reconciliation, and lead research) instead run via <code>/internal/cron/*</code> endpoints, meant to be hit periodically by a free external scheduler like cron-job.org.
                {!platform.health.cron_scheduler_configured && ' CRON_SECRET is not set, though, so none of those scheduled jobs can actually run yet — set it, then point a free scheduler at each /internal/cron/* endpoint.'}
              </p>
            )}

            <h2 style={{ fontFamily: 'Syne', fontWeight: 700, fontSize: 16, color: 'var(--text-primary)', marginBottom: 12, display: 'flex', alignItems: 'center', gap: 8 }}>
              <Plug size={16} color="#FBC02D" /> {t('admin.integrations')}
            </h2>
            <div style={{ display: 'flex', gap: 10, marginBottom: 24, flexWrap: 'wrap' }}>
              {Object.entries(platform.health.integrations).map(([name, ok]: [string, any]) => (
                <span key={name} style={badge(ok ? 'rgba(16,185,129,0.15)' : 'rgba(100,116,139,0.15)', ok ? '#10B981' : '#64748B')}>
                  {name} — {ok ? t('admin.configured') : t('admin.notConfigured')}
                </span>
              ))}
            </div>

            <h2 style={{ fontFamily: 'Syne', fontWeight: 700, fontSize: 16, color: 'var(--text-primary)', marginBottom: 12 }}>{t('admin.aiCallVolume')}</h2>
            <div style={{ background: 'var(--bg-surface)', border: '1px solid var(--border-strong)', borderRadius: 12, padding: 20, marginBottom: 24 }}>
              <MiniBarChart data={platform.ai_calls.trend} valueKey="calls" labelKey="date" />
            </div>

            <h2 style={{ fontFamily: 'Syne', fontWeight: 700, fontSize: 16, color: 'var(--text-primary)', marginBottom: 12, display: 'flex', alignItems: 'center', gap: 8 }}>
              <AlertOctagon size={16} color="#FBC02D" /> {t('admin.recentErrors')}
            </h2>
            <div style={{ background: 'var(--bg-surface)', border: '1px solid var(--border-strong)', borderRadius: 12, overflow: 'hidden' }}>
              {platform.recent_errors.length === 0 ? (
                <div style={{ padding: 24, textAlign: 'center', color: '#64748B', fontSize: 13 }}>{t('admin.noErrors')}</div>
              ) : platform.recent_errors.map((e: any) => (
                <div key={e.id} style={{ padding: '10px 16px', borderBottom: '1px solid var(--border-subtle)' }}>
                  <div style={{ fontSize: 12, color: 'var(--text-primary)', fontFamily: 'IBM Plex Mono' }}>{e.method} {e.path}</div>
                  <div style={{ fontSize: 11, color: '#EF4444' }}>{e.error_message}</div>
                  <div style={{ fontSize: 10, color: '#64748B' }}>{new Date(e.created_at).toLocaleString()}</div>
                </div>
              ))}
            </div>
          </>
        )}

        {tab === 'links' && (
          <>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: 12, marginBottom: 20 }}>
              <div>
                <h2 style={{ fontFamily: 'Syne', fontWeight: 700, fontSize: 16, color: 'var(--text-primary)', marginBottom: 2 }}>Everything you need to run this platform</h2>
                <p style={{ fontSize: 12.5, color: '#64748B' }}>Every dashboard you'll actually log into, plus the links worth sharing.</p>
              </div>
              <Link href="/dashboard/marketing" style={{ textDecoration: 'none' }}>
                <span style={{ display: 'flex', alignItems: 'center', gap: 7, padding: '9px 16px', borderRadius: 8, background: 'rgba(251,192,45,0.1)', border: '1px solid rgba(251,192,45,0.3)', color: '#FBC02D', fontSize: 12.5, fontFamily: 'Syne', fontWeight: 700 }}>
                  <Megaphone size={14} /> Open Marketing Hub
                </span>
              </Link>
            </div>

            <h3 style={sectionTitle}>Service dashboards</h3>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(260px, 1fr))', gap: 10, marginBottom: 28 }}>
              {EXTERNAL_SERVICES.map(svc => (
                <a key={svc.name} href={svc.url} target="_blank" rel="noopener noreferrer" style={{ textDecoration: 'none' }}>
                  <div style={{ display: 'flex', alignItems: 'flex-start', gap: 10, background: 'var(--bg-surface)', border: '1px solid var(--border-strong)', borderRadius: 12, padding: 14, height: '100%' }}>
                    <svc.icon size={16} color="#FBC02D" style={{ flexShrink: 0, marginTop: 2 }} />
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                        <span style={{ fontSize: 13, fontWeight: 700, color: 'var(--text-primary)', fontFamily: 'Syne' }}>{svc.name}</span>
                        <ExternalLink size={11} color="#64748B" />
                      </div>
                      <div style={{ fontSize: 11.5, color: '#64748B', marginTop: 2 }}>{svc.role}</div>
                    </div>
                  </div>
                </a>
              ))}
            </div>

            <h3 style={sectionTitle}>
              <AlertOctagon size={14} color="#FBC02D" /> Fix errors fast
            </h3>
            <div style={{ background: 'var(--bg-surface)', border: '1px solid var(--border-strong)', borderRadius: 12, overflow: 'hidden', marginBottom: 28 }}>
              {!platform ? (
                <div style={{ padding: 20, textAlign: 'center', color: '#64748B', fontSize: 13 }}>Loading...</div>
              ) : platform.recent_errors.length === 0 ? (
                <div style={{ padding: 20, textAlign: 'center', color: '#64748B', fontSize: 13 }}>No recent errors — nothing to fix right now.</div>
              ) : (
                <>
                  {platform.recent_errors.slice(0, 3).map((e: any) => (
                    <div key={e.id} style={{ padding: '10px 16px', borderBottom: '1px solid var(--border-subtle)' }}>
                      <div style={{ fontSize: 12, color: 'var(--text-primary)', fontFamily: 'IBM Plex Mono' }}>{e.method} {e.path}</div>
                      <div style={{ fontSize: 11, color: '#EF4444' }}>{e.error_message}</div>
                      <div style={{ fontSize: 10, color: '#64748B' }}>{new Date(e.created_at).toLocaleString()}</div>
                    </div>
                  ))}
                  <button onClick={() => goTab('platform')} style={{ width: '100%', padding: '10px', background: 'none', border: 'none', borderTop: '1px solid var(--border-subtle)', color: '#FBC02D', fontSize: 12, fontFamily: 'Syne', fontWeight: 600, cursor: 'pointer' }}>
                    View all {platform.recent_errors.length} in Platform &amp; AI Ops →
                  </button>
                </>
              )}
            </div>

            <h3 style={sectionTitle}>Links worth sharing</h3>
            <div style={{ background: 'var(--bg-surface)', border: '1px solid var(--border-strong)', borderRadius: 12, overflow: 'hidden' }}>
              {SHARE_LINKS.map(l => (
                <div key={l.url} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12, padding: '12px 16px', borderBottom: '1px solid var(--border-subtle)' }}>
                  <div style={{ minWidth: 0 }}>
                    <div style={{ fontSize: 12.5, fontWeight: 600, color: 'var(--text-primary)' }}>{l.label}</div>
                    <div style={{ fontSize: 11, color: '#64748B', fontFamily: 'IBM Plex Mono', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{l.url}</div>
                  </div>
                  <button onClick={() => copyLink(l.url)} style={{ display: 'flex', alignItems: 'center', gap: 5, padding: '6px 12px', borderRadius: 6, background: 'rgba(251,192,45,0.1)', border: '1px solid rgba(251,192,45,0.3)', color: '#FBC02D', fontSize: 11.5, fontFamily: 'IBM Plex Mono', cursor: 'pointer', flexShrink: 0 }}>
                    <Copy size={11} /> Copy
                  </button>
                </div>
              ))}
            </div>

            <h3 style={{ ...sectionTitle, marginTop: 28 }}>
              <ShieldCheck size={14} color="#FBC02D" /> Site verification files
            </h3>
            <p style={{ fontSize: 12, color: '#64748B', marginBottom: 12, marginTop: -6 }}>
              Google Search Console, Bing Webmaster Tools, and similar services confirm domain ownership by asking you to host a
              specific file at your site's root. Add it here — it goes live immediately, no deploy needed.
            </p>
            <VerificationFilesPanel />
          </>
        )}

        {tab === 'testimonials' && (
          <>
            <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', flexWrap: 'wrap', gap: 12, marginBottom: 16 }}>
              <div>
                <h2 style={{ fontFamily: 'Syne', fontWeight: 700, fontSize: 16, color: 'var(--text-primary)', marginBottom: 4, display: 'flex', alignItems: 'center', gap: 8 }}>
                  <Star size={16} color="#FBC02D" /> Testimonials
                </h2>
                <p style={{ fontSize: 12.5, color: '#64748B', maxWidth: 560 }}>
                  Add real testimonials only, as you actually collect them from real customers with their permission.
                  New entries start as drafts (unpublished) so you can review before anything goes live on the public site.
                </p>
              </div>
            </div>
            <TestimonialsPanel />
          </>
        )}

        {tab === 'analytics' && businessAnalytics && (
          <>
            <h2 style={{ fontFamily: 'Syne', fontWeight: 700, fontSize: 16, color: 'var(--text-primary)', marginBottom: 12 }}>{t('admin.subscriberGrowth')}</h2>
            <div style={{ background: 'var(--bg-surface)', border: '1px solid var(--border-strong)', borderRadius: 12, padding: 20, marginBottom: 24 }}>
              <MiniBarChart data={businessAnalytics.signup_trend} valueKey="signups" labelKey="month" />
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: 12, marginBottom: 24 }}>
              <KpiCard
                label={t('admin.retention')}
                value={businessAnalytics.retention.retention_rate !== null ? `${businessAnalytics.retention.retention_rate}%` : '—'}
                sub={businessAnalytics.retention.note || `${businessAnalytics.retention.engaged_orgs}/${businessAnalytics.retention.total_active_orgs} ${t('admin.orgsEngaged')}`}
                icon={Activity}
              />
              <KpiCard
                label={t('admin.featureAdoption')}
                value={`${businessAnalytics.feature_adoption.workflow_adoption_rate}%`}
                sub={t('admin.workflowAdoptionSub')}
                icon={Sparkles}
              />
            </div>

            <h2 style={{ fontFamily: 'Syne', fontWeight: 700, fontSize: 16, color: 'var(--text-primary)', marginBottom: 12 }}>{t('admin.planBreakdown')}</h2>
            <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }}>
              {PLANS.map(p => (
                <div key={p} style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '5px 10px', borderRadius: 6, background: `${PLAN_COLOR[p]}15` }}>
                  <div style={{ width: 8, height: 8, borderRadius: '50%', background: PLAN_COLOR[p] }} />
                  <span style={{ fontSize: 11, color: PLAN_COLOR[p], fontFamily: 'IBM Plex Mono' }}>
                    {t(`admin.plan.${p}`)}: {businessAnalytics.orgs_by_plan[p] || 0}
                  </span>
                </div>
              ))}
            </div>
          </>
        )}

        <p style={{ marginTop: 24, fontSize: 11, color: '#475569' }}>{t('admin.note')}</p>
      </div>

      {activityOrg && (
        <div
          onClick={() => setActivityOrg(null)}
          style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.55)', zIndex: 2000, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 20 }}
        >
          <div
            onClick={e => e.stopPropagation()}
            style={{ background: 'var(--bg-surface)', border: '1px solid var(--border-strong)', borderRadius: 14, padding: 24, maxWidth: 640, width: '100%', maxHeight: '85vh', overflowY: 'auto' }}
          >
            <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', marginBottom: 18 }}>
              <div>
                <h2 style={{ fontFamily: 'Syne', fontWeight: 700, fontSize: 17, color: 'var(--text-primary)', marginBottom: 4 }}>{activityOrg.name}</h2>
                <div style={{ fontSize: 12, color: '#64748B' }}>
                  {t(`admin.plan.${activityOrg.plan}`)} · {activityOrg.user_count} {t('admin.usersCol').toLowerCase()} · {activityOrg.property_count} {t('admin.propertiesCol').toLowerCase()}
                </div>
              </div>
              <button onClick={() => setActivityOrg(null)} style={{ background: 'transparent', border: 'none', color: '#64748B', cursor: 'pointer', padding: 4 }}>
                <X size={18} />
              </button>
            </div>

            {loadingActivity ? (
              <p style={{ fontSize: 13, color: '#64748B' }}>{t('admin.loading')}</p>
            ) : orgActivity ? (
              <>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10, marginBottom: 20 }}>
                  <div style={{ background: 'var(--bg-app)', border: '1px solid var(--border-subtle)', borderRadius: 10, padding: 12 }}>
                    <div style={{ fontSize: 20, fontWeight: 700, fontFamily: 'Syne', color: '#FBC02D' }}>{orgActivity.voice_calls_last_30d}</div>
                    <div style={{ fontSize: 11, color: '#64748B' }}>{t('admin.voiceCalls30d')}</div>
                  </div>
                  <div style={{ background: 'var(--bg-app)', border: '1px solid var(--border-subtle)', borderRadius: 10, padding: 12 }}>
                    <div style={{ fontSize: 20, fontWeight: 700, fontFamily: 'Syne', color: '#FBC02D' }}>{orgActivity.maintenance_tickets_last_30d}</div>
                    <div style={{ fontSize: 11, color: '#64748B' }}>{t('admin.tickets30d')}</div>
                  </div>
                </div>

                <div style={{ marginBottom: 20 }}>
                  <div style={{ fontSize: 11, fontFamily: 'IBM Plex Mono', color: '#64748B', marginBottom: 8, letterSpacing: '0.5px' }}>{t('admin.usersTable').toUpperCase()}</div>
                  {orgActivity.users.map((u: any) => (
                    <div key={u.id} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '8px 0', borderBottom: '1px solid var(--border-subtle)', fontSize: 12 }}>
                      <div>
                        <span style={{ color: 'var(--text-primary)', fontWeight: 600 }}>{u.full_name}</span>
                        <span style={{ color: '#64748B', marginLeft: 6 }}>{u.email}</span>
                      </div>
                      <span style={{ color: '#64748B', fontFamily: 'IBM Plex Mono', fontSize: 11 }}>
                        {u.last_login_at ? new Date(u.last_login_at).toLocaleDateString() : t('admin.neverLoggedIn')}
                      </span>
                    </div>
                  ))}
                </div>

                <div style={{ marginBottom: 20 }}>
                  <div style={{ fontSize: 11, fontFamily: 'IBM Plex Mono', color: '#64748B', marginBottom: 8, letterSpacing: '0.5px' }}>{t('admin.billingHistory').toUpperCase()}</div>
                  {orgActivity.events.length === 0 ? (
                    <p style={{ fontSize: 12, color: '#64748B' }}>{t('admin.noEvents')}</p>
                  ) : orgActivity.events.map((e: any, i: number) => (
                    <div key={i} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '7px 0', borderBottom: '1px solid var(--border-subtle)', fontSize: 12 }}>
                      <span style={{ color: 'var(--text-primary)' }}>
                        {e.type}{e.from_plan && e.to_plan ? ` (${e.from_plan} → ${e.to_plan})` : ''}
                      </span>
                      <span style={{ color: '#64748B', fontFamily: 'IBM Plex Mono', fontSize: 11 }}>{new Date(e.created_at).toLocaleDateString()}</span>
                    </div>
                  ))}
                </div>

                <button
                  onClick={cancelSubscription}
                  disabled={cancelingSubscription}
                  style={{ width: '100%', padding: '10px', borderRadius: 8, background: 'rgba(239,68,68,0.1)', border: '1px solid rgba(239,68,68,0.3)', color: '#EF4444', fontSize: 13, fontFamily: 'Syne', fontWeight: 600, cursor: 'pointer' }}
                >
                  {cancelingSubscription ? t('admin.saving') : t('admin.cancelSubscription')}
                </button>
              </>
            ) : (
              <p style={{ fontSize: 13, color: '#64748B' }}>{t('admin.actionFailed')}</p>
            )}
          </div>
        </div>
      )}

      {selectedMessage && (
        <div
          onClick={() => setSelectedMessage(null)}
          style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.55)', zIndex: 2000, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 20 }}
        >
          <div
            onClick={e => e.stopPropagation()}
            style={{ background: 'var(--bg-surface)', border: '1px solid var(--border-strong)', borderRadius: 14, padding: 24, maxWidth: 560, width: '100%', maxHeight: '85vh', overflowY: 'auto' }}
          >
            <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', marginBottom: 16 }}>
              <div>
                <h2 style={{ fontFamily: 'Syne', fontWeight: 700, fontSize: 17, color: 'var(--text-primary)', marginBottom: 4 }}>{selectedMessage.subject}</h2>
                <div style={{ fontSize: 12, color: '#64748B' }}>
                  {selectedMessage.sender_name || '—'} · {selectedMessage.sender_email || 'no email on file'}
                  {selectedMessage.organization_name && ` · ${selectedMessage.organization_name}`}
                </div>
                <div style={{ fontSize: 11, color: '#475569', marginTop: 2, fontFamily: 'IBM Plex Mono' }}>{new Date(selectedMessage.created_at).toLocaleString()}</div>
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                <button onClick={async () => {
                  if (!confirm('Delete this message? This can\'t be undone.')) return;
                  try {
                    await adminApi.deleteMessage(selectedMessage.id);
                    setMessages(prev => prev.filter(m => m.id !== selectedMessage.id));
                    setSelectedMessage(null);
                    toast.success('Message deleted');
                  } catch {
                    toast.error('Failed to delete');
                  }
                }} title="Delete message" style={{ background: 'rgba(239,68,68,0.1)', border: '1px solid rgba(239,68,68,0.3)', color: '#EF4444', cursor: 'pointer', padding: 6, borderRadius: 6, display: 'flex', alignItems: 'center' }}>
                  <Trash2 size={14} />
                </button>
                <button onClick={() => setSelectedMessage(null)} style={{ background: 'transparent', border: 'none', color: '#64748B', cursor: 'pointer', padding: 4 }}>
                  <X size={18} />
                </button>
              </div>
            </div>

            <div style={{ background: 'var(--bg-app)', border: '1px solid var(--border-subtle)', borderRadius: 10, padding: 16, fontSize: 13, color: 'var(--text-primary)', lineHeight: 1.6, whiteSpace: 'pre-wrap', marginBottom: 18 }}>
              {selectedMessage.body}
            </div>

            {selectedMessage.email_status !== 'sent' && selectedMessage.email_error && (
              <div style={{ marginBottom: 18, background: 'rgba(239,68,68,0.08)', border: '1px solid rgba(239,68,68,0.25)', borderRadius: 10, padding: '12px 14px' }}>
                <div style={{ fontSize: 11, fontFamily: 'IBM Plex Mono', color: '#EF4444', marginBottom: 4, letterSpacing: '0.5px' }}>
                  EMAIL DELIVERY ERROR ({selectedMessage.email_status})
                </div>
                <div style={{ fontSize: 12, color: 'var(--text-secondary)', fontFamily: 'IBM Plex Mono', wordBreak: 'break-word' }}>
                  {selectedMessage.email_error}
                </div>
              </div>
            )}

            {selectedMessage.reply_body && (
              <div style={{ marginBottom: 18 }}>
                <div style={{ fontSize: 11, fontFamily: 'IBM Plex Mono', color: '#64748B', marginBottom: 6, letterSpacing: '0.5px' }}>
                  YOUR REPLY {selectedMessage.replied_at && `· ${new Date(selectedMessage.replied_at).toLocaleString()}`}
                  {selectedMessage.reply_status && selectedMessage.reply_status !== 'sent' && (
                    <span style={{ color: '#EF4444', marginLeft: 6 }}>(not delivered — {selectedMessage.reply_status})</span>
                  )}
                </div>
                <div style={{ background: 'rgba(251,192,45,0.06)', border: '1px solid rgba(251,192,45,0.2)', borderRadius: 10, padding: 16, fontSize: 13, color: 'var(--text-secondary)', lineHeight: 1.6, whiteSpace: 'pre-wrap' }}>
                  {selectedMessage.reply_body}
                </div>
                {selectedMessage.reply_status !== 'sent' && selectedMessage.reply_error && (
                  <div style={{ marginTop: 8, fontSize: 11, color: '#EF4444', fontFamily: 'IBM Plex Mono', wordBreak: 'break-word' }}>
                    {selectedMessage.reply_error}
                  </div>
                )}
              </div>
            )}

            {selectedMessage.sender_email ? (
              <div>
                <label style={{ display: 'block', marginBottom: 6, fontSize: 12, fontFamily: 'IBM Plex Mono', color: 'var(--text-secondary)' }}>
                  {selectedMessage.reply_body ? 'Send another reply' : 'Reply'}
                </label>
                <textarea
                  value={replyText}
                  onChange={e => setReplyText(e.target.value)}
                  placeholder={`Reply to ${selectedMessage.sender_name || selectedMessage.sender_email}...`}
                  style={{ width: '100%', minHeight: 110, padding: '10px 12px', background: 'var(--bg-app)', border: '1px solid var(--border-input)', borderRadius: 8, color: 'var(--text-primary)', fontSize: 13, fontFamily: 'IBM Plex Sans', outline: 'none', resize: 'vertical', boxSizing: 'border-box' }}
                />
                <button
                  onClick={sendReply}
                  disabled={sendingReply || !replyText.trim()}
                  style={{
                    display: 'flex', alignItems: 'center', gap: 8, marginTop: 12, padding: '10px 20px',
                    background: 'linear-gradient(135deg, #FBC02D, #F57F17)', color: 'var(--bg-app)',
                    fontWeight: 700, fontFamily: 'Syne', border: 'none', borderRadius: 8,
                    cursor: sendingReply || !replyText.trim() ? 'default' : 'pointer', fontSize: 13,
                    opacity: sendingReply || !replyText.trim() ? 0.6 : 1,
                  }}
                >
                  <Send size={14} /> {sendingReply ? 'Sending...' : 'Send Reply'}
                </button>
              </div>
            ) : (
              <p style={{ fontSize: 12, color: '#64748B', fontStyle: 'italic' }}>No sender email on file — can't reply directly to this message.</p>
            )}
          </div>
        </div>
      )}

      {revenueModal && revenue && (
        <div
          onClick={() => setRevenueModal(null)}
          style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.55)', zIndex: 2000, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 20 }}
        >
          <div
            onClick={e => e.stopPropagation()}
            style={{ background: 'var(--bg-surface)', border: '1px solid var(--border-strong)', borderRadius: 14, padding: 24, maxWidth: 520, width: '100%', maxHeight: '85vh', overflowY: 'auto' }}
          >
            <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', marginBottom: 18 }}>
              <h2 style={{ fontFamily: 'Syne', fontWeight: 700, fontSize: 17, color: 'var(--text-primary)' }}>
                {revenueModal === 'mrr' ? 'MRR Breakdown' : revenueModal === 'arr' ? 'ARR Breakdown' : 'ARPU Breakdown'}
              </h2>
              <button onClick={() => setRevenueModal(null)} style={{ background: 'transparent', border: 'none', color: '#64748B', cursor: 'pointer', padding: 4 }}>
                <X size={18} />
              </button>
            </div>

            {revenueModal === 'mrr' && (
              <>
                <div style={{ background: 'var(--bg-app)', border: '1px solid var(--border-subtle)', borderRadius: 10, overflow: 'hidden', marginBottom: 14 }}>
                  <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                    <thead>
                      <tr style={{ borderBottom: '1px solid var(--border-strong)' }}>
                        {['Plan', 'Orgs', 'Price / org', 'Subtotal'].map(h => (
                          <th key={h} style={{ padding: '8px 12px', textAlign: h === 'Plan' ? 'left' : 'right', fontSize: 10, fontFamily: 'IBM Plex Mono', color: '#64748B', letterSpacing: '0.5px' }}>{h}</th>
                        ))}
                      </tr>
                    </thead>
                    <tbody>
                      {revenue.mrr_breakdown.map((row: any) => (
                        <tr key={row.plan} style={{ borderBottom: '1px solid var(--border-subtle)' }}>
                          <td style={{ padding: '8px 12px', fontSize: 12, color: 'var(--text-primary)', textTransform: 'capitalize' }}>{row.plan}</td>
                          <td style={{ padding: '8px 12px', fontSize: 12, color: 'var(--text-secondary)', textAlign: 'right', fontFamily: 'IBM Plex Mono' }}>{row.org_count}</td>
                          <td style={{ padding: '8px 12px', fontSize: 12, color: 'var(--text-secondary)', textAlign: 'right', fontFamily: 'IBM Plex Mono' }}>{formatMoney(row.price_per_org)}</td>
                          <td style={{ padding: '8px 12px', fontSize: 12, color: 'var(--text-primary)', textAlign: 'right', fontFamily: 'IBM Plex Mono', fontWeight: 600 }}>{formatMoney(row.subtotal)}</td>
                        </tr>
                      ))}
                    </tbody>
                    <tfoot>
                      <tr>
                        <td colSpan={3} style={{ padding: '10px 12px', fontSize: 12, color: 'var(--text-primary)', fontWeight: 700, fontFamily: 'Syne' }}>Total MRR</td>
                        <td style={{ padding: '10px 12px', fontSize: 14, color: '#FBC02D', textAlign: 'right', fontFamily: 'IBM Plex Mono', fontWeight: 700 }}>{formatMoney(revenue.mrr)}</td>
                      </tr>
                    </tfoot>
                  </table>
                </div>
                <p style={{ fontSize: 11, color: '#64748B', lineHeight: 1.6 }}>{revenue.mrr_methodology_note}</p>
              </>
            )}

            {revenueModal === 'arr' && (
              <>
                <div style={{ background: 'var(--bg-app)', border: '1px solid var(--border-subtle)', borderRadius: 10, padding: 18, marginBottom: 14, textAlign: 'center' }}>
                  <div style={{ fontSize: 15, fontFamily: 'IBM Plex Mono', color: 'var(--text-primary)' }}>
                    {formatMoney(revenue.mrr)} <span style={{ color: '#64748B' }}>MRR</span> × 12 months
                  </div>
                  <div style={{ fontSize: 22, fontFamily: 'IBM Plex Mono', fontWeight: 700, color: '#FBC02D', marginTop: 8 }}>
                    = {formatMoney(revenue.arr)}
                  </div>
                </div>
                <p style={{ fontSize: 11, color: '#64748B', lineHeight: 1.6 }}>
                  ARR is Monthly Recurring Revenue annualized — it assumes the current MRR holds steady for 12 months, so it moves exactly in step with MRR. See the MRR card for how that figure itself is built up.
                </p>
              </>
            )}

            {revenueModal === 'arpu' && (
              <>
                <div style={{ background: 'var(--bg-app)', border: '1px solid var(--border-subtle)', borderRadius: 10, padding: 18, marginBottom: 14, textAlign: 'center' }}>
                  <div style={{ fontSize: 15, fontFamily: 'IBM Plex Mono', color: 'var(--text-primary)' }}>
                    {formatMoney(revenue.mrr)} <span style={{ color: '#64748B' }}>MRR</span> ÷ {revenue.active_subscriber_count} active org{revenue.active_subscriber_count === 1 ? '' : 's'}
                  </div>
                  <div style={{ fontSize: 22, fontFamily: 'IBM Plex Mono', fontWeight: 700, color: '#FBC02D', marginTop: 8 }}>
                    = {formatMoney(revenue.arpu)}
                  </div>
                </div>
                <p style={{ fontSize: 11, color: '#64748B', lineHeight: 1.6 }}>
                  ARPU (Average Revenue Per User/org) is total MRR spread evenly across every currently active organization, regardless of which plan each one is actually on.
                </p>
              </>
            )}
          </div>
        </div>
      )}
    </DashboardLayout>
  );
}

function VerificationFilesPanel() {
  const [files, setFiles] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [showAdd, setShowAdd] = useState(false);
  const [filename, setFilename] = useState('');
  const [content, setContent] = useState('');
  const [saving, setSaving] = useState(false);

  const load = () => {
    adminApi.listVerificationFiles().then(r => setFiles(r.data || [])).catch(() => {}).finally(() => setLoading(false));
  };
  useEffect(() => { load(); }, []);

  const add = async () => {
    if (!filename.trim() || !content.trim()) { toast.error('Filename and content are both required'); return; }
    setSaving(true);
    try {
      await adminApi.createVerificationFile(filename.trim(), content);
      toast.success('Verification file added — live now');
      setFilename(''); setContent(''); setShowAdd(false);
      load();
    } catch (err: any) {
      toast.error(err?.response?.data?.detail || 'Failed to add');
    } finally {
      setSaving(false);
    }
  };

  const remove = async (id: string) => {
    try {
      await adminApi.deleteVerificationFile(id);
      setFiles(prev => prev.filter(f => f.id !== id));
    } catch {
      toast.error('Failed to delete');
    }
  };

  return (
    <div style={{ background: 'var(--bg-surface)', border: '1px solid var(--border-strong)', borderRadius: 12, overflow: 'hidden' }}>
      {loading ? (
        <div style={{ padding: 20, textAlign: 'center', color: '#64748B', fontSize: 13 }}>Loading...</div>
      ) : files.length === 0 && !showAdd ? (
        <div style={{ padding: 20, textAlign: 'center', color: '#64748B', fontSize: 13 }}>No verification files yet.</div>
      ) : (
        files.map(f => (
          <div key={f.id} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12, padding: '12px 16px', borderBottom: '1px solid var(--border-subtle)' }}>
            <div style={{ minWidth: 0 }}>
              <div style={{ fontSize: 12.5, fontWeight: 600, color: 'var(--text-primary)', fontFamily: 'IBM Plex Mono' }}>{f.filename}</div>
              <div style={{ fontSize: 11, color: '#64748B', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{SITE_URL}/{f.filename}</div>
            </div>
            <div style={{ display: 'flex', gap: 8, flexShrink: 0 }}>
              <button onClick={() => copyLink(`${SITE_URL}/${f.filename}`)} style={{ display: 'flex', alignItems: 'center', gap: 5, padding: '6px 10px', borderRadius: 6, background: 'var(--bg-app)', border: '1px solid var(--border-strong)', color: 'var(--text-secondary)', fontSize: 11.5, fontFamily: 'IBM Plex Mono', cursor: 'pointer' }}>
                <Copy size={11} /> Copy URL
              </button>
              <button onClick={() => remove(f.id)} title="Delete" style={{ display: 'flex', alignItems: 'center', padding: '6px 10px', borderRadius: 6, background: 'rgba(239,68,68,0.1)', border: '1px solid rgba(239,68,68,0.3)', color: '#EF4444', cursor: 'pointer' }}>
                <Trash2 size={12} />
              </button>
            </div>
          </div>
        ))
      )}

      {showAdd ? (
        <div style={{ padding: 16, borderTop: files.length > 0 ? '1px solid var(--border-subtle)' : 'none' }}>
          <label style={{ display: 'block', marginBottom: 5, fontSize: 11, fontFamily: 'IBM Plex Mono', color: '#64748B' }}>Filename (e.g. google1234567890.html)</label>
          <input value={filename} onChange={e => setFilename(e.target.value)} placeholder="google1234567890.html"
            style={{ width: '100%', padding: '8px 12px', background: 'var(--bg-app)', border: '1px solid var(--border-input)', borderRadius: 8, color: 'var(--text-primary)', fontSize: 13, fontFamily: 'IBM Plex Mono', outline: 'none', boxSizing: 'border-box', marginBottom: 12 }} />
          <label style={{ display: 'block', marginBottom: 5, fontSize: 11, fontFamily: 'IBM Plex Mono', color: '#64748B' }}>File contents (paste exactly what the service gave you)</label>
          <textarea value={content} onChange={e => setContent(e.target.value)} placeholder="google-site-verification: google1234567890.html"
            style={{ width: '100%', height: 70, padding: '8px 12px', background: 'var(--bg-app)', border: '1px solid var(--border-input)', borderRadius: 8, color: 'var(--text-primary)', fontSize: 12.5, fontFamily: 'IBM Plex Mono', outline: 'none', boxSizing: 'border-box', resize: 'none', marginBottom: 12 }} />
          <div style={{ display: 'flex', gap: 8 }}>
            <button onClick={add} disabled={saving} style={{ padding: '8px 16px', borderRadius: 8, background: 'linear-gradient(135deg, #FBC02D, #F57F17)', color: 'var(--bg-app)', fontWeight: 700, fontFamily: 'Syne', fontSize: 12.5, border: 'none', cursor: 'pointer' }}>
              {saving ? 'Adding...' : 'Add file'}
            </button>
            <button onClick={() => setShowAdd(false)} style={{ padding: '8px 16px', borderRadius: 8, background: 'none', border: '1px solid var(--border-strong)', color: 'var(--text-secondary)', fontSize: 12.5, fontFamily: 'Syne', cursor: 'pointer' }}>
              Cancel
            </button>
          </div>
        </div>
      ) : (
        <button onClick={() => setShowAdd(true)} style={{ width: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6, padding: '12px', background: 'none', border: 'none', borderTop: files.length > 0 ? '1px solid var(--border-subtle)' : 'none', color: '#FBC02D', fontSize: 12.5, fontFamily: 'Syne', fontWeight: 600, cursor: 'pointer' }}>
          <Plus size={13} /> Add verification file
        </button>
      )}
    </div>
  );
}

const testimonialLabelStyle: React.CSSProperties = { display: 'block', marginBottom: 5, marginTop: 12, fontSize: 11, fontFamily: 'IBM Plex Mono', color: '#64748B' };
const testimonialInputStyle: React.CSSProperties = { width: '100%', padding: '9px 12px', background: 'var(--bg-app)', border: '1px solid var(--border-input)', borderRadius: 8, color: 'var(--text-primary)', fontSize: 13, fontFamily: 'IBM Plex Sans', outline: 'none', boxSizing: 'border-box' };

const emptyTestimonialForm = { customer_name: '', customer_title: '', quote_text: '', rating: '', display_order: 0, is_published: false };

function TestimonialsPanel() {
  const [testimonials, setTestimonials] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [modalOpen, setModalOpen] = useState(false);
  const [editing, setEditing] = useState<any>(null); // null = adding a new one
  const [form, setForm] = useState(emptyTestimonialForm);
  const [saving, setSaving] = useState(false);

  const load = () => {
    adminApi.listTestimonials().then(r => setTestimonials(r.data || [])).catch(() => {}).finally(() => setLoading(false));
  };
  useEffect(() => { load(); }, []);

  const openNew = () => {
    setEditing(null);
    setForm(emptyTestimonialForm);
    setModalOpen(true);
  };

  const openEdit = (t: any) => {
    setEditing(t);
    setForm({
      customer_name: t.customer_name,
      customer_title: t.customer_title || '',
      quote_text: t.quote_text,
      rating: t.rating != null ? String(t.rating) : '',
      display_order: t.display_order,
      is_published: t.is_published,
    });
    setModalOpen(true);
  };

  const save = async () => {
    if (!form.customer_name.trim() || !form.quote_text.trim()) {
      toast.error('Customer name and quote are both required');
      return;
    }
    setSaving(true);
    const payload = {
      customer_name: form.customer_name.trim(),
      customer_title: form.customer_title.trim() || undefined,
      quote_text: form.quote_text.trim(),
      rating: form.rating ? Number(form.rating) : null,
      display_order: Number(form.display_order) || 0,
      is_published: form.is_published,
    };
    try {
      if (editing) {
        const res = await adminApi.updateTestimonial(editing.id, payload);
        setTestimonials(prev => prev.map(t => (t.id === editing.id ? res.data : t)));
        toast.success('Testimonial updated');
      } else {
        const res = await adminApi.createTestimonial(payload as any);
        setTestimonials(prev => [...prev, res.data]);
        toast.success('Testimonial added');
      }
      setModalOpen(false);
    } catch (err: any) {
      toast.error(err?.response?.data?.detail || 'Failed to save');
    } finally {
      setSaving(false);
    }
  };

  const togglePublish = async (t: any) => {
    try {
      const res = await adminApi.updateTestimonial(t.id, { is_published: !t.is_published });
      setTestimonials(prev => prev.map(x => (x.id === t.id ? res.data : x)));
      toast.success(res.data.is_published ? 'Published — now visible on the public site' : 'Unpublished');
    } catch {
      toast.error('Failed to update');
    }
  };

  const remove = async (id: string) => {
    if (!confirm("Delete this testimonial? This can't be undone.")) return;
    try {
      await adminApi.deleteTestimonial(id);
      setTestimonials(prev => prev.filter(t => t.id !== id));
      toast.success('Deleted');
    } catch {
      toast.error('Failed to delete');
    }
  };

  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'flex-end', marginBottom: 12 }}>
        <button onClick={openNew} style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '8px 14px', borderRadius: 8, background: 'linear-gradient(135deg, #FBC02D, #F57F17)', color: 'var(--bg-app)', fontWeight: 700, fontFamily: 'Syne', fontSize: 12.5, border: 'none', cursor: 'pointer' }}>
          <Plus size={13} /> Add testimonial
        </button>
      </div>

      <div style={{ background: 'var(--bg-surface)', border: '1px solid var(--border-strong)', borderRadius: 12, overflow: 'hidden' }}>
        {loading ? (
          <div style={{ padding: 20, textAlign: 'center', color: '#64748B', fontSize: 13 }}>Loading...</div>
        ) : testimonials.length === 0 ? (
          <div style={{ padding: 24, textAlign: 'center', color: '#64748B', fontSize: 13 }}>
            No testimonials yet. Add one once you have a real quote from a real customer, with their permission.
          </div>
        ) : (
          <div style={{ overflowX: 'auto' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', minWidth: 760 }}>
              <thead>
                <tr style={{ borderBottom: '1px solid var(--border-strong)' }}>
                  {['Customer', 'Quote', 'Rating', 'Order', 'Status', ''].map(h => (
                    <th key={h} style={{ padding: '10px 14px', textAlign: 'left', fontSize: 10, fontFamily: 'IBM Plex Mono', color: '#64748B', letterSpacing: '0.5px', whiteSpace: 'nowrap' }}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {testimonials.map(t => (
                  <tr key={t.id} style={{ borderBottom: '1px solid var(--border-subtle)' }}>
                    <td style={{ padding: '10px 14px', fontSize: 13, color: 'var(--text-primary)', fontWeight: 600 }}>
                      {t.customer_name}
                      {t.customer_title && <div style={{ fontSize: 11, color: '#64748B', fontWeight: 400 }}>{t.customer_title}</div>}
                    </td>
                    <td style={{ padding: '10px 14px', fontSize: 12, color: 'var(--text-secondary)', maxWidth: 320, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{t.quote_text}</td>
                    <td style={{ padding: '10px 14px', fontSize: 12, color: '#FBC02D', whiteSpace: 'nowrap' }}>{t.rating ? '★'.repeat(t.rating) + '☆'.repeat(5 - t.rating) : '—'}</td>
                    <td style={{ padding: '10px 14px', fontSize: 12, color: 'var(--text-secondary)', fontFamily: 'IBM Plex Mono' }}>{t.display_order}</td>
                    <td style={{ padding: '10px 14px' }}>
                      <button
                        onClick={() => togglePublish(t)}
                        style={{ ...badge(t.is_published ? 'rgba(16,185,129,0.15)' : 'rgba(100,116,139,0.15)', t.is_published ? '#10B981' : '#64748B'), cursor: 'pointer', border: 'none' }}
                      >
                        {t.is_published ? 'Published' : 'Draft'}
                      </button>
                    </td>
                    <td style={{ padding: '10px 14px' }}>
                      <div style={{ display: 'flex', gap: 6 }}>
                        <button onClick={() => openEdit(t)} style={{ padding: '5px 9px', borderRadius: 6, background: 'var(--bg-app)', border: '1px solid var(--border-strong)', color: 'var(--text-secondary)', fontSize: 11, fontFamily: 'IBM Plex Mono', cursor: 'pointer' }}>Edit</button>
                        <button onClick={() => remove(t.id)} title="Delete" style={{ display: 'flex', alignItems: 'center', padding: '5px 9px', borderRadius: 6, background: 'rgba(239,68,68,0.1)', border: '1px solid rgba(239,68,68,0.3)', color: '#EF4444', cursor: 'pointer' }}>
                          <Trash2 size={12} />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {modalOpen && (
        <div
          onClick={() => setModalOpen(false)}
          style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.55)', zIndex: 2000, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 20 }}
        >
          <div
            onClick={e => e.stopPropagation()}
            style={{ background: 'var(--bg-surface)', border: '1px solid var(--border-strong)', borderRadius: 14, padding: 24, maxWidth: 480, width: '100%', maxHeight: '85vh', overflowY: 'auto' }}
          >
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 4 }}>
              <h2 style={{ fontFamily: 'Syne', fontWeight: 700, fontSize: 16, color: 'var(--text-primary)' }}>{editing ? 'Edit testimonial' : 'Add testimonial'}</h2>
              <button onClick={() => setModalOpen(false)} style={{ background: 'transparent', border: 'none', color: '#64748B', cursor: 'pointer', padding: 4 }}>
                <X size={18} />
              </button>
            </div>

            <label style={testimonialLabelStyle}>Customer name</label>
            <input value={form.customer_name} onChange={e => setForm({ ...form, customer_name: e.target.value })} style={testimonialInputStyle} />

            <label style={testimonialLabelStyle}>Title / company (optional)</label>
            <input value={form.customer_title} onChange={e => setForm({ ...form, customer_title: e.target.value })} placeholder="e.g. Owner, Sunset Properties" style={testimonialInputStyle} />

            <label style={testimonialLabelStyle}>Quote</label>
            <textarea value={form.quote_text} onChange={e => setForm({ ...form, quote_text: e.target.value })} style={{ ...testimonialInputStyle, minHeight: 90, resize: 'vertical' }} />

            <div style={{ display: 'flex', gap: 12 }}>
              <div style={{ flex: 1 }}>
                <label style={testimonialLabelStyle}>Rating (optional)</label>
                <select value={form.rating} onChange={e => setForm({ ...form, rating: e.target.value })} style={testimonialInputStyle}>
                  <option value="">No rating</option>
                  {[1, 2, 3, 4, 5].map(n => <option key={n} value={n}>{n} star{n > 1 ? 's' : ''}</option>)}
                </select>
              </div>
              <div style={{ flex: 1 }}>
                <label style={testimonialLabelStyle}>Display order</label>
                <input type="number" value={form.display_order} onChange={e => setForm({ ...form, display_order: Number(e.target.value) })} style={testimonialInputStyle} />
              </div>
            </div>

            <label style={{ display: 'flex', alignItems: 'center', gap: 8, marginTop: 16, marginBottom: 18, cursor: 'pointer' }}>
              <input type="checkbox" checked={form.is_published} onChange={e => setForm({ ...form, is_published: e.target.checked })} />
              <span style={{ fontSize: 12.5, color: 'var(--text-secondary)' }}>Published (visible on the public site)</span>
            </label>

            <button
              onClick={save}
              disabled={saving}
              style={{ width: '100%', padding: '10px', borderRadius: 8, background: 'linear-gradient(135deg, #FBC02D, #F57F17)', color: 'var(--bg-app)', fontWeight: 700, fontFamily: 'Syne', fontSize: 13, border: 'none', cursor: saving ? 'default' : 'pointer', opacity: saving ? 0.6 : 1 }}
            >
              {saving ? 'Saving...' : editing ? 'Save changes' : 'Add testimonial'}
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
