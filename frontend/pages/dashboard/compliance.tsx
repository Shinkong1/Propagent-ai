import { useEffect, useState } from 'react';
import DashboardLayout from '../../components/DashboardLayout';
import { ShieldCheck, Plus, X, Pencil, Trash2 } from 'lucide-react';
import { compliance as complianceApi, properties as propertiesApi } from '../../lib/api';
import { useLanguage } from '../../lib/LanguageContext';
import PlanLock, { hasPlanAccess } from '../../components/PlanLock';
import ConfirmDialog from '../../components/ConfirmDialog';
import toast from 'react-hot-toast';

const CATEGORIES = ['rental_license', 'fire_inspection', 'insurance', 'smoke_detector', 'lead_paint', 'housing_regulation', 'osha', 'accessibility', 'other'];

const URGENCY_COLOR: Record<string, string> = {
  expired: '#EF4444', critical: '#F97316', warning: '#FBC02D', upcoming: '#3B82F6', ok: '#10B981',
  resolved: '#64748B', waived: '#475569',
};

const EMPTY_FORM = {
  property_id: '', category: 'rental_license', title: '', issuing_authority: '',
  reference_number: '', issued_date: '', expiration_date: '', notes: '',
};

export default function Compliance() {
  const { t } = useLanguage();
  const [items, setItems] = useState<any[]>([]);
  const [dashboard, setDashboard] = useState<any>(null);
  const [propertyList, setPropertyList] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);
  const [form, setForm] = useState<any>(EMPTY_FORM);
  const [editingItem, setEditingItem] = useState<any | null>(null);
  const [editForm, setEditForm] = useState<any>({});
  const [saving, setSaving] = useState(false);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [confirmTarget, setConfirmTarget] = useState<any | null>(null);

  const load = () => {
    Promise.all([complianceApi.list(), complianceApi.dashboard()])
      .then(([itemsRes, dashRes]) => { setItems(itemsRes.data); setDashboard(dashRes.data); })
      .catch(() => {})
      .finally(() => setLoading(false));
  };

  useEffect(() => {
    load();
    propertiesApi.list().then(r => setPropertyList(r.data || [])).catch(() => {});
  }, []);

  const openAddModal = () => {
    setForm({ ...EMPTY_FORM, property_id: propertyList[0]?.id || '' });
    setShowModal(true);
  };

  const create = async () => {
    if (!form.property_id || !form.title || !form.expiration_date) {
      toast.error(t('compliance.requiredFields'));
      return;
    }
    setSaving(true);
    try {
      const { issued_date, reference_number, issuing_authority, notes, ...rest } = form;
      await complianceApi.create({
        ...rest,
        issued_date: issued_date || undefined,
        reference_number: reference_number || undefined,
        issuing_authority: issuing_authority || undefined,
        notes: notes || undefined,
      });
      setShowModal(false);
      toast.success(t('compliance.added'));
      load();
    } catch { toast.error(t('compliance.saveFailed')); }
    finally { setSaving(false); }
  };

  const openEditModal = (item: any) => {
    setEditingItem(item);
    setEditForm({
      category: item.category, title: item.title, issuing_authority: item.issuing_authority || '',
      reference_number: item.reference_number || '', issued_date: item.issued_date || '',
      expiration_date: item.expiration_date, status: item.status, notes: item.notes || '',
    });
  };

  const saveEdit = async () => {
    if (!editingItem) return;
    setSaving(true);
    try {
      const payload = Object.fromEntries(
        Object.entries(editForm).map(([k, v]) => [k, v === '' ? undefined : v])
      );
      await complianceApi.update(editingItem.id, payload);
      toast.success(t('compliance.updated'));
      setEditingItem(null);
      load();
    } catch { toast.error(t('compliance.saveFailed')); }
    finally { setSaving(false); }
  };

  const deleteItem = async (item: any) => {
    setDeletingId(item.id);
    try {
      await complianceApi.delete(item.id);
      toast.success(t('compliance.deleted'));
      load();
    } catch { toast.error(t('compliance.deleteFailed')); }
    finally { setDeletingId(null); }
  };

  if (!hasPlanAccess('professional')) {
    return <PlanLock minTier="professional" titleKey="compliance.title" />;
  }

  if (loading) {
    return (
      <DashboardLayout>
        <div style={{ color: '#64748B', fontFamily: 'IBM Plex Mono' }}>{t('nav.loading')}</div>
      </DashboardLayout>
    );
  }

  const counts = dashboard?.counts || { expired: 0, critical: 0, warning: 0, upcoming: 0, ok: 0 };

  const kpis = [
    { label: t('compliance.totalTracked'), value: dashboard?.total_tracked ?? 0 },
    { label: t('compliance.expired'), value: counts.expired, warn: counts.expired > 0 },
    { label: t('compliance.critical'), value: counts.critical, warn: counts.critical > 0 },
    { label: t('compliance.warning'), value: counts.warning, warn: counts.warning > 0 },
    { label: t('compliance.upcoming'), value: counts.upcoming },
  ];

  return (
    <DashboardLayout>
      <div style={{ maxWidth: 1200 }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 6 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
            <ShieldCheck size={24} color="#FBC02D" />
            <h1 style={{ fontFamily: 'Syne', fontWeight: 800, fontSize: 26, color: 'var(--text-primary)' }}>{t('compliance.title')}</h1>
          </div>
          <button onClick={openAddModal} style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '10px 18px', background: 'linear-gradient(135deg, #FBC02D, #F57F17)', color: 'var(--bg-app)', border: 'none', borderRadius: 8, fontWeight: 700, fontFamily: 'Syne', fontSize: 14, cursor: 'pointer' }}>
            <Plus size={16} /> {t('compliance.addItem')}
          </button>
        </div>
        <p style={{ color: '#64748B', fontSize: 14, marginBottom: 24 }}>{t('compliance.subtitle')}</p>

        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(5, 1fr)', gap: 12, marginBottom: 28 }}>
          {kpis.map(k => (
            <div key={k.label} style={{ background: 'var(--bg-surface)', border: '1px solid var(--border-strong)', borderRadius: 12, padding: '14px 16px' }}>
              <div style={{ fontSize: 10, fontFamily: 'IBM Plex Mono', color: '#64748B', marginBottom: 6, letterSpacing: '0.5px' }}>{k.label.toUpperCase()}</div>
              <div style={{ fontSize: 22, fontFamily: 'IBM Plex Mono', fontWeight: 600, color: k.warn ? '#EF4444' : 'var(--text-primary)' }}>{k.value}</div>
            </div>
          ))}
        </div>

        <div style={{ background: 'var(--bg-surface)', border: '1px solid var(--border-strong)', borderRadius: 12, overflow: 'hidden' }}>
          <div style={{ overflowX: 'auto' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', minWidth: 820 }}>
              <thead>
                <tr style={{ borderBottom: '1px solid var(--border-strong)' }}>
                  {[t('portfolio.property'), t('compliance.category'), t('compliance.itemTitle'), t('compliance.expirationDate'), t('compliance.daysRemaining'), t('compliance.status'), t('compliance.actions')].map(h => (
                    <th key={h} style={{ padding: '10px 14px', textAlign: 'left', fontSize: 10, fontFamily: 'IBM Plex Mono', color: '#64748B', letterSpacing: '0.5px', whiteSpace: 'nowrap' }}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {items.length === 0 ? (
                  <tr><td colSpan={7} style={{ textAlign: 'center', padding: '50px', color: '#475569', fontFamily: 'IBM Plex Sans' }}>{t('compliance.noItems')}</td></tr>
                ) : items.map(item => (
                  <tr key={item.id} style={{ borderBottom: '1px solid var(--border-subtle)' }}>
                    <td style={{ padding: '12px 14px', fontSize: 13, color: 'var(--text-primary)', fontFamily: 'IBM Plex Sans', fontWeight: 600, whiteSpace: 'nowrap' }}>{item.property_name}</td>
                    <td style={{ padding: '12px 14px', fontSize: 12, color: 'var(--text-secondary)', textTransform: 'capitalize' }}>{t(`compliance.category.${item.category}`)}</td>
                    <td style={{ padding: '12px 14px', fontSize: 12, color: 'var(--text-hover)' }}>{item.title}</td>
                    <td style={{ padding: '12px 14px', fontSize: 12, fontFamily: 'IBM Plex Mono', color: 'var(--text-secondary)', whiteSpace: 'nowrap' }}>{item.expiration_date}</td>
                    <td style={{ padding: '12px 14px', fontSize: 12, fontFamily: 'IBM Plex Mono', color: item.days_until_expiration < 0 ? '#EF4444' : 'var(--text-secondary)' }}>
                      {item.days_until_expiration < 0 ? `${Math.abs(item.days_until_expiration)}d ${t('compliance.overdue')}` : `${item.days_until_expiration}d`}
                    </td>
                    <td style={{ padding: '12px 14px' }}>
                      <span style={{ fontSize: 10, padding: '3px 8px', borderRadius: 4, background: `${URGENCY_COLOR[item.urgency]}20`, color: URGENCY_COLOR[item.urgency], fontFamily: 'IBM Plex Mono', fontWeight: 600 }}>
                        {t(`compliance.urgency.${item.urgency}`)}
                      </span>
                    </td>
                    <td style={{ padding: '12px 14px' }}>
                      <div style={{ display: 'flex', gap: 6 }}>
                        <button onClick={() => openEditModal(item)} title={t('compliance.edit')}
                          style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', width: 28, height: 28, borderRadius: 6, background: 'rgba(59,130,246,0.1)', border: '1px solid rgba(59,130,246,0.3)', color: '#3B82F6', cursor: 'pointer' }}>
                          <Pencil size={12} />
                        </button>
                        <button onClick={() => setConfirmTarget(item)} disabled={deletingId === item.id} title={t('compliance.delete')}
                          style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', width: 28, height: 28, borderRadius: 6, background: 'rgba(239,68,68,0.1)', border: '1px solid rgba(239,68,68,0.3)', color: '#EF4444', cursor: 'pointer' }}>
                          <Trash2 size={12} />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
        <p style={{ marginTop: 14, fontSize: 11, color: '#475569' }}>{t('compliance.note')}</p>

        {/* Add Modal */}
        {showModal && (
          <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.8)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000 }}>
            <div style={{ background: 'var(--bg-surface)', border: '1px solid var(--border-strong)', borderRadius: 16, padding: 28, width: 460, maxHeight: '90vh', overflowY: 'auto' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 }}>
                <h2 style={{ fontFamily: 'Syne', fontWeight: 700, fontSize: 18, color: 'var(--text-primary)' }}>{t('compliance.addItem')}</h2>
                <button onClick={() => setShowModal(false)} style={{ background: 'none', border: 'none', color: '#64748B', cursor: 'pointer' }}><X size={18} /></button>
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12, marginBottom: 14 }}>
                <div>
                  <label style={lbl}>{t('portfolio.property')}</label>
                  <select value={form.property_id} onChange={e => setForm((p: any) => ({ ...p, property_id: e.target.value }))} style={{ ...inp } as any}>
                    {propertyList.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
                  </select>
                </div>
                <div>
                  <label style={lbl}>{t('compliance.category')}</label>
                  <select value={form.category} onChange={e => setForm((p: any) => ({ ...p, category: e.target.value }))} style={{ ...inp } as any}>
                    {CATEGORIES.map(c => <option key={c} value={c}>{t(`compliance.category.${c}`)}</option>)}
                  </select>
                </div>
              </div>
              <div style={{ marginBottom: 14 }}>
                <label style={lbl}>{t('compliance.itemTitle')}</label>
                <input value={form.title} onChange={e => setForm((p: any) => ({ ...p, title: e.target.value }))} placeholder="Annual Fire Inspection" style={inp} spellCheck autoCorrect="on" autoCapitalize="sentences" />
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12, marginBottom: 14 }}>
                <div>
                  <label style={lbl}>{t('compliance.issuingAuthority')}</label>
                  <input value={form.issuing_authority} onChange={e => setForm((p: any) => ({ ...p, issuing_authority: e.target.value }))} style={inp} spellCheck autoCorrect="on" autoCapitalize="words" />
                </div>
                <div>
                  <label style={lbl}>{t('compliance.referenceNumber')}</label>
                  <input value={form.reference_number} onChange={e => setForm((p: any) => ({ ...p, reference_number: e.target.value }))} style={inp} spellCheck={false} autoCorrect="off" />
                </div>
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12, marginBottom: 14 }}>
                <div>
                  <label style={lbl}>{t('compliance.issuedDate')}</label>
                  <input type="date" value={form.issued_date} onChange={e => setForm((p: any) => ({ ...p, issued_date: e.target.value }))} style={inp} />
                </div>
                <div>
                  <label style={lbl}>{t('compliance.expirationDate')}</label>
                  <input type="date" value={form.expiration_date} onChange={e => setForm((p: any) => ({ ...p, expiration_date: e.target.value }))} style={inp} />
                </div>
              </div>
              <div style={{ marginBottom: 20 }}>
                <label style={lbl}>{t('compliance.notes')}</label>
                <textarea value={form.notes} onChange={e => setForm((p: any) => ({ ...p, notes: e.target.value }))}
                  spellCheck autoCorrect="on" autoCapitalize="sentences"
                  style={{ ...inp, height: 70, resize: 'none' } as any} />
              </div>
              <button onClick={create} disabled={saving} style={{ width: '100%', padding: 12, background: 'linear-gradient(135deg, #FBC02D, #F57F17)', color: 'var(--bg-app)', fontWeight: 700, fontFamily: 'Syne', border: 'none', borderRadius: 8, cursor: 'pointer' }}>
                {saving ? t('compliance.saving') : t('compliance.addItem')}
              </button>
            </div>
          </div>
        )}

        {/* Edit Modal */}
        {editingItem && (
          <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.8)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000 }}>
            <div style={{ background: 'var(--bg-surface)', border: '1px solid var(--border-strong)', borderRadius: 16, padding: 28, width: 460, maxHeight: '90vh', overflowY: 'auto' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 }}>
                <h2 style={{ fontFamily: 'Syne', fontWeight: 700, fontSize: 18, color: 'var(--text-primary)' }}>{editingItem.title}</h2>
                <button onClick={() => setEditingItem(null)} style={{ background: 'none', border: 'none', color: '#64748B', cursor: 'pointer' }}><X size={18} /></button>
              </div>
              <div style={{ marginBottom: 14 }}>
                <label style={lbl}>{t('compliance.itemTitle')}</label>
                <input value={editForm.title} onChange={e => setEditForm((p: any) => ({ ...p, title: e.target.value }))} style={inp} spellCheck autoCorrect="on" autoCapitalize="sentences" />
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12, marginBottom: 14 }}>
                <div>
                  <label style={lbl}>{t('compliance.category')}</label>
                  <select value={editForm.category} onChange={e => setEditForm((p: any) => ({ ...p, category: e.target.value }))} style={{ ...inp } as any}>
                    {CATEGORIES.map(c => <option key={c} value={c}>{t(`compliance.category.${c}`)}</option>)}
                  </select>
                </div>
                <div>
                  <label style={lbl}>{t('compliance.status')}</label>
                  <select value={editForm.status} onChange={e => setEditForm((p: any) => ({ ...p, status: e.target.value }))} style={{ ...inp } as any}>
                    <option value="active">{t('compliance.urgency.active')}</option>
                    <option value="resolved">{t('compliance.urgency.resolved')}</option>
                    <option value="waived">{t('compliance.urgency.waived')}</option>
                  </select>
                </div>
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12, marginBottom: 14 }}>
                <div>
                  <label style={lbl}>{t('compliance.issuedDate')}</label>
                  <input type="date" value={editForm.issued_date} onChange={e => setEditForm((p: any) => ({ ...p, issued_date: e.target.value }))} style={inp} />
                </div>
                <div>
                  <label style={lbl}>{t('compliance.expirationDate')}</label>
                  <input type="date" value={editForm.expiration_date} onChange={e => setEditForm((p: any) => ({ ...p, expiration_date: e.target.value }))} style={inp} />
                </div>
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12, marginBottom: 14 }}>
                <div>
                  <label style={lbl}>{t('compliance.issuingAuthority')}</label>
                  <input value={editForm.issuing_authority} onChange={e => setEditForm((p: any) => ({ ...p, issuing_authority: e.target.value }))} style={inp} spellCheck autoCorrect="on" autoCapitalize="words" />
                </div>
                <div>
                  <label style={lbl}>{t('compliance.referenceNumber')}</label>
                  <input value={editForm.reference_number} onChange={e => setEditForm((p: any) => ({ ...p, reference_number: e.target.value }))} style={inp} spellCheck={false} autoCorrect="off" />
                </div>
              </div>
              <div style={{ marginBottom: 20 }}>
                <label style={lbl}>{t('compliance.notes')}</label>
                <textarea value={editForm.notes} onChange={e => setEditForm((p: any) => ({ ...p, notes: e.target.value }))}
                  spellCheck autoCorrect="on" autoCapitalize="sentences"
                  style={{ ...inp, height: 70, resize: 'none' } as any} />
              </div>
              <button onClick={saveEdit} disabled={saving} style={{ width: '100%', padding: 12, background: 'linear-gradient(135deg, #FBC02D, #F57F17)', color: 'var(--bg-app)', fontWeight: 700, fontFamily: 'Syne', border: 'none', borderRadius: 8, cursor: 'pointer' }}>
                {saving ? t('compliance.saving') : t('compliance.saveChanges')}
              </button>
            </div>
          </div>
        )}

        <ConfirmDialog
          open={!!confirmTarget}
          message={t('compliance.confirmDelete').replace('{title}', confirmTarget?.title || '')}
          confirmLabel={t('compliance.delete')}
          cancelLabel={t('common.cancel')}
          onCancel={() => setConfirmTarget(null)}
          onConfirm={() => { const item = confirmTarget; setConfirmTarget(null); deleteItem(item); }}
        />
      </div>
    </DashboardLayout>
  );
}

const lbl: React.CSSProperties = { display: 'block', marginBottom: 5, fontSize: 12, fontFamily: 'IBM Plex Mono', color: 'var(--text-secondary)' };
const inp: React.CSSProperties = { width: '100%', padding: '9px 12px', background: 'var(--bg-app)', border: '1px solid var(--border-input)', borderRadius: 8, color: 'var(--text-primary)', fontSize: 13, fontFamily: 'IBM Plex Sans', outline: 'none', boxSizing: 'border-box' };
