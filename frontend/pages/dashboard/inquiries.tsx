import { useEffect, useState } from 'react';
import { useRouter } from 'next/router';
import DashboardLayout from '../../components/DashboardLayout';
import { UserSearch, Mail, Phone, Calendar, Building2, UserPlus, Users, ShieldCheck, ShieldX, ShieldQuestion, X, Trash2 } from 'lucide-react';
import { inquiries as inquiriesApi, properties as propertiesApi } from '../../lib/api';
import { parseLocalDate } from '../../lib/date';
import { useLanguage } from '../../lib/LanguageContext';
import toast from 'react-hot-toast';

const STATUS_COLOR: Record<string, string> = {
  new: '#3B82F6', contacted: '#8B5CF6', tour_scheduled: '#FBC02D',
  applied: '#F97316', converted: '#10B981', closed: '#64748B',
};
const STATUSES = ['new', 'contacted', 'tour_scheduled', 'applied', 'converted', 'closed'];

// Automatic pre-screening triage (services/inquiry_triage_service.py) --
// not a financial screening decision, just a "who to call first" signal
// based on what the prospect already wrote.
const PRIORITY_COLOR: Record<string, string> = { hot: '#EF4444', warm: '#F97316', cold: '#64748B' };

const EMPTY_SCREEN_FORM = { annual_income: '', monthly_rent: '', credit_score: '', employment_status: '', employer: '' };
const EMPLOYMENT_STATUSES = ['employed', 'self-employed', 'unemployed', 'retired', 'student'];

export default function Inquiries() {
  const router = useRouter();
  const { t } = useLanguage();
  const [inquiryList, setInquiryList] = useState<any[]>([]);
  const [propertyList, setPropertyList] = useState<any[]>([]);
  const [propertyFilter, setPropertyFilter] = useState('all');
  const [loading, setLoading] = useState(true);
  const [convertingId, setConvertingId] = useState<string | null>(null);
  const [screeningInquiry, setScreeningInquiry] = useState<any>(null);
  const [screenForm, setScreenForm] = useState(EMPTY_SCREEN_FORM);
  const [submittingScreen, setSubmittingScreen] = useState(false);

  const load = (propertyId?: string) => {
    inquiriesApi.list(propertyId === 'all' ? undefined : propertyId).then(r => setInquiryList(r.data || [])).catch(() => {}).finally(() => setLoading(false));
  };

  useEffect(() => {
    load();
    propertiesApi.list().then(r => setPropertyList(r.data || [])).catch(() => {});
  }, []);

  const changeFilter = (propertyId: string) => {
    setPropertyFilter(propertyId);
    setLoading(true);
    load(propertyId);
  };

  const updateStatus = async (id: string, status: string) => {
    try {
      await inquiriesApi.update(id, { status });
      setInquiryList(prev => prev.map(i => i.id === id ? { ...i, status } : i));
    } catch {
      toast.error(t('inquiries.toast.updateStatusFailed'));
    }
  };

  const convertToTenant = async (inquiry: any) => {
    setConvertingId(inquiry.id);
    try {
      const res = await inquiriesApi.convertToTenant(inquiry.id);
      setInquiryList(prev => prev.map(i => i.id === inquiry.id ? { ...i, status: 'converted' } : i));
      toast.success(res.data.lease_created ? t('inquiries.toast.convertedWithLease') : t('inquiries.toast.convertedNoUnit'));
    } catch (err: any) {
      toast.error(err?.response?.data?.detail || t('inquiries.toast.convertFailed'));
    } finally {
      setConvertingId(null);
    }
  };

  const deleteInquiry = async (inquiry: any) => {
    if (!confirm(t('inquiries.toast.deleteConfirm', { name: `${inquiry.first_name} ${inquiry.last_name}` }))) return;
    try {
      await inquiriesApi.delete(inquiry.id);
      setInquiryList(prev => prev.filter(i => i.id !== inquiry.id));
      toast.success(t('inquiries.toast.deleted'));
    } catch {
      toast.error(t('inquiries.toast.deleteFailed'));
    }
  };

  const copyListingLink = (propertyId: string) => {
    const url = `${window.location.origin}/listings/${propertyId}`;
    navigator.clipboard.writeText(url);
    toast.success(t('inquiries.toast.linkCopied'));
  };

  const openScreen = (inquiry: any) => {
    setScreeningInquiry(inquiry);
    setScreenForm({
      annual_income: inquiry.annual_income ? String(inquiry.annual_income) : '',
      monthly_rent: '',
      credit_score: inquiry.credit_score ? String(inquiry.credit_score) : '',
      employment_status: inquiry.employment_status || '',
      employer: inquiry.employer || '',
    });
  };

  const submitScreen = async () => {
    if (!screenForm.annual_income || !screenForm.monthly_rent || !screenForm.employment_status) {
      toast.error(t('inquiries.toast.screenValidation'));
      return;
    }
    setSubmittingScreen(true);
    try {
      const res = await inquiriesApi.screen(screeningInquiry.id, {
        annual_income: Number(screenForm.annual_income),
        monthly_rent: Number(screenForm.monthly_rent),
        credit_score: screenForm.credit_score ? Number(screenForm.credit_score) : undefined,
        employment_status: screenForm.employment_status,
        employer: screenForm.employer || undefined,
      });
      setInquiryList(prev => prev.map(i => i.id === screeningInquiry.id ? res.data : i));
      toast.success(res.data.screening_approved ? t('inquiries.toast.screenApproved') : t('inquiries.toast.screenDeclined'));
      setScreeningInquiry(null);
    } catch (err: any) {
      toast.error(err?.response?.data?.detail || t('inquiries.toast.screenFailed'));
    } finally {
      setSubmittingScreen(false);
    }
  };

  return (
    <DashboardLayout>
      <div style={{ maxWidth: 1200 }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 8, flexWrap: 'wrap', gap: 12 }}>
          <div>
            <h1 style={{ fontFamily: 'Syne', fontWeight: 800, fontSize: 28, color: 'var(--text-primary)', marginBottom: 4 }}>{t('inquiries.title')}</h1>
            <p style={{ color: 'var(--text-muted)', fontSize: 14 }}>{t('inquiries.subtitle', { count: inquiryList.length })}</p>
          </div>
          <select value={propertyFilter} onChange={e => changeFilter(e.target.value)}
            style={{ padding: '9px 14px', background: 'var(--bg-surface)', border: '1px solid var(--border-strong)', borderRadius: 8, color: 'var(--text-secondary)', fontSize: 13, fontFamily: 'IBM Plex Sans', outline: 'none' }}>
            <option value="all">{t('common.allProperties')}</option>
            {propertyList.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
          </select>
        </div>

        {propertyList.length > 0 && (
          <div style={{ background: 'var(--bg-surface)', border: '1px solid var(--border-strong)', borderRadius: 12, padding: '14px 18px', marginBottom: 20 }}>
            <div style={{ fontSize: 12, color: 'var(--text-muted)', marginBottom: 10 }}>{t('inquiries.shareHint')}</div>
            <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
              {propertyList.map(p => (
                <button key={p.id} onClick={() => copyListingLink(p.id)}
                  style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '6px 12px', background: 'rgba(251,192,45,0.1)', border: '1px solid rgba(251,192,45,0.3)', borderRadius: 6, color: '#FBC02D', fontSize: 12, fontFamily: 'IBM Plex Mono', cursor: 'pointer' }}>
                  <Building2 size={12} /> {t('inquiries.copyLink', { name: p.name })}
                </button>
              ))}
            </div>
          </div>
        )}

        {loading ? (
          <div style={{ color: 'var(--text-muted)', fontFamily: 'IBM Plex Mono' }}>{t('nav.loading')}</div>
        ) : (
          <div style={{ background: 'var(--bg-surface)', border: '1px solid var(--border-strong)', borderRadius: 12, overflow: 'hidden' }}>
            <div style={{ overflowX: 'auto' }}>
              <table style={{ width: '100%', borderCollapse: 'collapse', minWidth: 940 }}>
                <thead>
                  <tr style={{ borderBottom: '1px solid var(--border-strong)' }}>
                    {[t('inquiries.col.prospect'), t('inquiries.col.priority'), t('inquiries.col.propertyUnit'), t('inquiries.col.contact'), t('inquiries.col.moveIn'), t('inquiries.col.status'), t('inquiries.col.screening'), t('inquiries.col.actions')].map(h => (
                      <th key={h} style={{ padding: '12px 16px', textAlign: 'left', fontSize: 11, fontFamily: 'IBM Plex Mono', color: 'var(--text-muted)', letterSpacing: '0.5px', fontWeight: 500 }}>{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {inquiryList.length === 0 ? (
                    <tr><td colSpan={8} style={{ textAlign: 'center', padding: '60px', color: 'var(--text-faint)', fontFamily: 'IBM Plex Sans' }}>
                      <UserSearch size={32} style={{ margin: '0 auto 12px', opacity: 0.3, display: 'block' }} />
                      {t('inquiries.empty')}
                    </td></tr>
                  ) : inquiryList.map((i: any) => (
                    <tr key={i.id} style={{ borderBottom: '1px solid var(--border-subtle)' }}>
                      <td style={{ padding: '14px 16px' }}>
                        <div style={{ fontSize: 14, fontWeight: 600, color: 'var(--text-primary)', fontFamily: 'IBM Plex Sans' }}>{i.first_name} {i.last_name}</div>
                        {i.message && <div style={{ fontSize: 11, color: 'var(--text-muted)', maxWidth: 220, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }} title={i.message}>{i.message}</div>}
                      </td>
                      <td style={{ padding: '14px 16px' }}>
                        {i.priority_label ? (
                          <span title={i.priority_reasoning || ''}
                            style={{ display: 'inline-flex', alignItems: 'center', gap: 5, padding: '4px 8px', borderRadius: 6, background: `${PRIORITY_COLOR[i.priority_label]}15`, border: `1px solid ${PRIORITY_COLOR[i.priority_label]}40`, color: PRIORITY_COLOR[i.priority_label], fontSize: 11, fontFamily: 'IBM Plex Mono', textTransform: 'capitalize', cursor: 'help' }}>
                            {i.priority_label} · {i.priority_score}
                          </span>
                        ) : (
                          <span style={{ fontSize: 11, color: '#475569' }}>—</span>
                        )}
                      </td>
                      <td style={{ padding: '14px 16px' }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 12, color: 'var(--text-secondary)' }}>
                          <Building2 size={12} /> {i.property_name}{i.unit_number ? ` · Unit ${i.unit_number}` : ''}
                        </div>
                      </td>
                      <td style={{ padding: '14px 16px' }}>
                        {i.email && <div style={{ display: 'flex', alignItems: 'center', gap: 5, fontSize: 12, color: 'var(--text-secondary)' }}><Mail size={11} /> {i.email}</div>}
                        {i.phone && <div style={{ display: 'flex', alignItems: 'center', gap: 5, fontSize: 12, color: 'var(--text-muted)' }}><Phone size={11} /> {i.phone}</div>}
                      </td>
                      <td style={{ padding: '14px 16px', fontSize: 12, color: 'var(--text-secondary)' }}>
                        {i.desired_move_in ? (
                          <div style={{ display: 'flex', alignItems: 'center', gap: 5 }}><Calendar size={11} /> {parseLocalDate(i.desired_move_in).toLocaleDateString()}</div>
                        ) : '—'}
                      </td>
                      <td style={{ padding: '14px 16px' }}>
                        <select value={i.status} onChange={e => updateStatus(i.id, e.target.value)}
                          style={{ padding: '4px 8px', background: `${STATUS_COLOR[i.status]}15`, border: `1px solid ${STATUS_COLOR[i.status]}40`, borderRadius: 6, color: STATUS_COLOR[i.status], fontSize: 11, fontFamily: 'IBM Plex Mono', cursor: 'pointer', outline: 'none' }}>
                          {STATUSES.map(s => <option key={s} value={s} style={{ background: 'var(--bg-surface)', color: '#E2E8F0' }}>{t(`inquiries.status.${s}`)}</option>)}
                        </select>
                      </td>
                      <td style={{ padding: '14px 16px' }}>
                        {i.screened_at ? (
                          <button onClick={() => openScreen(i)} title={i.screening_notes || t('inquiries.screen.noIssues')}
                            style={{
                              display: 'flex', alignItems: 'center', gap: 5, padding: '4px 8px', borderRadius: 6, cursor: 'pointer', border: 'none',
                              background: i.screening_approved ? 'rgba(16,185,129,0.1)' : 'rgba(239,68,68,0.1)',
                              color: i.screening_approved ? '#10B981' : '#EF4444', fontSize: 11, fontFamily: 'IBM Plex Mono',
                            }}>
                            {i.screening_approved ? <ShieldCheck size={12} /> : <ShieldX size={12} />}
                            {i.screening_approved ? t('inquiries.screen.approved') : t('inquiries.screen.declined')} · {Math.round(i.screening_score)}
                          </button>
                        ) : (
                          <button onClick={() => openScreen(i)}
                            style={{ display: 'flex', alignItems: 'center', gap: 5, padding: '4px 8px', borderRadius: 6, background: 'var(--bg-app)', border: '1px solid var(--border-strong)', color: 'var(--text-muted)', fontSize: 11, fontFamily: 'IBM Plex Mono', cursor: 'pointer' }}>
                            <ShieldQuestion size={12} /> {t('inquiries.screenBtn')}
                          </button>
                        )}
                      </td>
                      <td style={{ padding: '14px 16px' }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                          {i.status !== 'converted' ? (
                            <button onClick={() => convertToTenant(i)} disabled={convertingId === i.id} title={t('inquiries.convertTitle')}
                              style={{ display: 'flex', alignItems: 'center', gap: 5, padding: '6px 10px', borderRadius: 6, background: 'rgba(16,185,129,0.1)', border: '1px solid rgba(16,185,129,0.3)', color: '#10B981', fontSize: 11, fontFamily: 'IBM Plex Mono', cursor: 'pointer' }}>
                              <UserPlus size={11} /> {convertingId === i.id ? '...' : t('inquiries.convert')}
                            </button>
                          ) : (
                            <span style={{ display: 'flex', alignItems: 'center', gap: 5, fontSize: 11, color: '#10B981' }}><Users size={11} /> {t('inquiries.tenant')}</span>
                          )}
                          <button onClick={() => deleteInquiry(i)} title={t('inquiries.deleteTitle')}
                            style={{ display: 'flex', alignItems: 'center', padding: '6px 8px', borderRadius: 6, background: 'rgba(239,68,68,0.08)', border: '1px solid rgba(239,68,68,0.25)', color: '#EF4444', cursor: 'pointer' }}>
                            <Trash2 size={11} />
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}
      </div>

      {screeningInquiry && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.6)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 200, padding: 20 }}
          onClick={() => setScreeningInquiry(null)}>
          <div style={{ background: 'var(--bg-surface)', border: '1px solid var(--border-strong)', borderRadius: 14, padding: 24, width: '100%', maxWidth: 440 }}
            onClick={e => e.stopPropagation()}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 4 }}>
              <h2 style={{ fontFamily: 'Syne', fontWeight: 700, fontSize: 16, color: 'var(--text-primary)' }}>
                {t('inquiries.screenModal.title', { name: `${screeningInquiry.first_name} ${screeningInquiry.last_name}` })}
              </h2>
              <button onClick={() => setScreeningInquiry(null)} style={{ background: 'none', border: 'none', color: 'var(--text-muted)', cursor: 'pointer' }}><X size={16} /></button>
            </div>
            <p style={{ fontSize: 12, color: 'var(--text-muted)', marginBottom: 18 }}>{t('inquiries.screenModal.subtitle')}</p>

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10, marginBottom: 12 }}>
              <ScreenField label={t('inquiries.screenModal.annualIncome')} value={screenForm.annual_income} onChange={v => setScreenForm(p => ({ ...p, annual_income: v }))} />
              <ScreenField label={t('inquiries.screenModal.monthlyRent')} value={screenForm.monthly_rent} onChange={v => setScreenForm(p => ({ ...p, monthly_rent: v }))} />
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10, marginBottom: 12 }}>
              <ScreenField label={t('inquiries.screenModal.creditScore')} value={screenForm.credit_score} onChange={v => setScreenForm(p => ({ ...p, credit_score: v }))} />
              <ScreenField label={t('inquiries.screenModal.employer')} value={screenForm.employer} onChange={v => setScreenForm(p => ({ ...p, employer: v }))} type="text" />
            </div>
            <div style={{ marginBottom: 20 }}>
              <label style={lbl}>{t('inquiries.screenModal.employmentStatus')}</label>
              <select value={screenForm.employment_status} onChange={e => setScreenForm(p => ({ ...p, employment_status: e.target.value }))} style={inp}>
                <option value="">{t('inquiries.screenModal.select')}</option>
                {EMPLOYMENT_STATUSES.map(s => <option key={s} value={s}>{t(`inquiries.employment.${s}`)}</option>)}
              </select>
            </div>

            {screeningInquiry.screened_at && (
              <div style={{ marginBottom: 16, padding: '10px 12px', borderRadius: 8, background: screeningInquiry.screening_approved ? 'rgba(16,185,129,0.08)' : 'rgba(239,68,68,0.08)', fontSize: 12, color: 'var(--text-secondary)' }}>
                {t('inquiries.screenModal.lastScreened', {
                  date: new Date(screeningInquiry.screened_at).toLocaleDateString(),
                  result: screeningInquiry.screening_approved ? t('inquiries.screen.approved') : t('inquiries.screen.declined'),
                  score: Math.round(screeningInquiry.screening_score),
                })}
                {screeningInquiry.screening_notes && <div style={{ marginTop: 4 }}>{screeningInquiry.screening_notes}</div>}
              </div>
            )}

            <button onClick={submitScreen} disabled={submittingScreen} style={{
              width: '100%', padding: 12, background: 'linear-gradient(135deg, #FBC02D, #F57F17)', color: 'var(--bg-app)',
              fontWeight: 700, fontFamily: 'Syne', fontSize: 14, border: 'none', borderRadius: 8, cursor: 'pointer',
            }}>
              {submittingScreen ? t('inquiries.screenModal.screening') : t('inquiries.screenModal.runScreening')}
            </button>
          </div>
        </div>
      )}
    </DashboardLayout>
  );
}

function ScreenField({ label, value, onChange, type = 'number' }: { label: string; value: string; onChange: (v: string) => void; type?: string }) {
  return (
    <div>
      <label style={lbl}>{label}</label>
      <input type={type} value={value} onChange={e => onChange(e.target.value)} style={inp} />
    </div>
  );
}

const lbl: React.CSSProperties = { display: 'block', marginBottom: 5, fontSize: 12, fontFamily: 'IBM Plex Mono', color: 'var(--text-secondary)' };
const inp: React.CSSProperties = { width: '100%', padding: '9px 12px', background: 'var(--bg-app)', border: '1px solid var(--border-input)', borderRadius: 8, color: 'var(--text-primary)', fontSize: 13, fontFamily: 'IBM Plex Sans', outline: 'none', boxSizing: 'border-box' };
