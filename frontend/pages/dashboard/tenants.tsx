import { useEffect, useState } from 'react';
import { useRouter } from 'next/router';
import DashboardLayout from '../../components/DashboardLayout';
import { Users, Plus, X, CheckCircle, XCircle, Building2, FileText, Lock, Pencil, Trash2, ShieldAlert, ChevronDown, ChevronUp, Upload } from 'lucide-react';
import { tenants as tenantsApi, properties as propertiesApi, fraud as fraudApi } from '../../lib/api';
import { getUser } from '../../lib/auth';
import { localDateString } from '../../lib/date';
import { useCurrency } from '../../lib/CurrencyContext';
import ConfirmDialog from '../../components/ConfirmDialog';
import ImportModal from '../../components/ImportModal';
import Link from 'next/link';
import toast from 'react-hot-toast';

const EMPTY_FORM = { first_name: '', last_name: '', email: '', phone: '', annual_income: '', employment_status: 'employed', employer: '', property_id: '', unit_id: '' };
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

const FIELD_INPUT_TYPE: Record<string, string> = { email: 'email', phone: 'tel', annual_income: 'number' };

function validateTenantForm(f: { first_name: string; last_name: string; email: string; phone: string }): string | null {
  if (!f.first_name.trim() || !f.last_name.trim()) return 'First and last name are required';
  if (f.email.trim() && !EMAIL_RE.test(f.email.trim())) return 'Enter a valid email address';
  if (f.phone.trim() && f.phone.replace(/\D/g, '').length < 7) return 'Enter a valid phone number';
  return null;
}

export default function Tenants() {
  const router = useRouter();
  const { formatMoney, symbol } = useCurrency();
  const [tenantList, setTenantList] = useState<any[]>([]);
  const [propertyList, setPropertyList] = useState<any[]>([]);
  const [propertyFilter, setPropertyFilter] = useState('all');
  const [showModal, setShowModal] = useState(false);
  const [form, setForm] = useState(EMPTY_FORM);
  const [unitsForProperty, setUnitsForProperty] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);
  const [downloadingLease, setDownloadingLease] = useState<string | null>(null);
  const [showImportModal, setShowImportModal] = useState(false);
  const [importPropertyId, setImportPropertyId] = useState('');
  const [invitingId, setInvitingId] = useState<string | null>(null);

  const [editingTenant, setEditingTenant] = useState<any | null>(null);
  const [editForm, setEditForm] = useState<any>({});
  const [editUnits, setEditUnits] = useState<any[]>([]);
  const [saving, setSaving] = useState(false);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [confirmTarget, setConfirmTarget] = useState<any | null>(null);

  const userPlan = getUser()?.plan;
  const canGenerateContracts = userPlan === 'professional' || userPlan === 'enterprise';

  const [fraudFlags, setFraudFlags] = useState<any[]>([]);
  const [fraudExpanded, setFraudExpanded] = useState(false);

  const load = (propertyId?: string) => {
    tenantsApi.list(propertyId === 'all' ? undefined : propertyId).then(r => setTenantList(r.data || [])).catch(() => {});
  };

  const loadFraudFlags = () => {
    fraudApi.scan().then(r => setFraudFlags(r.data.flags || [])).catch(() => {});
  };

  const downloadContract = async (leaseId: string, tenantName: string) => {
    setDownloadingLease(leaseId);
    try {
      const res = await tenantsApi.downloadContract(leaseId);
      const url = window.URL.createObjectURL(new Blob([res.data], { type: 'application/pdf' }));
      const a = document.createElement('a');
      a.href = url;
      a.download = `lease_${tenantName.replace(/\s+/g, '_')}.pdf`;
      document.body.appendChild(a);
      a.click();
      a.remove();
      window.URL.revokeObjectURL(url);
    } catch {
      toast.error('Failed to generate contract');
    } finally {
      setDownloadingLease(null);
    }
  };

  useEffect(() => {
    if (!router.isReady) return;
    const fromQuery = typeof router.query.property === 'string' ? router.query.property : 'all';
    setPropertyFilter(fromQuery);
    load(fromQuery);
    propertiesApi.list().then(r => setPropertyList(r.data || [])).catch(() => {});
    loadFraudFlags();
  }, [router.isReady]);

  const changePropertyFilter = (propertyId: string) => {
    setPropertyFilter(propertyId);
    load(propertyId);
  };

  const fetchVacantUnits = (propertyId: string, setter: (units: any[]) => void) => {
    if (!propertyId) { setter([]); return; }
    propertiesApi.listUnits(propertyId).then(r => setter((r.data || []).filter((u: any) => !u.is_occupied))).catch(() => setter([]));
  };

  const openAddModal = () => {
    const initialProperty = propertyFilter !== 'all' ? propertyFilter : '';
    setForm({ ...EMPTY_FORM, property_id: initialProperty });
    setUnitsForProperty([]);
    if (initialProperty) {
      fetchVacantUnits(initialProperty, units => {
        setUnitsForProperty(units);
        if (units.length > 0) setForm(p => ({ ...p, unit_id: units[0].id }));
      });
    }
    setShowModal(true);
  };

  const changeAddProperty = (propertyId: string) => {
    setForm(p => ({ ...p, property_id: propertyId, unit_id: '' }));
    fetchVacantUnits(propertyId, units => {
      setUnitsForProperty(units);
      if (units.length > 0) setForm(p => ({ ...p, unit_id: units[0].id }));
    });
  };

  const create = async () => {
    const validationError = validateTenantForm(form);
    if (validationError) { toast.error(validationError); return; }

    setLoading(true);
    try {
      const { unit_id, property_id, ...tenantFields } = form;
      const res = await tenantsApi.create({ ...tenantFields, annual_income: form.annual_income ? parseFloat(form.annual_income) : undefined });

      if (unit_id) {
        const unit = unitsForProperty.find(u => u.id === unit_id);
        const today = new Date();
        const oneYearOut = new Date(today); oneYearOut.setFullYear(today.getFullYear() + 1);
        await tenantsApi.createLease({
          tenant_id: res.data.id,
          unit_id,
          monthly_rent: unit?.monthly_rent || 0,
          security_deposit: unit ? unit.monthly_rent * 1.5 : 0,
          start_date: localDateString(today),
          end_date: localDateString(oneYearOut),
        });
      }

      setShowModal(false);
      if (!unit_id && propertyFilter !== 'all') {
        // A tenant with no unit has no lease yet, and the property-filtered
        // list only shows tenants with an active lease at that property --
        // so without this, the tenant we just successfully created would be
        // invisible under the current filter (confirmed by a real tester:
        // "it says the tenant was added, but I don't see it"). Switch to
        // "All Properties" so it's actually visible right away.
        toast.success('Tenant added! Showing all properties since they aren\'t assigned to a unit yet.');
        setPropertyFilter('all');
        load('all');
      } else {
        toast.success(unit_id ? 'Tenant added and assigned to unit!' : 'Tenant added!');
        load(propertyFilter);
      }
    } catch (err: any) {
      toast.error(err?.response?.data?.detail || 'Failed to add tenant');
    }
    finally { setLoading(false); }
  };

  const openEditModal = (t: any) => {
    setEditingTenant(t);
    setEditForm({
      first_name: t.first_name || '', last_name: t.last_name || '', email: t.email || '',
      phone: t.phone || '', annual_income: t.annual_income || '', employment_status: t.employment_status || 'employed',
      employer: t.employer || '', property_id: '', unit_id: '',
    });
    setEditUnits([]);
  };

  const changeEditProperty = (propertyId: string) => {
    setEditForm((p: any) => ({ ...p, property_id: propertyId, unit_id: '' }));
    fetchVacantUnits(propertyId, setEditUnits);
  };

  const saveEdit = async () => {
    if (!editingTenant) return;
    const validationError = validateTenantForm(editForm);
    if (validationError) { toast.error(validationError); return; }

    setSaving(true);
    try {
      const { property_id, unit_id, ...fields } = editForm;
      await tenantsApi.update(editingTenant.id, { ...fields, annual_income: fields.annual_income ? parseFloat(fields.annual_income) : undefined });

      if (!editingTenant.active_lease_id && unit_id) {
        const unit = editUnits.find(u => u.id === unit_id);
        const today = new Date();
        const oneYearOut = new Date(today); oneYearOut.setFullYear(today.getFullYear() + 1);
        await tenantsApi.createLease({
          tenant_id: editingTenant.id,
          unit_id,
          monthly_rent: unit?.monthly_rent || 0,
          security_deposit: unit ? unit.monthly_rent * 1.5 : 0,
          start_date: localDateString(today),
          end_date: localDateString(oneYearOut),
        });
      }

      toast.success('Tenant updated');
      setEditingTenant(null);
      load(propertyFilter);
    } catch (err: any) {
      toast.error(err?.response?.data?.detail || 'Failed to update tenant');
    }
    finally { setSaving(false); }
  };

  const inviteToPortal = async (t: any) => {
    if (!t.email) {
      toast.error('This tenant has no email on file — add one first');
      return;
    }
    setInvitingId(t.id);
    try {
      const res = await tenantsApi.invite(t.id);
      if (res.data.email_status === 'sent') {
        toast.success('Portal invite sent');
      } else {
        toast.error(`Invite created, but the email didn't send (${res.data.email_status})`);
      }
      load(propertyFilter);
    } catch (err: any) {
      toast.error(err?.response?.data?.detail || 'Failed to send invite');
    } finally {
      setInvitingId(null);
    }
  };

  const deleteTenant = async (t: any) => {
    setDeletingId(t.id);
    try {
      await tenantsApi.delete(t.id);
      toast.success('Tenant removed');
      load(propertyFilter);
    } catch { toast.error('Failed to remove tenant'); }
    finally { setDeletingId(null); }
  };

  return (
    <DashboardLayout>
      <div style={{ maxWidth: 1200 }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 28, flexWrap: 'wrap', gap: 12 }}>
          <div>
            <h1 style={{ fontFamily: 'Syne', fontWeight: 800, fontSize: 28, color: 'var(--text-primary)', marginBottom: 4 }}>Tenants</h1>
            <p style={{ color: 'var(--text-muted)', fontSize: 14 }}>{tenantList.length} active tenants</p>
          </div>
          <div style={{ display: 'flex', gap: 10 }}>
            <select value={propertyFilter} onChange={e => changePropertyFilter(e.target.value)}
              style={{ padding: '9px 14px', background: 'var(--bg-surface)', border: '1px solid var(--border-strong)', borderRadius: 8, color: 'var(--text-secondary)', fontSize: 13, fontFamily: 'IBM Plex Sans', outline: 'none' }}>
              <option value="all">All Properties</option>
              {propertyList.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
            </select>
            <button onClick={() => { setImportPropertyId(propertyFilter !== 'all' ? propertyFilter : ''); setShowImportModal(true); }} style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '10px 18px', background: 'var(--bg-surface)', border: '1px solid var(--border-strong)', borderRadius: 8, color: 'var(--text-secondary)', fontWeight: 600, fontFamily: 'Syne', fontSize: 14, cursor: 'pointer' }}>
              <Upload size={16} /> Import
            </button>
            <button onClick={openAddModal} style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '10px 18px', background: 'linear-gradient(135deg, #FBC02D, #F57F17)', color: 'var(--bg-app)', border: 'none', borderRadius: 8, fontWeight: 700, fontFamily: 'Syne', fontSize: 14, cursor: 'pointer' }}>
              <Plus size={16} /> Add Tenant
            </button>
          </div>
        </div>

        {fraudFlags.length > 0 && (
          <div style={{ marginBottom: 20, background: 'rgba(239,68,68,0.06)', border: '1px solid rgba(239,68,68,0.3)', borderRadius: 12, overflow: 'hidden' }}>
            <div
              onClick={() => setFraudExpanded(v => !v)}
              style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '14px 18px', cursor: 'pointer' }}
            >
              <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                <ShieldAlert size={18} color="#EF4444" />
                <span style={{ fontFamily: 'Syne', fontWeight: 700, fontSize: 14, color: 'var(--text-primary)' }}>
                  {fraudFlags.length} Risk Flag{fraudFlags.length !== 1 ? 's' : ''} Detected
                </span>
              </div>
              {fraudExpanded ? <ChevronUp size={16} color="#64748B" /> : <ChevronDown size={16} color="#64748B" />}
            </div>
            {fraudExpanded && (
              <div style={{ padding: '0 18px 16px' }}>
                {fraudFlags.map((f, i) => (
                  <div key={i} style={{
                    padding: '10px 0', borderTop: i === 0 ? '1px solid rgba(239,68,68,0.15)' : 'none',
                    borderBottom: i < fraudFlags.length - 1 ? '1px solid rgba(239,68,68,0.15)' : 'none',
                  }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 4 }}>
                      <span style={{
                        fontSize: 10, padding: '2px 8px', borderRadius: 4, fontFamily: 'IBM Plex Mono', fontWeight: 700,
                        background: f.severity === 'high' ? 'rgba(239,68,68,0.15)' : f.severity === 'medium' ? 'rgba(251,192,45,0.15)' : 'rgba(148,163,184,0.15)',
                        color: f.severity === 'high' ? '#EF4444' : f.severity === 'medium' ? '#FBC02D' : '#94A3B8',
                      }}>
                        {f.severity.toUpperCase()}
                      </span>
                      <span style={{ fontSize: 12, color: 'var(--text-muted)', fontFamily: 'IBM Plex Mono' }}>{f.type.replace(/_/g, ' ')}</span>
                    </div>
                    <p style={{ fontSize: 13, color: 'var(--text-secondary)', margin: 0 }}>{f.explanation}</p>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        <div style={{ background: 'var(--bg-surface)', border: '1px solid var(--border-strong)', borderRadius: 12, overflow: 'hidden' }}>
          <div style={{ overflowX: 'auto' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse', minWidth: 640 }}>
            <thead>
              <tr style={{ borderBottom: '1px solid var(--border-strong)' }}>
                {['Tenant', 'Property', 'Contact', 'Employment', 'Income', 'Screening', 'Status', 'Contract', 'Portal', 'Actions'].map(h => (
                  <th key={h} style={{ padding: '12px 16px', textAlign: 'left', fontSize: 11, fontFamily: 'IBM Plex Mono', color: 'var(--text-muted)', letterSpacing: '0.5px', fontWeight: 500 }}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {tenantList.length === 0 ? (
                <tr><td colSpan={10} style={{ textAlign: 'center', padding: '60px', color: '#475569', fontFamily: 'IBM Plex Sans' }}>
                  No tenants yet. Add your first tenant above.
                </td></tr>
              ) : tenantList.map((t: any) => (
                <tr key={t.id} style={{ borderBottom: '1px solid var(--border-subtle)' }}
                  onMouseEnter={e => { (e.currentTarget as HTMLElement).style.background = 'rgba(255,255,255,0.02)'; }}
                  onMouseLeave={e => { (e.currentTarget as HTMLElement).style.background = 'transparent'; }}>
                  <td style={{ padding: '14px 16px' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                      <div style={{ width: 34, height: 34, borderRadius: '50%', background: 'linear-gradient(135deg, var(--border-input), var(--border-strong))', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 13, fontWeight: 700, color: 'var(--text-secondary)', fontFamily: 'Syne' }}>
                        {t.first_name?.[0]}{t.last_name?.[0]}
                      </div>
                      <div>
                        <div style={{ fontSize: 14, fontWeight: 600, color: 'var(--text-primary)', fontFamily: 'IBM Plex Sans' }}>{t.first_name} {t.last_name}</div>
                        <div style={{ fontSize: 11, color: 'var(--text-muted)', fontFamily: 'IBM Plex Mono' }}>ID: {t.id?.slice(0,8)}</div>
                      </div>
                    </div>
                  </td>
                  <td style={{ padding: '14px 16px' }}>
                    {t.property_name ? (
                      <div style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 12, color: 'var(--text-secondary)' }}>
                        <Building2 size={12} /> {t.property_name}{t.unit_number ? ` · Unit ${t.unit_number}` : ''}
                      </div>
                    ) : (
                      <span style={{ fontSize: 12, color: '#475569' }}>Unassigned</span>
                    )}
                  </td>
                  <td style={{ padding: '14px 16px' }}>
                    <div style={{ fontSize: 12, color: 'var(--text-secondary)' }}>{t.email || '—'}</div>
                    <div style={{ fontSize: 12, color: 'var(--text-muted)' }}>{t.phone || ''}</div>
                  </td>
                  <td style={{ padding: '14px 16px', fontSize: 12, color: 'var(--text-secondary)', textTransform: 'capitalize' }}>{t.employment_status || '—'}</td>
                  <td style={{ padding: '14px 16px', fontSize: 13, fontFamily: 'IBM Plex Mono', color: 'var(--text-primary)' }}>
                    {t.annual_income ? formatMoney(Number(t.annual_income)) : '—'}
                  </td>
                  <td style={{ padding: '14px 16px' }}>
                    {t.screening_approved === true && <div style={{ display: 'flex', alignItems: 'center', gap: 4, color: '#10B981', fontSize: 12 }}><CheckCircle size={13} /> Approved</div>}
                    {t.screening_approved === false && <div style={{ display: 'flex', alignItems: 'center', gap: 4, color: '#EF4444', fontSize: 12 }}><XCircle size={13} /> Declined</div>}
                    {t.screening_approved === null && <div style={{ color: 'var(--text-muted)', fontSize: 12 }}>Pending</div>}
                  </td>
                  <td style={{ padding: '14px 16px' }}>
                    <span style={{ fontSize: 10, padding: '3px 8px', borderRadius: 4, background: t.is_active ? 'rgba(16,185,129,0.12)' : 'rgba(239,68,68,0.12)', color: t.is_active ? '#10B981' : '#EF4444', fontFamily: 'IBM Plex Mono' }}>
                      {t.is_active ? 'active' : 'inactive'}
                    </span>
                  </td>
                  <td style={{ padding: '14px 16px' }}>
                    {t.active_lease_id ? (
                      canGenerateContracts ? (
                        <button
                          onClick={() => downloadContract(t.active_lease_id, `${t.first_name}_${t.last_name}`)}
                          disabled={downloadingLease === t.active_lease_id}
                          style={{ display: 'flex', alignItems: 'center', gap: 5, padding: '5px 10px', borderRadius: 6, background: 'rgba(var(--accent-rgb),0.1)', border: '1px solid rgba(var(--accent-rgb),0.3)', color: '#FBC02D', fontSize: 11, fontFamily: 'IBM Plex Mono', cursor: 'pointer' }}>
                          <FileText size={11} /> {downloadingLease === t.active_lease_id ? '...' : 'Generate'}
                        </button>
                      ) : (
                        <Link href="/pricing" title="Upgrade to Professional to generate rental contracts" style={{ display: 'flex', alignItems: 'center', gap: 5, padding: '5px 10px', borderRadius: 6, background: 'rgba(100,116,139,0.1)', border: '1px solid var(--border-strong)', color: 'var(--text-muted)', fontSize: 11, fontFamily: 'IBM Plex Mono', textDecoration: 'none', width: 'fit-content' }}>
                          <Lock size={11} /> Upgrade
                        </Link>
                      )
                    ) : (
                      <span style={{ fontSize: 11, color: '#334155' }}>No lease</span>
                    )}
                  </td>
                  <td style={{ padding: '14px 16px' }}>
                    {t.portal_status === 'active' ? (
                      <span style={{ fontSize: 10, padding: '3px 8px', borderRadius: 4, background: 'rgba(16,185,129,0.12)', color: '#10B981', fontFamily: 'IBM Plex Mono' }}>Active</span>
                    ) : t.portal_status === 'invited' ? (
                      <span style={{ fontSize: 10, padding: '3px 8px', borderRadius: 4, background: 'rgba(251,192,45,0.12)', color: '#FBC02D', fontFamily: 'IBM Plex Mono' }}>Invited</span>
                    ) : (
                      <button onClick={() => inviteToPortal(t)} disabled={invitingId === t.id} title={t.email ? 'Invite to tenant portal' : 'Add an email first'}
                        style={{ padding: '4px 10px', borderRadius: 6, background: 'rgba(59,130,246,0.1)', border: '1px solid rgba(59,130,246,0.3)', color: '#3B82F6', fontSize: 11, fontFamily: 'IBM Plex Mono', cursor: 'pointer' }}>
                        {invitingId === t.id ? '...' : 'Invite'}
                      </button>
                    )}
                  </td>
                  <td style={{ padding: '14px 16px' }}>
                    <div style={{ display: 'flex', gap: 6 }}>
                      <button onClick={() => openEditModal(t)} title="Edit tenant"
                        style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', width: 28, height: 28, borderRadius: 6, background: 'rgba(59,130,246,0.1)', border: '1px solid rgba(59,130,246,0.3)', color: '#3B82F6', cursor: 'pointer' }}>
                        <Pencil size={12} />
                      </button>
                      <button onClick={() => setConfirmTarget(t)} disabled={deletingId === t.id} title="Remove tenant"
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

        {/* Add Tenant Modal */}
        {showModal && (
          <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.8)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000, padding: 20 }}>
            <div style={{ background: 'var(--bg-surface)', border: '1px solid var(--border-strong)', borderRadius: 16, padding: 28, width: '100%', maxWidth: 460, maxHeight: '90vh', overflowY: 'auto' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 }}>
                <h2 style={{ fontFamily: 'Syne', fontWeight: 700, fontSize: 18, color: 'var(--text-primary)' }}>Add Tenant</h2>
                <button onClick={() => setShowModal(false)} style={{ background: 'none', border: 'none', color: 'var(--text-muted)', cursor: 'pointer' }}><X size={18} /></button>
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: 12, marginBottom: 14 }}>
                <div>
                  <label style={lbl}>First Name <span style={{ color: '#EF4444' }}>*</span></label>
                  <input value={form.first_name} onChange={e => setForm(p => ({ ...p, first_name: e.target.value }))} required style={inp} {...textFieldAttrs('first_name')} />
                </div>
                <div>
                  <label style={lbl}>Last Name <span style={{ color: '#EF4444' }}>*</span></label>
                  <input value={form.last_name} onChange={e => setForm(p => ({ ...p, last_name: e.target.value }))} required style={inp} {...textFieldAttrs('last_name')} />
                </div>
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: 12, marginBottom: 14 }}>
                <div>
                  <label style={lbl}>Property</label>
                  <select value={form.property_id} onChange={e => changeAddProperty(e.target.value)} style={{ ...inp } as any}>
                    <option value="">No property</option>
                    {propertyList.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
                  </select>
                </div>
                <div>
                  <label style={lbl}>Unit</label>
                  <select value={form.unit_id} onChange={e => setForm(p => ({ ...p, unit_id: e.target.value }))} disabled={!form.property_id} style={{ ...inp } as any}>
                    <option value="">Leave unassigned</option>
                    {unitsForProperty.map(u => <option key={u.id} value={u.id}>Unit {u.unit_number} — {formatMoney(u.monthly_rent)}/mo</option>)}
                  </select>
                </div>
              </div>
              {form.property_id && unitsForProperty.length === 0 && (
                <div style={{ fontSize: 11, color: 'var(--text-muted)', marginTop: -6, marginBottom: 14 }}>No vacant units at this property right now.</div>
              )}
              {[['email', 'Email'], ['phone', 'Phone'], ['employer', 'Employer'], ['annual_income', `Annual Income (${symbol})`]].map(([k, l]) => (
                <div key={k} style={{ marginBottom: 14 }}>
                  <label style={lbl}>{l}</label>
                  <input type={FIELD_INPUT_TYPE[k] || 'text'} value={(form as any)[k]} onChange={e => setForm(p => ({ ...p, [k]: e.target.value }))} style={inp} {...textFieldAttrs(k)} />
                </div>
              ))}
              <div style={{ marginBottom: 20 }}>
                <label style={lbl}>Employment Status</label>
                <select value={form.employment_status} onChange={e => setForm(p => ({ ...p, employment_status: e.target.value }))} style={{ ...inp } as any}>
                  {['employed','self-employed','unemployed','student','retired'].map(s => <option key={s} value={s}>{s.replace('-', ' ')}</option>)}
                </select>
              </div>
              <button onClick={create} disabled={loading} style={{ width: '100%', padding: 12, background: 'linear-gradient(135deg, #FBC02D, #F57F17)', color: 'var(--bg-app)', fontWeight: 700, fontFamily: 'Syne', border: 'none', borderRadius: 8, cursor: 'pointer' }}>
                {loading ? 'Adding...' : 'Add Tenant'}
              </button>
            </div>
          </div>
        )}

        {/* Edit Tenant Modal */}
        {editingTenant && (
          <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.8)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000, padding: 20 }}>
            <div style={{ background: 'var(--bg-surface)', border: '1px solid var(--border-strong)', borderRadius: 16, padding: 28, width: '100%', maxWidth: 460, maxHeight: '90vh', overflowY: 'auto' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 }}>
                <h2 style={{ fontFamily: 'Syne', fontWeight: 700, fontSize: 18, color: 'var(--text-primary)' }}>Edit {editingTenant.first_name} {editingTenant.last_name}</h2>
                <button onClick={() => setEditingTenant(null)} style={{ background: 'none', border: 'none', color: 'var(--text-muted)', cursor: 'pointer' }}><X size={18} /></button>
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: 12, marginBottom: 14 }}>
                <div>
                  <label style={lbl}>First Name <span style={{ color: '#EF4444' }}>*</span></label>
                  <input value={editForm.first_name} onChange={e => setEditForm((p: any) => ({ ...p, first_name: e.target.value }))} required style={inp} {...textFieldAttrs('first_name')} />
                </div>
                <div>
                  <label style={lbl}>Last Name <span style={{ color: '#EF4444' }}>*</span></label>
                  <input value={editForm.last_name} onChange={e => setEditForm((p: any) => ({ ...p, last_name: e.target.value }))} required style={inp} {...textFieldAttrs('last_name')} />
                </div>
              </div>

              {editingTenant.property_name ? (
                <div style={{ marginBottom: 14, padding: '10px 12px', background: 'var(--bg-app)', borderRadius: 8, fontSize: 12, color: 'var(--text-secondary)' }}>
                  <Building2 size={12} style={{ verticalAlign: -1, marginRight: 6 }} />
                  Currently at {editingTenant.property_name}{editingTenant.unit_number ? ` · Unit ${editingTenant.unit_number}` : ''}
                </div>
              ) : (
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: 12, marginBottom: 14 }}>
                  <div>
                    <label style={lbl}>Assign Property</label>
                    <select value={editForm.property_id} onChange={e => changeEditProperty(e.target.value)} style={{ ...inp } as any}>
                      <option value="">Not assigned</option>
                      {propertyList.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
                    </select>
                  </div>
                  <div>
                    <label style={lbl}>Unit</label>
                    <select value={editForm.unit_id} onChange={e => setEditForm((p: any) => ({ ...p, unit_id: e.target.value }))} disabled={!editForm.property_id} style={{ ...inp } as any}>
                      <option value="">Leave unassigned</option>
                      {editUnits.map(u => <option key={u.id} value={u.id}>Unit {u.unit_number} — {formatMoney(u.monthly_rent)}/mo</option>)}
                    </select>
                  </div>
                </div>
              )}

              {[['email', 'Email'], ['phone', 'Phone'], ['employer', 'Employer'], ['annual_income', `Annual Income (${symbol})`]].map(([k, l]) => (
                <div key={k} style={{ marginBottom: 14 }}>
                  <label style={lbl}>{l}</label>
                  <input type={FIELD_INPUT_TYPE[k] || 'text'} value={editForm[k] ?? ''} onChange={e => setEditForm((p: any) => ({ ...p, [k]: e.target.value }))} style={inp} {...textFieldAttrs(k)} />
                </div>
              ))}
              <div style={{ marginBottom: 20 }}>
                <label style={lbl}>Employment Status</label>
                <select value={editForm.employment_status} onChange={e => setEditForm((p: any) => ({ ...p, employment_status: e.target.value }))} style={{ ...inp } as any}>
                  {['employed','self-employed','unemployed','student','retired'].map(s => <option key={s} value={s}>{s.replace('-', ' ')}</option>)}
                </select>
              </div>
              <button onClick={saveEdit} disabled={saving} style={{ width: '100%', padding: 12, background: 'linear-gradient(135deg, #FBC02D, #F57F17)', color: 'var(--bg-app)', fontWeight: 700, fontFamily: 'Syne', border: 'none', borderRadius: 8, cursor: 'pointer' }}>
                {saving ? 'Saving...' : 'Save Changes'}
              </button>
            </div>
          </div>
        )}

        <ConfirmDialog
          open={!!confirmTarget}
          message={`Remove ${confirmTarget?.first_name || ''} ${confirmTarget?.last_name || ''}? This will also end their active lease if any.`}
          confirmLabel="Remove"
          cancelLabel="Cancel"
          onCancel={() => setConfirmTarget(null)}
          onConfirm={() => { const tn = confirmTarget; setConfirmTarget(null); deleteTenant(tn); }}
        />

        <ImportModal
          open={showImportModal}
          title="Import Tenants"
          description="Upload a CSV or Excel file exported from a spreadsheet or your previous system. If you pick a property and your file has a unit_number column, matching tenants are automatically assigned to that vacant unit — same as picking one in the Add Tenant form."
          templateHeaders={['first_name', 'last_name', 'email', 'phone', 'employer', 'annual_income', 'employment_status', 'unit_number']}
          templateExampleRow={['Jane', 'Doe', 'jane@example.com', '555-123-4567', 'Acme Inc', '65000', 'employed', '101']}
          templateFilename="tenants_template.csv"
          extraFields={
            <div style={{ marginBottom: 14 }}>
              <label style={lbl}>Property (optional — needed to auto-assign units by number)</label>
              <select value={importPropertyId} onChange={e => setImportPropertyId(e.target.value)} style={{ ...inp } as any}>
                <option value="">No property — create tenants unassigned</option>
                {propertyList.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
              </select>
            </div>
          }
          onClose={() => setShowImportModal(false)}
          onImport={async (file) => {
            const res = await tenantsApi.importTenants(file, importPropertyId || undefined);
            return res.data;
          }}
          onDone={() => load(propertyFilter)}
        />
      </div>
    </DashboardLayout>
  );
}

const NO_SPELLCHECK_FIELDS = new Set(['email', 'phone', 'annual_income']);
function textFieldAttrs(key: string) {
  if (NO_SPELLCHECK_FIELDS.has(key)) {
    return { spellCheck: false, autoCorrect: 'off', autoCapitalize: 'off' } as const;
  }
  return { spellCheck: true, autoCorrect: 'on', autoCapitalize: 'words' } as const;
}

const lbl: React.CSSProperties = { display: 'block', marginBottom: 5, fontSize: 12, fontFamily: 'IBM Plex Mono', color: 'var(--text-secondary)' };
const inp: React.CSSProperties = { width: '100%', padding: '9px 12px', background: 'var(--bg-app)', border: '1px solid var(--border-input)', borderRadius: 8, color: 'var(--text-primary)', fontSize: 13, fontFamily: 'IBM Plex Sans', outline: 'none', boxSizing: 'border-box' };
