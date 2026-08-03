import { useEffect, useState } from 'react';
import DashboardLayout from '../../components/DashboardLayout';
import { MessageSquare, Send, Users, User } from 'lucide-react';
import { communications as commsApi, tenants as tenantsApi, properties as propertiesApi, maintenance as maintenanceApi } from '../../lib/api';
import { useLanguage } from '../../lib/LanguageContext';
import PlanLock, { hasPlanAccess } from '../../components/PlanLock';
import toast from 'react-hot-toast';

const CHANNELS = ['sms', 'email', 'in_app'];
const SINGLE_TEMPLATES = ['lease_renewal', 'maintenance_update', 'rent_reminder', 'community_announcement', 'emergency_notification', 'custom'];
const BROADCAST_TEMPLATES = ['community_announcement', 'emergency_notification', 'custom'];

const STATUS_COLOR: Record<string, string> = { sent: '#10B981', failed: '#EF4444', logged_only: '#64748B' };

export default function Communications() {
  const { t } = useLanguage();
  const [mode, setMode] = useState<'single' | 'broadcast'>('single');
  const [channel, setChannel] = useState('in_app');
  const [template, setTemplate] = useState('rent_reminder');
  const [propertyList, setPropertyList] = useState<any[]>([]);
  const [tenantList, setTenantList] = useState<any[]>([]);
  const [propertyId, setPropertyId] = useState('');
  const [tenantId, setTenantId] = useState('');
  const [ticketList, setTicketList] = useState<any[]>([]);
  const [ticketId, setTicketId] = useState('');
  const [customSubject, setCustomSubject] = useState('');
  const [customBody, setCustomBody] = useState('');
  const [sending, setSending] = useState(false);
  const [log, setLog] = useState<any[]>([]);
  const [loadingLog, setLoadingLog] = useState(true);

  const loadLog = () => {
    commsApi.list().then(r => setLog(r.data || [])).catch(() => {}).finally(() => setLoadingLog(false));
  };

  useEffect(() => {
    loadLog();
    propertiesApi.list().then(r => setPropertyList(r.data || [])).catch(() => {});
    tenantsApi.list().then(r => setTenantList(r.data || [])).catch(() => {});
  }, []);

  useEffect(() => {
    if (template === 'maintenance_update' && tenantId) {
      const tenant = tenantList.find(t => t.id === tenantId);
      if (tenant?.property_id) {
        maintenanceApi.list(undefined, tenant.property_id).then(r => setTicketList(r.data || [])).catch(() => setTicketList([]));
      }
    }
  }, [template, tenantId]);

  const templateOptions = mode === 'single' ? SINGLE_TEMPLATES : BROADCAST_TEMPLATES;
  const needsCustomText = template === 'custom' || template === 'community_announcement' || template === 'emergency_notification';

  const send = async () => {
    if (mode === 'single' && !tenantId) {
      toast.error(t('communications.selectTenantError'));
      return;
    }
    if (mode === 'broadcast' && !propertyId) {
      toast.error(t('communications.selectPropertyError'));
      return;
    }
    if (needsCustomText && !customBody.trim()) {
      toast.error(t('communications.bodyRequiredError'));
      return;
    }
    setSending(true);
    try {
      const payload: any = { channel, template };
      if (mode === 'single') payload.tenant_id = tenantId;
      else payload.property_id = propertyId;
      if (template === 'maintenance_update' && ticketId) payload.ticket_id = ticketId;
      if (needsCustomText) { payload.custom_subject = customSubject; payload.custom_body = customBody; }

      const res = await commsApi.send(payload);
      const count = res.data.length;
      toast.success(t('communications.sentCount').replace('{n}', count));
      setCustomBody(''); setCustomSubject('');
      loadLog();
    } catch (err: any) {
      toast.error(err?.response?.data?.detail || t('communications.sendFailed'));
    } finally {
      setSending(false);
    }
  };

  if (!hasPlanAccess('professional')) {
    return <PlanLock minTier="professional" titleKey="communications.title" />;
  }

  return (
    <DashboardLayout>
      <div style={{ maxWidth: 1100 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 6 }}>
          <MessageSquare size={24} color="#FBC02D" />
          <h1 style={{ fontFamily: 'Syne', fontWeight: 800, fontSize: 26, color: 'var(--text-primary)' }}>{t('communications.title')}</h1>
        </div>
        <p style={{ color: '#64748B', fontSize: 14, marginBottom: 24 }}>{t('communications.subtitle')}</p>

        <div style={{ background: 'var(--bg-surface)', border: '1px solid var(--border-strong)', borderRadius: 12, padding: 20, marginBottom: 24 }}>
          <div style={{ display: 'flex', gap: 8, marginBottom: 16 }}>
            <button onClick={() => setMode('single')} style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '8px 14px', borderRadius: 8, background: mode === 'single' ? 'rgba(var(--accent-rgb),0.1)' : 'transparent', border: `1px solid ${mode === 'single' ? '#FBC02D' : 'var(--border-strong)'}`, color: mode === 'single' ? '#FBC02D' : 'var(--text-secondary)', fontSize: 13, cursor: 'pointer' }}>
              <User size={14} /> {t('communications.singleTenant')}
            </button>
            <button onClick={() => { setMode('broadcast'); setTemplate('community_announcement'); }} style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '8px 14px', borderRadius: 8, background: mode === 'broadcast' ? 'rgba(var(--accent-rgb),0.1)' : 'transparent', border: `1px solid ${mode === 'broadcast' ? '#FBC02D' : 'var(--border-strong)'}`, color: mode === 'broadcast' ? '#FBC02D' : 'var(--text-secondary)', fontSize: 13, cursor: 'pointer' }}>
              <Users size={14} /> {t('communications.broadcastProperty')}
            </button>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 12, marginBottom: 14 }}>
            <div>
              <label style={lbl}>{t('communications.channel')}</label>
              <select value={channel} onChange={e => setChannel(e.target.value)} style={{ ...inp } as any}>
                {CHANNELS.map(c => <option key={c} value={c}>{t(`communications.channelLabel.${c}`)}</option>)}
              </select>
            </div>
            <div>
              <label style={lbl}>{t('communications.template')}</label>
              <select value={template} onChange={e => setTemplate(e.target.value)} style={{ ...inp } as any}>
                {templateOptions.map(ty => <option key={ty} value={ty}>{t(`communications.templateLabel.${ty}`)}</option>)}
              </select>
            </div>
            {mode === 'single' ? (
              <div>
                <label style={lbl}>{t('communications.tenant')}</label>
                <select value={tenantId} onChange={e => setTenantId(e.target.value)} style={{ ...inp } as any}>
                  <option value="">{t('communications.selectTenant')}</option>
                  {tenantList.map(t => <option key={t.id} value={t.id}>{t.first_name} {t.last_name}</option>)}
                </select>
              </div>
            ) : (
              <div>
                <label style={lbl}>{t('portfolio.property')}</label>
                <select value={propertyId} onChange={e => setPropertyId(e.target.value)} style={{ ...inp } as any}>
                  <option value="">{t('inspections.selectProperty')}</option>
                  {propertyList.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
                </select>
              </div>
            )}
          </div>

          {template === 'maintenance_update' && mode === 'single' && (
            <div style={{ marginBottom: 14 }}>
              <label style={lbl}>{t('communications.ticket')}</label>
              <select value={ticketId} onChange={e => setTicketId(e.target.value)} style={{ ...inp } as any}>
                <option value="">{t('communications.selectTicket')}</option>
                {ticketList.map((tk: any) => <option key={tk.id} value={tk.id}>{tk.title} ({tk.status})</option>)}
              </select>
            </div>
          )}

          {needsCustomText && (
            <>
              {template === 'custom' && (
                <div style={{ marginBottom: 14 }}>
                  <label style={lbl}>{t('documents.docTitle')}</label>
                  <input value={customSubject} onChange={e => setCustomSubject(e.target.value)}
                    spellCheck autoCorrect="on" autoCapitalize="sentences" style={inp} />
                </div>
              )}
              <div style={{ marginBottom: 14 }}>
                <label style={lbl}>{template === 'custom' ? t('communications.message') : t('communications.announcementText')}</label>
                <textarea value={customBody} onChange={e => setCustomBody(e.target.value)}
                  spellCheck autoCorrect="on" autoCapitalize="sentences"
                  style={{ ...inp, height: 80, resize: 'none' } as any} />
              </div>
            </>
          )}

          <button onClick={send} disabled={sending} style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '10px 20px', background: 'linear-gradient(135deg, #FBC02D, #F57F17)', color: 'var(--bg-app)', fontWeight: 700, fontFamily: 'Syne', border: 'none', borderRadius: 8, cursor: 'pointer' }}>
            <Send size={15} /> {sending ? t('communications.sending') : t('communications.send')}
          </button>
        </div>

        <h2 style={{ fontFamily: 'Syne', fontWeight: 700, fontSize: 16, color: 'var(--text-primary)', marginBottom: 12 }}>{t('communications.history')}</h2>
        <div style={{ background: 'var(--bg-surface)', border: '1px solid var(--border-strong)', borderRadius: 12, overflow: 'hidden' }}>
          <div style={{ overflowX: 'auto' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', minWidth: 800 }}>
              <thead>
                <tr style={{ borderBottom: '1px solid var(--border-strong)' }}>
                  {[t('communications.recipient'), t('communications.channel'), t('communications.template'), t('compliance.status'), t('inspections.date')].map(h => (
                    <th key={h} style={{ padding: '10px 14px', textAlign: 'left', fontSize: 10, fontFamily: 'IBM Plex Mono', color: '#64748B', letterSpacing: '0.5px', whiteSpace: 'nowrap' }}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {loadingLog ? (
                  <tr><td colSpan={5} style={{ textAlign: 'center', padding: '30px', color: '#475569' }}>{t('nav.loading')}</td></tr>
                ) : log.length === 0 ? (
                  <tr><td colSpan={5} style={{ textAlign: 'center', padding: '50px', color: '#475569' }}>{t('communications.noHistory')}</td></tr>
                ) : log.map((item: any) => (
                  <tr key={item.id} style={{ borderBottom: '1px solid var(--border-subtle)' }} title={item.error_message || ''}>
                    <td style={{ padding: '10px 14px', fontSize: 12, color: 'var(--text-primary)' }}>{item.tenant_name || item.recipient}</td>
                    <td style={{ padding: '10px 14px', fontSize: 12, color: 'var(--text-secondary)' }}>{t(`communications.channelLabel.${item.channel}`)}</td>
                    <td style={{ padding: '10px 14px', fontSize: 12, color: 'var(--text-secondary)' }}>{t(`communications.templateLabel.${item.template}`)}</td>
                    <td style={{ padding: '10px 14px' }}>
                      <span style={{ fontSize: 10, padding: '3px 8px', borderRadius: 4, background: `${STATUS_COLOR[item.status]}20`, color: STATUS_COLOR[item.status], fontFamily: 'IBM Plex Mono' }}>
                        {t(`communications.statusLabel.${item.status}`)}
                      </span>
                    </td>
                    <td style={{ padding: '10px 14px', fontSize: 11, fontFamily: 'IBM Plex Mono', color: '#64748B', whiteSpace: 'nowrap' }}>{new Date(item.created_at).toLocaleString()}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
        <p style={{ marginTop: 20, fontSize: 11, color: '#475569' }}>{t('communications.note')}</p>
      </div>
    </DashboardLayout>
  );
}

const lbl: React.CSSProperties = { display: 'block', marginBottom: 5, fontSize: 12, fontFamily: 'IBM Plex Mono', color: 'var(--text-secondary)' };
const inp: React.CSSProperties = { width: '100%', padding: '9px 12px', background: 'var(--bg-app)', border: '1px solid var(--border-input)', borderRadius: 8, color: 'var(--text-primary)', fontSize: 13, fontFamily: 'IBM Plex Sans', outline: 'none', boxSizing: 'border-box' };
