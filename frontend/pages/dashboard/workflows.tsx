import { useEffect, useState } from 'react';
import DashboardLayout from '../../components/DashboardLayout';
import PlanLock, { hasPlanAccess } from '../../components/PlanLock';
import { Workflow, Plus, Trash2, X, Play, Zap } from 'lucide-react';
import { workflows as workflowsApi } from '../../lib/api';
import { useLanguage } from '../../lib/LanguageContext';
import { useSidebar } from '../../lib/SidebarContext';
import toast from 'react-hot-toast';

interface Condition { field: string; operator: string; value: string; }
interface Action { type: string; params: Record<string, string>; }
interface Rule {
  id: string; name: string; trigger: string; conditions: Condition[]; actions: Action[];
  is_active: boolean; run_count: number; last_run_at: string | null; created_at: string;
}
interface Metadata {
  triggers: Record<string, { label: string; fields: string[] }>;
  operators: string[];
  action_types: string[];
}

const emptyCondition = (): Condition => ({ field: '', operator: 'equals', value: '' });
const emptyAction = (): Action => ({ type: 'notify_owner', params: { subject: '', body: '' } });

export default function WorkflowsPage() {
  const { t } = useLanguage();
  const { isMobile } = useSidebar();
  const [rules, setRules] = useState<Rule[]>([]);
  const [meta, setMeta] = useState<Metadata | null>(null);
  const [loading, setLoading] = useState(true);
  const [showBuilder, setShowBuilder] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  const [name, setName] = useState('');
  const [trigger, setTrigger] = useState('');
  const [conditions, setConditions] = useState<Condition[]>([emptyCondition()]);
  const [actions, setActions] = useState<Action[]>([emptyAction()]);

  const [testData, setTestData] = useState<Record<string, string>>({});
  const [testResult, setTestResult] = useState<{ matched: boolean; would_run_actions: any[] } | null>(null);
  const [testing, setTesting] = useState(false);

  const load = () => {
    Promise.all([workflowsApi.metadata(), workflowsApi.list()])
      .then(([metaRes, rulesRes]) => { setMeta(metaRes.data); setRules(rulesRes.data); })
      .catch(() => {})
      .finally(() => setLoading(false));
  };

  useEffect(() => { if (hasPlanAccess('enterprise')) load(); }, []);

  if (!hasPlanAccess('enterprise')) {
    return <PlanLock minTier="enterprise" titleKey="workflows.title" />;
  }

  const openNewRule = () => {
    setEditingId(null);
    setName('');
    setTrigger(Object.keys(meta?.triggers || {})[0] || '');
    setConditions([emptyCondition()]);
    setActions([emptyAction()]);
    setTestData({});
    setTestResult(null);
    setShowBuilder(true);
  };

  const openEditRule = (rule: Rule) => {
    setEditingId(rule.id);
    setName(rule.name);
    setTrigger(rule.trigger);
    setConditions(rule.conditions.length ? rule.conditions.map(c => ({ ...c, value: String(c.value) })) : [emptyCondition()]);
    setActions(rule.actions.length ? rule.actions.map(a => ({ type: a.type, params: a.params || {} })) : [emptyAction()]);
    setTestData({});
    setTestResult(null);
    setShowBuilder(true);
  };

  const closeBuilder = () => setShowBuilder(false);

  const saveRule = async () => {
    if (!name.trim() || !trigger) {
      toast.error(t('workflows.validationError'));
      return;
    }
    setSaving(true);
    const payload = {
      name,
      trigger,
      conditions: conditions.filter(c => c.field && c.operator),
      actions: actions.filter(a => a.type),
    };
    try {
      if (editingId) {
        await workflowsApi.update(editingId, payload);
      } else {
        await workflowsApi.create(payload);
      }
      toast.success(t('workflows.saved'));
      setShowBuilder(false);
      load();
    } catch (err: any) {
      toast.error(err?.response?.data?.detail || t('workflows.saveFailed'));
    } finally {
      setSaving(false);
    }
  };

  const deleteRule = async (id: string) => {
    try {
      await workflowsApi.delete(id);
      toast.success(t('workflows.deleted'));
      load();
    } catch {
      toast.error(t('workflows.saveFailed'));
    }
  };

  const toggleActive = async (rule: Rule) => {
    try {
      await workflowsApi.update(rule.id, { is_active: !rule.is_active });
      load();
    } catch {
      toast.error(t('workflows.saveFailed'));
    }
  };

  const runTest = async () => {
    if (!editingId) return;
    setTesting(true);
    setTestResult(null);
    try {
      const res = await workflowsApi.test(editingId, testData);
      setTestResult(res.data);
    } catch (err: any) {
      toast.error(err?.response?.data?.detail || t('workflows.testFailed'));
    } finally {
      setTesting(false);
    }
  };

  const fields = meta?.triggers?.[trigger]?.fields || [];

  return (
    <DashboardLayout>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 6, flexWrap: 'wrap', gap: 12 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
          <Workflow size={26} color="#FBC02D" />
          <h1 style={{ fontFamily: 'Syne', fontWeight: 800, fontSize: 28, color: 'var(--text-primary)' }}>{t('workflows.title')}</h1>
        </div>
        <button onClick={openNewRule} style={btn}>
          <Plus size={14} style={{ marginRight: 6, verticalAlign: -2 }} />{t('workflows.newRule')}
        </button>
      </div>
      <p style={{ color: '#64748B', fontSize: 14, marginBottom: 24 }}>{t('workflows.subtitle')}</p>

      {loading ? (
        <div style={{ color: '#64748B', fontFamily: 'IBM Plex Mono' }}>{t('nav.loading')}</div>
      ) : rules.length === 0 ? (
        <div style={{ padding: 40, textAlign: 'center', color: '#64748B', background: 'var(--bg-surface)', border: '1px solid var(--border-strong)', borderRadius: 12 }}>
          {t('workflows.empty')}
        </div>
      ) : (
        <div style={{ border: '1px solid var(--border-strong)', borderRadius: 12, overflow: 'hidden' }}>
          {rules.map((rule, i) => (
            <div key={rule.id} onClick={() => openEditRule(rule)} style={{
              display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '14px 18px',
              borderTop: i === 0 ? 'none' : '1px solid var(--border-subtle)', cursor: 'pointer',
            }}>
              <div>
                <div style={{ fontFamily: 'Syne', fontWeight: 700, fontSize: 14, color: 'var(--text-primary)' }}>{rule.name}</div>
                <div style={{ fontSize: 12, color: '#64748B', marginTop: 2 }}>
                  {meta?.triggers?.[rule.trigger]?.label || rule.trigger} · {rule.conditions.length} {t('workflows.conditionsLabel')} · {rule.actions.length} {t('workflows.actionsLabel')}
                  {rule.run_count > 0 && ` · ${t('workflows.ranTimes').replace('{n}', String(rule.run_count))}`}
                </div>
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: 12 }} onClick={e => e.stopPropagation()}>
                <span onClick={() => toggleActive(rule)} style={{
                  fontSize: 11, padding: '4px 10px', borderRadius: 6, cursor: 'pointer',
                  background: rule.is_active ? 'rgba(34,197,94,0.12)' : 'rgba(148,163,184,0.15)',
                  color: rule.is_active ? '#22C55E' : '#94A3B8', fontFamily: 'IBM Plex Mono',
                }}>
                  {rule.is_active ? t('workflows.active') : t('workflows.inactive')}
                </span>
                <button onClick={() => deleteRule(rule.id)} style={{ background: 'none', border: 'none', color: '#64748B', cursor: 'pointer' }}>
                  <Trash2 size={15} />
                </button>
              </div>
            </div>
          ))}
        </div>
      )}

      {showBuilder && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.8)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000, padding: 20 }}>
          <div style={{ background: 'var(--bg-surface)', border: '1px solid var(--border-strong)', borderRadius: 16, padding: 28, width: 560, maxHeight: '88vh', overflowY: 'auto' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 }}>
              <h2 style={{ fontFamily: 'Syne', fontWeight: 700, fontSize: 18, color: 'var(--text-primary)' }}>
                {editingId ? t('workflows.editRule') : t('workflows.newRule')}
              </h2>
              <button onClick={closeBuilder} style={{ background: 'none', border: 'none', color: '#64748B', cursor: 'pointer' }}><X size={18} /></button>
            </div>

            <label style={lbl}>{t('workflows.ruleName')}</label>
            <input value={name} onChange={e => setName(e.target.value)} spellCheck autoCorrect="on" style={inp} />

            <label style={{ ...lbl, marginTop: 14 }}>{t('workflows.trigger')}</label>
            <select value={trigger} onChange={e => { setTrigger(e.target.value); setConditions([emptyCondition()]); }} style={inp as any}>
              {Object.entries(meta?.triggers || {}).map(([key, v]) => <option key={key} value={key}>{v.label}</option>)}
            </select>

            <div style={{ marginTop: 18 }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
                <label style={lbl}>{t('workflows.conditions')}</label>
                <button onClick={() => setConditions(c => [...c, emptyCondition()])} style={smallBtn}>+ {t('workflows.addCondition')}</button>
              </div>
              {conditions.map((cond, i) => (
                <div key={i} style={{ display: 'grid', gridTemplateColumns: isMobile ? '1fr' : '1fr 1fr 1fr auto', gap: 8, marginBottom: 8 }}>
                  <select value={cond.field} onChange={e => setConditions(cs => cs.map((c, ci) => ci === i ? { ...c, field: e.target.value } : c))} style={inp as any}>
                    <option value="">{t('workflows.selectField')}</option>
                    {fields.map(f => <option key={f} value={f}>{f}</option>)}
                  </select>
                  <select value={cond.operator} onChange={e => setConditions(cs => cs.map((c, ci) => ci === i ? { ...c, operator: e.target.value } : c))} style={inp as any}>
                    {(meta?.operators || []).map(op => <option key={op} value={op}>{t(`workflows.op.${op}`)}</option>)}
                  </select>
                  <input value={cond.value} onChange={e => setConditions(cs => cs.map((c, ci) => ci === i ? { ...c, value: e.target.value } : c))} style={inp} placeholder={t('workflows.value')} />
                  <button onClick={() => setConditions(cs => cs.filter((_, ci) => ci !== i))} style={{ background: 'none', border: 'none', color: '#64748B', cursor: 'pointer' }}><X size={16} /></button>
                </div>
              ))}
            </div>

            <div style={{ marginTop: 18 }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
                <label style={lbl}>{t('workflows.actions')}</label>
                <button onClick={() => setActions(a => [...a, emptyAction()])} style={smallBtn}>+ {t('workflows.addAction')}</button>
              </div>
              {actions.map((action, i) => (
                <div key={i} style={{ background: 'var(--bg-app)', border: '1px solid var(--border-strong)', borderRadius: 8, padding: 12, marginBottom: 8 }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
                    <select
                      value={action.type}
                      onChange={e => setActions(as => as.map((a, ai) => ai === i ? { type: e.target.value, params: {} } : a))}
                      style={{ ...inp, width: 'auto', flex: 1 } as any}
                    >
                      {(meta?.action_types || []).map(at => <option key={at} value={at}>{t(`workflows.actionType.${at}`)}</option>)}
                    </select>
                    <button onClick={() => setActions(as => as.filter((_, ai) => ai !== i))} style={{ background: 'none', border: 'none', color: '#64748B', cursor: 'pointer', marginLeft: 8 }}><X size={16} /></button>
                  </div>
                  {(action.type === 'send_email' || action.type === 'send_sms') && (
                    <input
                      value={action.params.to || ''} placeholder={t('workflows.recipient')}
                      onChange={e => setActions(as => as.map((a, ai) => ai === i ? { ...a, params: { ...a.params, to: e.target.value } } : a))}
                      style={{ ...inp, marginBottom: 8 }}
                    />
                  )}
                  {action.type !== 'send_sms' && (
                    <input
                      value={action.params.subject || ''} placeholder={t('workflows.subject')}
                      onChange={e => setActions(as => as.map((a, ai) => ai === i ? { ...a, params: { ...a.params, subject: e.target.value } } : a))}
                      style={{ ...inp, marginBottom: 8 }}
                    />
                  )}
                  <textarea
                    value={action.params.body || ''} placeholder={t('workflows.body')}
                    onChange={e => setActions(as => as.map((a, ai) => ai === i ? { ...a, params: { ...a.params, body: e.target.value } } : a))}
                    style={{ ...inp, height: 60, resize: 'none' } as any}
                  />
                </div>
              ))}
              <p style={{ fontSize: 11, color: '#475569', marginTop: 4 }}>{t('workflows.templateHint')}</p>
            </div>

            {editingId && (
              <div style={{ marginTop: 20, paddingTop: 18, borderTop: '1px solid var(--border-strong)' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 10 }}>
                  <Play size={14} color="#FBC02D" />
                  <label style={lbl}>{t('workflows.testRule')}</label>
                </div>
                {fields.map(f => (
                  <div key={f} style={{ display: 'grid', gridTemplateColumns: isMobile ? '1fr' : '120px 1fr', gap: 8, marginBottom: 6, alignItems: 'center' }}>
                    <span style={{ fontSize: 12, color: 'var(--text-secondary)', fontFamily: 'IBM Plex Mono' }}>{f}</span>
                    <input
                      value={testData[f] || ''}
                      onChange={e => setTestData(td => ({ ...td, [f]: e.target.value }))}
                      style={{ ...inp, padding: '6px 10px' }}
                    />
                  </div>
                ))}
                <button onClick={runTest} disabled={testing} style={{ ...smallBtn, marginTop: 8 }}>
                  {testing ? t('workflows.testing') : t('workflows.runTest')}
                </button>
                {testResult && (
                  <div style={{ marginTop: 10, padding: 10, borderRadius: 8, background: testResult.matched ? 'rgba(34,197,94,0.1)' : 'rgba(148,163,184,0.1)' }}>
                    <div style={{ fontSize: 12, fontWeight: 700, color: testResult.matched ? '#22C55E' : '#94A3B8', marginBottom: 4 }}>
                      {testResult.matched ? t('workflows.testMatched') : t('workflows.testNoMatch')}
                    </div>
                    {testResult.would_run_actions.map((a: any, i: number) => (
                      <div key={i} style={{ fontSize: 11, color: 'var(--text-secondary)', fontFamily: 'IBM Plex Mono' }}>
                        <Zap size={10} style={{ verticalAlign: -1 }} /> {a.type} — {a.status}
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )}

            <button onClick={saveRule} disabled={saving} style={{ ...btn, width: '100%', marginTop: 20, justifyContent: 'center' }}>
              {saving ? t('workflows.saving') : t('workflows.saveRule')}
            </button>
          </div>
        </div>
      )}
    </DashboardLayout>
  );
}

const lbl: React.CSSProperties = { display: 'block', marginBottom: 5, fontSize: 12, fontFamily: 'IBM Plex Mono', color: 'var(--text-secondary)' };
const inp: React.CSSProperties = { width: '100%', padding: '9px 12px', background: 'var(--bg-app)', border: '1px solid var(--border-input)', borderRadius: 8, color: 'var(--text-primary)', fontSize: 13, fontFamily: 'IBM Plex Sans', outline: 'none', boxSizing: 'border-box' };
const btn: React.CSSProperties = { padding: '10px 20px', background: 'linear-gradient(135deg, #FBC02D, #F57F17)', color: '#060B18', fontWeight: 700, fontFamily: 'Syne', border: 'none', borderRadius: 8, cursor: 'pointer', display: 'flex', alignItems: 'center' };
const smallBtn: React.CSSProperties = { padding: '6px 12px', background: 'var(--bg-app)', color: 'var(--text-secondary)', fontWeight: 600, fontFamily: 'Syne', fontSize: 12, border: '1px solid var(--border-strong)', borderRadius: 6, cursor: 'pointer' };
