import { useEffect, useState } from 'react';
import DashboardLayout from '../../components/DashboardLayout';
import Link from 'next/link';
import {
  Sparkles, UserSearch, Wrench, Landmark, ShieldCheck, Phone, Boxes, TrendingUp,
  Lock, ArrowUpRight, CheckCircle2, XCircle, ClipboardCheck,
} from 'lucide-react';
import { aiWorkforce as workforceApi, inquiries as inquiriesApi } from '../../lib/api';
import { getUser } from '../../lib/auth';
import { hasPlanAccess, PlanTier } from '../../components/PlanLock';
import { useLanguage } from '../../lib/LanguageContext';
import toast from 'react-hot-toast';

const AGENT_ICON: Record<string, any> = {
  leasing: UserSearch, maintenance: Wrench, accounting: Landmark, compliance: ShieldCheck,
  voice: Phone, executive: Sparkles, portfolio: Boxes, sales: TrendingUp,
};

function AgentCard({ agent }: { agent: any }) {
  const { t } = useLanguage();
  const Icon = AGENT_ICON[agent.key] || Sparkles;
  const locked = agent.min_tier && !hasPlanAccess(agent.min_tier as PlanTier);

  return (
    <div style={{
      background: 'var(--bg-surface)', border: '1px solid var(--border-strong)', borderRadius: 12,
      padding: 20, display: 'flex', flexDirection: 'column', gap: 14, opacity: locked ? 0.72 : 1,
    }}>
      <div style={{ display: 'flex', alignItems: 'flex-start', gap: 12, flexWrap: 'wrap' }}>
        <div style={{ width: 40, height: 40, borderRadius: 10, background: 'rgba(251,192,45,0.12)', border: '1px solid rgba(251,192,45,0.3)', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
          <Icon size={19} color="#FBC02D" />
        </div>
        <div style={{ flex: 1, minWidth: 140 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
            <h3 style={{ fontFamily: 'Syne', fontWeight: 700, fontSize: 15, color: 'var(--text-primary)' }}>{agent.name}</h3>
            {locked ? (
              <span style={{ display: 'flex', alignItems: 'center', gap: 3, fontSize: 10, padding: '2px 7px', borderRadius: 4, background: 'rgba(100,116,139,0.15)', color: 'var(--text-faint)', fontFamily: 'IBM Plex Mono' }}>
                <Lock size={9} /> {agent.min_tier === 'enterprise' ? t('aiWorkforce.tierEnterprise') : t('aiWorkforce.tierProfessional')}
              </span>
            ) : (
              <span style={{ display: 'flex', alignItems: 'center', gap: 4, fontSize: 10, padding: '2px 7px', borderRadius: 4, background: 'rgba(16,185,129,0.12)', color: '#10B981', fontFamily: 'IBM Plex Mono' }}>
                <span style={{ width: 5, height: 5, borderRadius: '50%', background: '#10B981' }} /> {t('aiWorkforce.active')}
              </span>
            )}
          </div>
          <p style={{ color: 'var(--text-muted)', fontSize: 12.5, fontFamily: 'IBM Plex Sans', marginTop: 4, lineHeight: 1.5 }}>{agent.description}</p>
        </div>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: `repeat(${(agent.stats || []).length || 1}, 1fr)`, gap: 8 }}>
        {(agent.stats || []).map((s: any) => (
          <div key={s.label} style={{ background: 'var(--bg-app)', border: '1px solid var(--border-input)', borderRadius: 8, padding: '10px 10px' }}>
            <div style={{ fontFamily: 'IBM Plex Mono', fontSize: 17, fontWeight: 600, color: 'var(--text-primary)' }}>{s.value}</div>
            <div style={{ fontSize: 10, color: 'var(--text-muted)', fontFamily: 'IBM Plex Mono', marginTop: 2, lineHeight: 1.3 }}>{s.label}</div>
          </div>
        ))}
      </div>

      {locked ? (
        <Link href="/pricing" style={{ textDecoration: 'none', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6, padding: '9px 0', borderRadius: 8, background: 'rgba(251,192,45,0.08)', border: '1px solid rgba(251,192,45,0.25)', color: '#FBC02D', fontSize: 12.5, fontWeight: 600, fontFamily: 'Syne' }}>
          {t('aiWorkforce.upgradeToUnlock')}
        </Link>
      ) : (
        <Link href={agent.link} style={{ textDecoration: 'none', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6, padding: '9px 0', borderRadius: 8, background: 'var(--bg-app)', border: '1px solid var(--border-strong)', color: 'var(--text-secondary)', fontSize: 12.5, fontWeight: 600, fontFamily: 'Syne' }}>
          {t('aiWorkforce.openAgent')} <ArrowUpRight size={13} />
        </Link>
      )}
    </div>
  );
}

export default function AIWorkforce() {
  const { t } = useLanguage();
  const [agents, setAgents] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [queue, setQueue] = useState<any[]>([]);
  const [queueLoading, setQueueLoading] = useState(true);
  const [actingId, setActingId] = useState<string | null>(null);
  const [orgName, setOrgName] = useState('');

  useEffect(() => {
    setOrgName(getUser()?.org_name || '');
    workforceApi.summary().then(r => setAgents(r.data.agents || [])).catch(() => {}).finally(() => setLoading(false));
    inquiriesApi.list().then(r => {
      const pending = (r.data || []).filter((i: any) =>
        i.screening_approved !== null && i.screening_approved !== undefined &&
        !['converted', 'closed'].includes(i.status)
      );
      setQueue(pending);
    }).catch(() => {}).finally(() => setQueueLoading(false));
  }, []);

  const approve = async (id: string) => {
    setActingId(id);
    try {
      await inquiriesApi.convertToTenant(id);
      setQueue(prev => prev.filter(i => i.id !== id));
      toast.success(t('aiWorkforce.toast.approved'));
    } catch (err: any) {
      toast.error(err?.response?.data?.detail || t('aiWorkforce.toast.convertFailed'));
    } finally {
      setActingId(null);
    }
  };

  const decline = async (id: string) => {
    setActingId(id);
    try {
      await inquiriesApi.update(id, { status: 'closed' });
      setQueue(prev => prev.filter(i => i.id !== id));
      toast.success(t('aiWorkforce.toast.declined'));
    } catch {
      toast.error(t('aiWorkforce.toast.declineFailed'));
    } finally {
      setActingId(null);
    }
  };

  return (
    <DashboardLayout>
      <div style={{ maxWidth: 1100 }}>
        <div style={{ marginBottom: 28 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <Sparkles size={24} color="#FBC02D" />
            <h1 style={{ fontFamily: 'Syne', fontWeight: 800, fontSize: 28, color: 'var(--text-primary)' }}>{t('aiWorkforce.title')}</h1>
          </div>
          <p style={{ color: 'var(--text-muted)', fontSize: 14, marginTop: 4 }}>
            {t('aiWorkforce.subtitle', { org: orgName ? ` — ${orgName}` : '' })}
          </p>
        </div>

        {/* Action Center */}
        <div style={{ background: 'var(--bg-surface)', border: '1px solid var(--border-strong)', borderRadius: 12, overflow: 'hidden', marginBottom: 28 }}>
          <div style={{ padding: '16px 20px', borderBottom: '1px solid var(--border-strong)', display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
            <ClipboardCheck size={16} color="#FBC02D" />
            <h3 style={{ fontFamily: 'Syne', fontWeight: 700, fontSize: 15, color: 'var(--text-primary)' }}>{t('aiWorkforce.actionCenter')}</h3>
            <span style={{ fontSize: 11, color: 'var(--text-muted)', fontFamily: 'IBM Plex Sans' }}>{t('aiWorkforce.actionCenterHint')}</span>
          </div>
          {queueLoading ? (
            <div style={{ padding: '28px 20px', textAlign: 'center', color: 'var(--text-muted)', fontSize: 13 }}>{t('aiWorkforce.loading')}</div>
          ) : queue.length === 0 ? (
            <div style={{ padding: '28px 20px', textAlign: 'center', color: 'var(--text-muted)', fontSize: 13, fontFamily: 'IBM Plex Sans' }}>
              {t('aiWorkforce.nothingWaiting')}
            </div>
          ) : (
            <div>
              {queue.map(inq => (
                <div key={inq.id} style={{ padding: '14px 20px', borderBottom: '1px solid var(--border-subtle)', display: 'flex', alignItems: 'center', gap: 14, flexWrap: 'wrap' }}>
                  <div style={{ flex: 1, minWidth: 200 }}>
                    <div style={{ fontSize: 13.5, fontFamily: 'IBM Plex Sans', color: 'var(--text-primary)', fontWeight: 600 }}>
                      {inq.first_name} {inq.last_name}
                      <span style={{ color: 'var(--text-muted)', fontWeight: 400 }}> — {inq.property_name}{inq.unit_number ? ` #${inq.unit_number}` : ''}</span>
                    </div>
                    <div style={{ fontSize: 12, color: 'var(--text-muted)', fontFamily: 'IBM Plex Sans', marginTop: 3 }}>
                      {t('aiWorkforce.aiRecommendation')}{inq.screening_approved ? (
                        <span style={{ color: '#10B981', fontWeight: 600 }}>{t('aiWorkforce.approve')}</span>
                      ) : (
                        <span style={{ color: '#EF4444', fontWeight: 600 }}>{t('aiWorkforce.decline')}</span>
                      )}
                      {inq.screening_score != null && <span>{t('aiWorkforce.score', { score: Math.round(inq.screening_score) })}</span>}
                    </div>
                  </div>
                  <div style={{ display: 'flex', gap: 8 }}>
                    <button onClick={() => decline(inq.id)} disabled={actingId === inq.id} style={{
                      display: 'flex', alignItems: 'center', gap: 5, padding: '7px 12px', borderRadius: 7,
                      background: 'transparent', border: '1px solid rgba(239,68,68,0.35)', color: '#EF4444',
                      fontSize: 12.5, fontWeight: 600, fontFamily: 'Syne', cursor: actingId === inq.id ? 'default' : 'pointer', opacity: actingId === inq.id ? 0.5 : 1,
                    }}>
                      <XCircle size={13} /> {t('aiWorkforce.decline')}
                    </button>
                    <button onClick={() => approve(inq.id)} disabled={actingId === inq.id} style={{
                      display: 'flex', alignItems: 'center', gap: 5, padding: '7px 12px', borderRadius: 7,
                      background: 'rgba(16,185,129,0.12)', border: '1px solid rgba(16,185,129,0.35)', color: '#10B981',
                      fontSize: 12.5, fontWeight: 600, fontFamily: 'Syne', cursor: actingId === inq.id ? 'default' : 'pointer', opacity: actingId === inq.id ? 0.5 : 1,
                    }}>
                      <CheckCircle2 size={13} /> {t('aiWorkforce.approve')}
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Employee cards */}
        <h2 style={{ fontFamily: 'Syne', fontWeight: 700, fontSize: 16, color: 'var(--text-primary)', marginBottom: 14 }}>{t('aiWorkforce.employeesHeading')}</h2>
        {loading ? (
          <div style={{ padding: 40, textAlign: 'center', color: 'var(--text-muted)', fontSize: 13 }}>{t('aiWorkforce.loadingWorkforce')}</div>
        ) : (
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(300px, 1fr))', gap: 16 }}>
            {agents.map(agent => <AgentCard key={agent.key} agent={agent} />)}
          </div>
        )}
      </div>
    </DashboardLayout>
  );
}
