import { useEffect, useState } from 'react';
import DashboardLayout from '../../components/DashboardLayout';
import { AlertTriangle, Settings, X, ChevronRight, History as HistoryIcon } from 'lucide-react';
import { collections as collectionsApi } from '../../lib/api';
import { useLanguage } from '../../lib/LanguageContext';
import { useCurrency } from '../../lib/CurrencyContext';
import PlanLock, { hasPlanAccess } from '../../components/PlanLock';
import toast from 'react-hot-toast';

const STAGE_COLOR: Record<string, string> = {
  reminder: '#3B82F6', late_fee: '#FBC02D', payment_plan_offer: '#F97316',
  manager_notification: '#EF4444', legal_prep: '#7C3AED',
};

const STAGE_ORDER = ['reminder', 'late_fee', 'payment_plan_offer', 'manager_notification', 'legal_prep'];

export default function Collections() {
  const { t } = useLanguage();
  const { formatMoney: fmtMoney } = useCurrency();
  const [data, setData] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [actingId, setActingId] = useState<string | null>(null);
  const [showSettings, setShowSettings] = useState(false);
  const [settings, setSettings] = useState<any>(null);
  const [savingSettings, setSavingSettings] = useState(false);
  const [historyItem, setHistoryItem] = useState<any | null>(null);
  const [historyList, setHistoryList] = useState<any[] | null>(null);
  const [historyLoading, setHistoryLoading] = useState(false);

  const load = () => {
    collectionsApi.queue().then(r => setData(r.data)).catch(() => {}).finally(() => setLoading(false));
  };

  useEffect(() => { load(); }, []);

  const openSettings = () => {
    collectionsApi.settings().then(r => setSettings(r.data)).catch(() => {});
    setShowSettings(true);
  };

  const saveSettings = async () => {
    setSavingSettings(true);
    try {
      const res = await collectionsApi.updateSettings(settings);
      setSettings(res.data);
      toast.success(t('collections.settingsSaved'));
      setShowSettings(false);
      load();
    } catch { toast.error(t('collections.saveFailed')); }
    finally { setSavingSettings(false); }
  };

  const openHistory = (item: any) => {
    setHistoryItem(item);
    setHistoryList(null);
    setHistoryLoading(true);
    collectionsApi.history(item.id).then(r => setHistoryList(r.data || [])).catch(() => setHistoryList([])).finally(() => setHistoryLoading(false));
  };

  const advance = async (item: any) => {
    setActingId(item.id);
    try {
      const payload: any = { action_type: item.recommended_action };
      if (item.suggested_late_fee) payload.amount = item.suggested_late_fee;
      await collectionsApi.recordAction(item.id, payload);
      toast.success(t('collections.actionRecorded'));
      load();
    } catch { toast.error(t('collections.saveFailed')); }
    finally { setActingId(null); }
  };

  if (!hasPlanAccess('professional')) {
    return <PlanLock minTier="professional" titleKey="collections.title" />;
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
        <div style={{ color: '#64748B' }}>{t('collections.error')}</div>
      </DashboardLayout>
    );
  }

  const { summary, queue } = data;

  const kpis = [
    { label: t('collections.totalDelinquent'), value: summary.total_delinquent },
    { label: t('collections.needsAction'), value: summary.needs_action, warn: summary.needs_action > 0 },
    { label: t('collections.totalOverdue'), value: fmtMoney(summary.total_overdue_amount), warn: summary.total_overdue_amount > 0 },
  ];

  return (
    <DashboardLayout>
      <div style={{ maxWidth: 1200 }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 6 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
            <AlertTriangle size={24} color="#FBC02D" />
            <h1 style={{ fontFamily: 'Syne', fontWeight: 800, fontSize: 26, color: 'var(--text-primary)' }}>{t('collections.title')}</h1>
          </div>
          <button onClick={openSettings} style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '10px 16px', background: 'var(--bg-surface)', border: '1px solid var(--border-strong)', borderRadius: 8, color: 'var(--text-secondary)', fontSize: 13, fontFamily: 'IBM Plex Sans', cursor: 'pointer' }}>
            <Settings size={15} /> {t('collections.settings')}
          </button>
        </div>
        <p style={{ color: '#64748B', fontSize: 14, marginBottom: 24 }}>{t('collections.subtitle')}</p>

        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: 12, marginBottom: 20 }}>
          {kpis.map(k => (
            <div key={k.label} style={{ background: 'var(--bg-surface)', border: '1px solid var(--border-strong)', borderRadius: 12, padding: '14px 16px' }}>
              <div style={{ fontSize: 10, fontFamily: 'IBM Plex Mono', color: '#64748B', marginBottom: 6, letterSpacing: '0.5px' }}>{k.label.toUpperCase()}</div>
              <div style={{ fontSize: 22, fontFamily: 'IBM Plex Mono', fontWeight: 600, color: k.warn ? '#EF4444' : 'var(--text-primary)' }}>{k.value}</div>
            </div>
          ))}
        </div>

        <div style={{ display: 'flex', gap: 10, marginBottom: 20, flexWrap: 'wrap' }}>
          {STAGE_ORDER.map(s => (
            <div key={s} style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '5px 10px', borderRadius: 6, background: `${STAGE_COLOR[s]}15` }}>
              <div style={{ width: 8, height: 8, borderRadius: '50%', background: STAGE_COLOR[s] }} />
              <span style={{ fontSize: 11, color: STAGE_COLOR[s], fontFamily: 'IBM Plex Mono' }}>
                {t(`collections.stage.${s}`)}: {summary.by_recommended_action[s]}
              </span>
            </div>
          ))}
        </div>

        <div style={{ background: 'var(--bg-surface)', border: '1px solid var(--border-strong)', borderRadius: 12, overflow: 'hidden' }}>
          <div style={{ overflowX: 'auto' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', minWidth: 900 }}>
              <thead>
                <tr style={{ borderBottom: '1px solid var(--border-strong)' }}>
                  {[t('collections.tenant'), t('portfolio.property'), t('collections.amount'), t('collections.dueDate'), t('collections.daysOverdue'), t('collections.currentStage'), t('collections.recommendedAction'), t('compliance.actions')].map(h => (
                    <th key={h} style={{ padding: '10px 14px', textAlign: 'left', fontSize: 10, fontFamily: 'IBM Plex Mono', color: '#64748B', letterSpacing: '0.5px', whiteSpace: 'nowrap' }}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {queue.length === 0 ? (
                  <tr><td colSpan={8} style={{ textAlign: 'center', padding: '50px', color: '#475569', fontFamily: 'IBM Plex Sans' }}>{t('collections.noDelinquencies')}</td></tr>
                ) : queue.map((item: any) => (
                  <tr key={item.id} style={{ borderBottom: '1px solid var(--border-subtle)' }}>
                    <td style={{ padding: '12px 14px', fontSize: 13, color: 'var(--text-primary)', fontFamily: 'IBM Plex Sans', fontWeight: 600, whiteSpace: 'nowrap' }}>{item.tenant_name}</td>
                    <td style={{ padding: '12px 14px', fontSize: 12, color: 'var(--text-secondary)', whiteSpace: 'nowrap' }}>{item.property_name}{item.unit_number ? ` · ${item.unit_number}` : ''}</td>
                    <td style={{ padding: '12px 14px', fontSize: 12, fontFamily: 'IBM Plex Mono', color: 'var(--text-primary)' }}>{fmtMoney(item.amount)}</td>
                    <td style={{ padding: '12px 14px', fontSize: 12, fontFamily: 'IBM Plex Mono', color: 'var(--text-secondary)', whiteSpace: 'nowrap' }}>{item.due_date}</td>
                    <td style={{ padding: '12px 14px', fontSize: 12, fontFamily: 'IBM Plex Mono', color: '#EF4444' }}>{item.days_overdue}d</td>
                    <td style={{ padding: '12px 14px' }}>
                      {item.current_stage ? (
                        <span style={{ fontSize: 10, padding: '3px 8px', borderRadius: 4, background: `${STAGE_COLOR[item.current_stage]}20`, color: STAGE_COLOR[item.current_stage], fontFamily: 'IBM Plex Mono' }}>
                          {t(`collections.stage.${item.current_stage}`)}
                        </span>
                      ) : <span style={{ fontSize: 11, color: '#334155' }}>—</span>}
                    </td>
                    <td style={{ padding: '12px 14px' }}>
                      {item.recommended_action ? (
                        <div>
                          <div style={{ display: 'flex', alignItems: 'center', gap: 4, fontSize: 11, color: STAGE_COLOR[item.recommended_action], fontFamily: 'IBM Plex Mono' }}>
                            <ChevronRight size={12} /> {t(`collections.stage.${item.recommended_action}`)}
                            {item.suggested_late_fee ? ` (${fmtMoney(item.suggested_late_fee)})` : ''}
                          </div>
                          <div style={{ fontSize: 10, color: '#475569', marginTop: 2, maxWidth: 220 }}>{item.explanation}</div>
                        </div>
                      ) : <span style={{ fontSize: 11, color: '#334155' }}>{t('collections.upToDate')}</span>}
                    </td>
                    <td style={{ padding: '12px 14px' }}>
                      <div style={{ display: 'flex', gap: 6, alignItems: 'center' }}>
                        {item.recommended_action && (
                          <button onClick={() => advance(item)} disabled={actingId === item.id}
                            style={{ padding: '6px 12px', borderRadius: 6, background: 'rgba(var(--accent-rgb),0.1)', border: '1px solid rgba(var(--accent-rgb),0.3)', color: '#FBC02D', fontSize: 11, fontFamily: 'IBM Plex Mono', cursor: 'pointer', whiteSpace: 'nowrap' }}>
                            {actingId === item.id ? t('collections.recording') : t('collections.recordAction')}
                          </button>
                        )}
                        <button onClick={() => openHistory(item)} title={t('collections.viewHistory')}
                          style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', width: 28, height: 28, borderRadius: 6, background: 'var(--bg-app)', border: '1px solid var(--border-strong)', color: '#64748B', cursor: 'pointer', flexShrink: 0 }}>
                          <HistoryIcon size={13} />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
        <p style={{ marginTop: 14, fontSize: 11, color: '#475569' }}>{t('collections.note')}</p>

        {showSettings && settings && (
          <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.8)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000 }}>
            <div style={{ background: 'var(--bg-surface)', border: '1px solid var(--border-strong)', borderRadius: 16, padding: 28, width: 440 }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
                <h2 style={{ fontFamily: 'Syne', fontWeight: 700, fontSize: 18, color: 'var(--text-primary)' }}>{t('collections.settings')}</h2>
                <button onClick={() => setShowSettings(false)} style={{ background: 'none', border: 'none', color: '#64748B', cursor: 'pointer' }}><X size={18} /></button>
              </div>
              <p style={{ fontSize: 12, color: '#64748B', marginBottom: 18 }}>{t('collections.settingsSubtitle')}</p>

              {[
                ['collections_day_reminder', t('collections.stage.reminder')],
                ['collections_day_late_fee', t('collections.stage.late_fee')],
                ['collections_day_payment_plan', t('collections.stage.payment_plan_offer')],
                ['collections_day_manager_notify', t('collections.stage.manager_notification')],
                ['collections_day_legal_prep', t('collections.stage.legal_prep')],
              ].map(([key, label]) => (
                <div key={key} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12 }}>
                  <label style={{ fontSize: 13, color: 'var(--text-hover)', fontFamily: 'IBM Plex Sans' }}>{label}</label>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                    <input type="number" min={0} value={settings[key]} onChange={e => setSettings((p: any) => ({ ...p, [key]: parseInt(e.target.value) || 0 }))}
                      style={{ width: 60, padding: '6px 8px', background: 'var(--bg-app)', border: '1px solid var(--border-input)', borderRadius: 6, color: 'var(--text-primary)', fontSize: 13, fontFamily: 'IBM Plex Mono', outline: 'none', textAlign: 'center' }} />
                    <span style={{ fontSize: 11, color: '#64748B' }}>{t('collections.days')}</span>
                  </div>
                </div>
              ))}
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 20 }}>
                <label style={{ fontSize: 13, color: 'var(--text-hover)', fontFamily: 'IBM Plex Sans' }}>{t('collections.lateFeePercent')}</label>
                <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                  <input type="number" min={0} step={0.5} value={settings.collections_late_fee_percent} onChange={e => setSettings((p: any) => ({ ...p, collections_late_fee_percent: parseFloat(e.target.value) || 0 }))}
                    style={{ width: 60, padding: '6px 8px', background: 'var(--bg-app)', border: '1px solid var(--border-input)', borderRadius: 6, color: 'var(--text-primary)', fontSize: 13, fontFamily: 'IBM Plex Mono', outline: 'none', textAlign: 'center' }} />
                  <span style={{ fontSize: 11, color: '#64748B' }}>%</span>
                </div>
              </div>
              <button onClick={saveSettings} disabled={savingSettings} style={{ width: '100%', padding: 12, background: 'linear-gradient(135deg, #FBC02D, #F57F17)', color: 'var(--bg-app)', fontWeight: 700, fontFamily: 'Syne', border: 'none', borderRadius: 8, cursor: 'pointer' }}>
                {savingSettings ? t('compliance.saving') : t('compliance.saveChanges')}
              </button>
            </div>
          </div>
        )}

        {historyItem && (
          <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.8)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000 }}>
            <div style={{ background: 'var(--bg-surface)', border: '1px solid var(--border-strong)', borderRadius: 16, padding: 28, width: 440, maxHeight: '80vh', overflowY: 'auto' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 4 }}>
                <h2 style={{ fontFamily: 'Syne', fontWeight: 700, fontSize: 18, color: 'var(--text-primary)' }}>{t('collections.historyTitle')}</h2>
                <button onClick={() => setHistoryItem(null)} style={{ background: 'none', border: 'none', color: '#64748B', cursor: 'pointer' }}><X size={18} /></button>
              </div>
              <p style={{ fontSize: 12, color: '#64748B', marginBottom: 18 }}>{historyItem.tenant_name} · {fmtMoney(historyItem.amount)}</p>
              {historyLoading ? (
                <div style={{ color: '#64748B', fontFamily: 'IBM Plex Mono', fontSize: 13 }}>{t('nav.loading')}</div>
              ) : historyList && historyList.length > 0 ? (
                <div style={{ display: 'grid', gap: 10 }}>
                  {historyList.map((h: any) => (
                    <div key={h.id} style={{ border: '1px solid var(--border-strong)', borderRadius: 8, padding: 12 }}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                        <span style={{ fontSize: 12, fontWeight: 600, color: STAGE_COLOR[h.action_type] || 'var(--text-primary)', fontFamily: 'IBM Plex Mono' }}>
                          {t(`collections.stage.${h.action_type}`)}
                        </span>
                        <span style={{ fontSize: 11, color: '#64748B', fontFamily: 'IBM Plex Mono' }}>{h.action_date}</span>
                      </div>
                      {h.amount != null && (
                        <div style={{ fontSize: 12, color: 'var(--text-secondary)', marginTop: 4 }}>{fmtMoney(h.amount)}</div>
                      )}
                      {h.notes && <div style={{ fontSize: 12, color: 'var(--text-secondary)', marginTop: 4 }}>{h.notes}</div>}
                    </div>
                  ))}
                </div>
              ) : (
                <div style={{ textAlign: 'center', padding: '30px', color: '#475569', fontFamily: 'IBM Plex Sans', fontSize: 13 }}>{t('collections.noHistory')}</div>
              )}
            </div>
          </div>
        )}
      </div>
    </DashboardLayout>
  );
}
