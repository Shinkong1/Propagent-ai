import { useEffect, useState } from 'react';
import { useRouter } from 'next/router';
import DashboardLayout from '../../components/DashboardLayout';
import { Plus, X, RefreshCw, Building2, Home, Wrench, Trash2, Star } from 'lucide-react';
import { maintenance as maintenanceApi, properties as propertiesApi } from '../../lib/api';
import { useLanguage } from '../../lib/LanguageContext';
import toast from 'react-hot-toast';

const STATUSES = ['open', 'in_progress', 'waiting_vendor', 'scheduled', 'completed'];
const STATUS_COLOR: any = { open: '#EF4444', in_progress: '#3B82F6', waiting_vendor: '#F97316', scheduled: '#8B5CF6', completed: '#10B981' };
const PRIORITY_COLOR: any = { emergency: '#EF4444', high: '#F97316', medium: '#FBC02D', low: '#10B981' };
const CATEGORIES = ['plumbing', 'electrical', 'hvac', 'appliance', 'structural', 'pest_control', 'cleaning', 'other'];
const PRIORITIES = ['low', 'medium', 'high', 'emergency'];

export default function Maintenance() {
  const router = useRouter();
  const { t } = useLanguage();
  const [tickets, setTickets] = useState<any[]>([]);
  const [propertyList, setPropertyList] = useState<any[]>([]);
  const [vendorList, setVendorList] = useState<any[]>([]);
  const [showModal, setShowModal] = useState(false);
  const [propertyFilter, setPropertyFilter] = useState('all');
  const [form, setForm] = useState({ title: '', description: '', category: 'other', priority: 'medium', property_id: '', unit_id: '' });
  const [createUnits, setCreateUnits] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);

  const [selectedTicket, setSelectedTicket] = useState<any | null>(null);
  const [editForm, setEditForm] = useState({ status: '', vendor_id: '', notes: '', actual_cost: '' });
  const [saving, setSaving] = useState(false);

  const [draggedTicketId, setDraggedTicketId] = useState<string | null>(null);
  const [dragOverStatus, setDragOverStatus] = useState<string | null>(null);

  const EMPTY_VENDOR_FORM = { name: '', company: '', email: '', phone: '', specialties: '', hourly_rate: '', is_preferred: false, notes: '' };
  const [showVendorModal, setShowVendorModal] = useState(false);
  const [vendorForm, setVendorForm] = useState(EMPTY_VENDOR_FORM);
  const [savingVendor, setSavingVendor] = useState(false);
  const [deletingVendorId, setDeletingVendorId] = useState<string | null>(null);

  const load = (propertyId?: string, openTicketId?: string) => {
    maintenanceApi.list(undefined, propertyId === 'all' ? undefined : propertyId).then(r => {
      const data = r.data || [];
      setTickets(data);
      if (openTicketId) {
        const match = data.find((t: any) => t.id === openTicketId);
        if (match) openTicket(match);
      }
    }).catch(() => {});
  };

  useEffect(() => {
    if (!router.isReady) return;
    const fromQuery = typeof router.query.property === 'string' ? router.query.property : 'all';
    const ticketQuery = typeof router.query.ticket === 'string' ? router.query.ticket : undefined;
    setPropertyFilter(fromQuery);
    load(fromQuery, ticketQuery);
    propertiesApi.list().then(r => setPropertyList(r.data || [])).catch(() => {});
    maintenanceApi.vendors().then(r => setVendorList(r.data || [])).catch(() => {});
  }, [router.isReady]);

  const changePropertyFilter = (propertyId: string) => {
    setPropertyFilter(propertyId);
    load(propertyId);
  };

  const changeCreateProperty = (propertyId: string) => {
    setForm(p => ({ ...p, property_id: propertyId, unit_id: '' }));
    setCreateUnits([]);
    if (propertyId) {
      propertiesApi.listUnits(propertyId).then(r => setCreateUnits(r.data || [])).catch(() => {});
    }
  };

  const create = async () => {
    if (!form.property_id) { toast.error(t('maintenance.toast.selectProperty')); return; }
    setLoading(true);
    try {
      const payload: any = { ...form };
      if (!payload.unit_id) delete payload.unit_id;
      const res = await maintenanceApi.create(payload);
      setTickets(p => [res.data, ...p]);
      setShowModal(false);
      setForm({ title: '', description: '', category: 'other', priority: 'medium', property_id: '', unit_id: '' });
      setCreateUnits([]);
      toast.success(t('maintenance.toast.created'));
    } catch { toast.error(t('maintenance.toast.createFailed')); }
    finally { setLoading(false); }
  };

  const openTicket = (ticket: any) => {
    setSelectedTicket(ticket);
    setEditForm({
      status: ticket.status || 'open',
      vendor_id: ticket.vendor_id || '',
      notes: ticket.notes || '',
      actual_cost: ticket.actual_cost != null ? String(ticket.actual_cost) : '',
    });
  };

  const saveTicket = async () => {
    if (!selectedTicket) return;
    setSaving(true);
    try {
      const payload: any = {
        status: editForm.status,
        vendor_id: editForm.vendor_id || undefined,
        notes: editForm.notes || undefined,
        actual_cost: editForm.actual_cost ? parseFloat(editForm.actual_cost) : undefined,
      };
      const res = await maintenanceApi.update(selectedTicket.id, payload);
      setTickets(prev => prev.map(tk => (tk.id === selectedTicket.id ? res.data : tk)));
      setSelectedTicket(null);
      toast.success(t('maintenance.toast.updated'));
    } catch { toast.error(t('maintenance.toast.updateFailed')); }
    finally { setSaving(false); }
  };

  const loadVendors = () => {
    maintenanceApi.vendors().then(r => setVendorList(r.data || [])).catch(() => {});
  };

  const createVendor = async () => {
    if (!vendorForm.name.trim()) { toast.error(t('maintenance.toast.vendorNameRequired')); return; }
    setSavingVendor(true);
    try {
      const specialties = vendorForm.specialties.split(',').map(s => s.trim()).filter(Boolean);
      await maintenanceApi.createVendor({
        name: vendorForm.name.trim(),
        company: vendorForm.company.trim() || undefined,
        email: vendorForm.email.trim() || undefined,
        phone: vendorForm.phone.trim() || undefined,
        specialties: specialties.length ? specialties : undefined,
        hourly_rate: vendorForm.hourly_rate ? parseFloat(vendorForm.hourly_rate) : undefined,
        is_preferred: vendorForm.is_preferred,
        notes: vendorForm.notes.trim() || undefined,
      });
      toast.success(t('maintenance.toast.vendorAdded'));
      setVendorForm(EMPTY_VENDOR_FORM);
      loadVendors();
    } catch (err: any) {
      toast.error(err?.response?.data?.detail || t('maintenance.toast.vendorAddFailed'));
    } finally {
      setSavingVendor(false);
    }
  };

  const deleteVendor = async (id: string) => {
    setDeletingVendorId(id);
    try {
      await maintenanceApi.deleteVendor(id);
      toast.success(t('maintenance.toast.vendorRemoved'));
      loadVendors();
    } catch {
      toast.error(t('maintenance.toast.vendorRemoveFailed'));
    } finally {
      setDeletingVendorId(null);
    }
  };

  const handleDrop = async (newStatus: string) => {
    setDragOverStatus(null);
    const ticketId = draggedTicketId;
    setDraggedTicketId(null);
    if (!ticketId) return;

    const ticket = tickets.find(tk => tk.id === ticketId);
    if (!ticket || ticket.status === newStatus) return;

    const previous = ticket;
    setTickets(prev => prev.map(tk => (tk.id === ticketId ? { ...tk, status: newStatus } : tk)));

    try {
      const res = await maintenanceApi.update(ticketId, { status: newStatus });
      setTickets(prev => prev.map(tk => (tk.id === ticketId ? res.data : tk)));
      toast.success(t('maintenance.toast.movedTo', { status: t(`maintenance.status.${newStatus}`) }));
    } catch {
      setTickets(prev => prev.map(tk => (tk.id === ticketId ? previous : tk)));
      toast.error(t('maintenance.toast.moveFailed'));
    }
  };

  // Kanban columns
  const byStatus = STATUSES.reduce((acc, s) => {
    acc[s] = tickets.filter(tk => tk.status === s);
    return acc;
  }, {} as any);

  return (
    <DashboardLayout>
      <div>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 24, flexWrap: 'wrap', gap: 12 }}>
          <div>
            <h1 style={{ fontFamily: 'Syne', fontWeight: 800, fontSize: 28, color: 'var(--text-primary)', marginBottom: 4 }}>{t('maintenance.title')}</h1>
            <p style={{ color: 'var(--text-muted)', fontSize: 14 }}>{t('maintenance.activeCount', { count: tickets.filter(tk => tk.status !== 'completed').length })}</p>
          </div>
          <div style={{ display: 'flex', gap: 10 }}>
            <select value={propertyFilter} onChange={e => changePropertyFilter(e.target.value)}
              style={{ padding: '9px 14px', background: 'var(--bg-surface)', border: '1px solid var(--border-strong)', borderRadius: 8, color: 'var(--text-secondary)', fontSize: 13, fontFamily: 'IBM Plex Sans', outline: 'none' }}>
              <option value="all">{t('common.allProperties')}</option>
              {propertyList.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
            </select>
            <button onClick={() => load(propertyFilter)} style={{ padding: '9px 14px', background: 'var(--bg-surface)', border: '1px solid var(--border-strong)', borderRadius: 8, color: 'var(--text-secondary)', cursor: 'pointer' }}>
              <RefreshCw size={14} />
            </button>
            <button onClick={() => setShowVendorModal(true)} style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '10px 18px', background: 'var(--bg-surface)', border: '1px solid var(--border-strong)', borderRadius: 8, color: 'var(--text-secondary)', fontWeight: 600, fontFamily: 'Syne', fontSize: 14, cursor: 'pointer' }}>
              <Wrench size={16} /> {t('maintenance.manageVendors')}
            </button>
            <button onClick={() => setShowModal(true)} style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '10px 18px', background: 'linear-gradient(135deg, #FBC02D, #F57F17)', color: 'var(--bg-app)', border: 'none', borderRadius: 8, fontWeight: 700, fontFamily: 'Syne', fontSize: 14, cursor: 'pointer' }}>
              <Plus size={16} /> {t('maintenance.newTicket')}
            </button>
          </div>
        </div>

        {/* Kanban Board */}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(150px, 1fr))', gap: 14, overflowX: 'auto' }}>
          {STATUSES.map(status => (
            <div key={status}
              onDragOver={e => { e.preventDefault(); if (dragOverStatus !== status) setDragOverStatus(status); }}
              onDragLeave={() => setDragOverStatus(prev => (prev === status ? null : prev))}
              onDrop={e => { e.preventDefault(); handleDrop(status); }}
              style={{
                minWidth: 200, borderRadius: 12, padding: 6,
                background: dragOverStatus === status ? `${STATUS_COLOR[status]}0d` : 'transparent',
                border: `1px dashed ${dragOverStatus === status ? STATUS_COLOR[status] : 'transparent'}`,
                transition: 'background 0.15s, border-color 0.15s',
              }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 12, padding: '6px 10px', borderRadius: 8, background: `${STATUS_COLOR[status]}15`, border: `1px solid ${STATUS_COLOR[status]}30` }}>
                <div style={{ width: 6, height: 6, borderRadius: '50%', background: STATUS_COLOR[status] }} />
                <span style={{ fontSize: 11, fontFamily: 'IBM Plex Mono', color: STATUS_COLOR[status], fontWeight: 600, letterSpacing: '0.5px' }}>
                  {t(`maintenance.status.${status}`).toUpperCase()}
                </span>
                <span style={{ marginLeft: 'auto', fontSize: 11, color: 'var(--text-faint)', fontFamily: 'IBM Plex Mono' }}>
                  {byStatus[status]?.length || 0}
                </span>
              </div>

              {(byStatus[status] || []).map((ticket: any) => (
                <div key={ticket.id} onClick={() => openTicket(ticket)}
                  draggable
                  onDragStart={e => { setDraggedTicketId(ticket.id); e.dataTransfer.effectAllowed = 'move'; }}
                  onDragEnd={() => { setDraggedTicketId(null); setDragOverStatus(null); }}
                  style={{
                    background: 'var(--bg-surface)', border: '1px solid var(--border-strong)', borderRadius: 10, padding: '12px', marginBottom: 10,
                    cursor: 'grab', opacity: draggedTicketId === ticket.id ? 0.4 : 1,
                  }}
                  onMouseEnter={e => { (e.currentTarget as HTMLElement).style.borderColor = STATUS_COLOR[status]; }}
                  onMouseLeave={e => { (e.currentTarget as HTMLElement).style.borderColor = 'var(--border-strong)'; }}>
                  <div style={{ fontSize: 12, color: '#E2E8F0', fontFamily: 'IBM Plex Sans', fontWeight: 600, marginBottom: 4, lineHeight: 1.3 }}>{ticket.title}</div>
                  {ticket.property_name && (
                    <div style={{ display: 'flex', alignItems: 'center', gap: 4, marginBottom: 8, color: 'var(--text-muted)', fontSize: 10, fontFamily: 'IBM Plex Mono' }}>
                      <Building2 size={10} /> {ticket.property_name}{ticket.unit_number ? ` · Unit ${ticket.unit_number}` : ''}
                    </div>
                  )}
                  <div style={{ fontSize: 11, color: 'var(--text-muted)', marginBottom: 10, lineHeight: 1.4, fontFamily: 'IBM Plex Sans' }}>
                    {ticket.description?.slice(0, 60)}{ticket.description?.length > 60 ? '...' : ''}
                  </div>
                  <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
                    <span style={{ fontSize: 10, padding: '2px 6px', borderRadius: 4, background: `${PRIORITY_COLOR[ticket.priority]}20`, color: PRIORITY_COLOR[ticket.priority], fontFamily: 'IBM Plex Mono' }}>
                      {t(`maintenance.priority.${ticket.priority}`)}
                    </span>
                    <span style={{ fontSize: 10, padding: '2px 6px', borderRadius: 4, background: 'rgba(100,116,139,0.15)', color: 'var(--text-secondary)', fontFamily: 'IBM Plex Mono' }}>
                      {t(`maintenance.category.${ticket.category}`)}
                    </span>
                    {ticket.vendor_name && (
                      <span style={{ fontSize: 10, padding: '2px 6px', borderRadius: 4, background: 'rgba(139,92,246,0.15)', color: '#8B5CF6', fontFamily: 'IBM Plex Mono' }}>
                        {ticket.vendor_name}
                      </span>
                    )}
                  </div>
                </div>
              ))}

              {(byStatus[status] || []).length === 0 && (
                <div style={{ textAlign: 'center', padding: '20px 0', color: 'var(--text-faint)', fontSize: 12, fontFamily: 'IBM Plex Mono' }}>
                  {t('maintenance.empty')}
                </div>
              )}
            </div>
          ))}
        </div>

        {/* Create Ticket Modal */}
        {showModal && (
          <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.8)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000, padding: 20 }}>
            <div style={{ background: 'var(--bg-surface)', border: '1px solid var(--border-strong)', borderRadius: 16, padding: 28, width: '100%', maxWidth: 440 }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 }}>
                <h2 style={{ fontFamily: 'Syne', fontWeight: 700, fontSize: 18, color: 'var(--text-primary)' }}>{t('maintenance.modal.createTitle')}</h2>
                <button onClick={() => setShowModal(false)} style={{ background: 'none', border: 'none', color: 'var(--text-muted)', cursor: 'pointer' }}><X size={18} /></button>
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: 12, marginBottom: 14 }}>
                <div>
                  <label style={lbl}>{t('tenants.propertyLabel')}</label>
                  <select value={form.property_id} onChange={e => changeCreateProperty(e.target.value)} style={{ ...inp } as any}>
                    <option value="">{t('inquiries.screenModal.select')}</option>
                    {propertyList.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
                  </select>
                </div>
                <div>
                  <label style={lbl}>{t('maintenance.unitOptional')}</label>
                  <select value={form.unit_id} onChange={e => setForm(p => ({ ...p, unit_id: e.target.value }))} disabled={!form.property_id} style={{ ...inp } as any}>
                    <option value="">{t('maintenance.unspecified')}</option>
                    {createUnits.map(u => <option key={u.id} value={u.id}>{t('maintenance.unitOption', { number: u.unit_number })}</option>)}
                  </select>
                </div>
              </div>
              <div style={{ marginBottom: 14 }}>
                <label style={lbl}>{t('maintenance.ticketTitle')}</label>
                <input value={form.title} onChange={e => setForm(p => ({ ...p, title: e.target.value }))} placeholder={t('maintenance.titlePlaceholder')} style={inp} spellCheck autoCorrect="on" autoCapitalize="sentences" />
              </div>
              <div style={{ marginBottom: 14 }}>
                <label style={lbl}>{t('common.description')}</label>
                <textarea value={form.description} onChange={e => setForm(p => ({ ...p, description: e.target.value }))} placeholder={t('maintenance.descriptionPlaceholder')}
                  spellCheck autoCorrect="on" autoCapitalize="sentences"
                  style={{ ...inp, height: 90, resize: 'none' } as any} />
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: 12, marginBottom: 20 }}>
                <div>
                  <label style={lbl}>{t('maintenance.categoryLabel')}</label>
                  <select value={form.category} onChange={e => setForm(p => ({ ...p, category: e.target.value }))} style={{ ...inp } as any}>
                    {CATEGORIES.map(c => <option key={c} value={c}>{t(`maintenance.category.${c}`)}</option>)}
                  </select>
                </div>
                <div>
                  <label style={lbl}>{t('maintenance.priorityLabel')}</label>
                  <select value={form.priority} onChange={e => setForm(p => ({ ...p, priority: e.target.value }))} style={{ ...inp } as any}>
                    {PRIORITIES.map(p => <option key={p} value={p}>{t(`maintenance.priority.${p}`)}</option>)}
                  </select>
                </div>
              </div>
              <button onClick={create} disabled={loading} style={{ width: '100%', padding: 12, background: 'linear-gradient(135deg, #FBC02D, #F57F17)', color: 'var(--bg-app)', fontWeight: 700, fontFamily: 'Syne', border: 'none', borderRadius: 8, cursor: 'pointer' }}>
                {loading ? t('maintenance.creating') : t('maintenance.modal.createTitle')}
              </button>
            </div>
          </div>
        )}

        {/* Edit Ticket Modal */}
        {selectedTicket && (
          <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.8)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000, padding: 20 }}>
            <div style={{ background: 'var(--bg-surface)', border: '1px solid var(--border-strong)', borderRadius: 16, padding: 28, width: '100%', maxWidth: 460 }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 6 }}>
                <h2 style={{ fontFamily: 'Syne', fontWeight: 700, fontSize: 18, color: 'var(--text-primary)' }}>{selectedTicket.title}</h2>
                <button onClick={() => setSelectedTicket(null)} style={{ background: 'none', border: 'none', color: 'var(--text-muted)', cursor: 'pointer' }}><X size={18} /></button>
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 16, color: 'var(--text-muted)', fontSize: 12, fontFamily: 'IBM Plex Mono' }}>
                <Home size={12} /> {selectedTicket.property_name}{selectedTicket.unit_number ? ` · Unit ${selectedTicket.unit_number}` : ` · ${t('maintenance.unitUnspecified')}`}
              </div>
              <p style={{ color: 'var(--text-secondary)', fontSize: 13, fontFamily: 'IBM Plex Sans', lineHeight: 1.5, marginBottom: 18 }}>{selectedTicket.description}</p>

              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: 12, marginBottom: 14 }}>
                <div>
                  <label style={lbl}>{t('common.status')}</label>
                  <select value={editForm.status} onChange={e => setEditForm(p => ({ ...p, status: e.target.value }))} style={{ ...inp } as any}>
                    {STATUSES.map(s => <option key={s} value={s}>{t(`maintenance.status.${s}`)}</option>)}
                    <option value="cancelled">{t('maintenance.status.cancelled')}</option>
                  </select>
                </div>
                <div>
                  <label style={lbl}>{t('maintenance.assignVendor')}</label>
                  <select value={editForm.vendor_id} onChange={e => setEditForm(p => ({ ...p, vendor_id: e.target.value }))} style={{ ...inp } as any}>
                    <option value="">{t('tenants.unassigned')}</option>
                    {vendorList.map(v => <option key={v.id} value={v.id}>{v.name}</option>)}
                  </select>
                  {vendorList.length === 0 && (
                    <div style={{ fontSize: 11, color: 'var(--text-muted)', marginTop: 6 }}>
                      {t('maintenance.noVendorsHint')}
                    </div>
                  )}
                </div>
              </div>
              <div style={{ marginBottom: 14 }}>
                <label style={lbl}>{t('common.notes')}</label>
                <textarea value={editForm.notes} onChange={e => setEditForm(p => ({ ...p, notes: e.target.value }))} placeholder={t('maintenance.notesPlaceholder')}
                  spellCheck autoCorrect="on" autoCapitalize="sentences"
                  style={{ ...inp, height: 70, resize: 'none' } as any} />
              </div>
              <div style={{ marginBottom: 20 }}>
                <label style={lbl}>{t('maintenance.actualCost')}</label>
                <input value={editForm.actual_cost} onChange={e => setEditForm(p => ({ ...p, actual_cost: e.target.value }))} placeholder="0.00" style={inp} spellCheck={false} autoCorrect="off" />
              </div>
              <button onClick={saveTicket} disabled={saving} style={{ width: '100%', padding: 12, background: 'linear-gradient(135deg, #FBC02D, #F57F17)', color: 'var(--bg-app)', fontWeight: 700, fontFamily: 'Syne', border: 'none', borderRadius: 8, cursor: 'pointer' }}>
                {saving ? t('common.saving') : t('common.saveChanges')}
              </button>
            </div>
          </div>
        )}

        {/* Manage Vendors Modal */}
        {showVendorModal && (
          <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.8)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000, padding: 20 }}>
            <div style={{ background: 'var(--bg-surface)', border: '1px solid var(--border-strong)', borderRadius: 16, padding: 28, width: '100%', maxWidth: 560, maxHeight: '88vh', overflowY: 'auto' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 }}>
                <h2 style={{ fontFamily: 'Syne', fontWeight: 700, fontSize: 18, color: 'var(--text-primary)' }}>{t('maintenance.manageVendors')}</h2>
                <button onClick={() => setShowVendorModal(false)} style={{ background: 'none', border: 'none', color: 'var(--text-muted)', cursor: 'pointer' }}><X size={18} /></button>
              </div>

              {/* Existing vendors */}
              {vendorList.length > 0 ? (
                <div style={{ marginBottom: 22, display: 'flex', flexDirection: 'column', gap: 8 }}>
                  {vendorList.map(v => (
                    <div key={v.id} style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '10px 12px', background: 'var(--bg-app)', border: '1px solid var(--border-subtle)', borderRadius: 8 }}>
                      {v.is_preferred && <Star size={13} color="#FBC02D" fill="#FBC02D" />}
                      <div style={{ flex: 1, minWidth: 0 }}>
                        <div style={{ fontSize: 13, color: 'var(--text-primary)', fontFamily: 'IBM Plex Sans', fontWeight: 600 }}>
                          {v.name}{v.company ? ` — ${v.company}` : ''}
                        </div>
                        <div style={{ fontSize: 11, color: 'var(--text-muted)', fontFamily: 'IBM Plex Mono', marginTop: 2 }}>
                          {[v.phone, v.email, v.hourly_rate ? `$${v.hourly_rate}/hr` : null].filter(Boolean).join(' · ') || t('maintenance.noContactInfo')}
                        </div>
                        {v.specialties?.length > 0 && (
                          <div style={{ display: 'flex', gap: 4, flexWrap: 'wrap', marginTop: 6 }}>
                            {v.specialties.map((s: string) => (
                              <span key={s} style={{ fontSize: 10, padding: '2px 6px', borderRadius: 4, background: 'rgba(139,92,246,0.15)', color: '#8B5CF6', fontFamily: 'IBM Plex Mono' }}>{s}</span>
                            ))}
                          </div>
                        )}
                      </div>
                      <button onClick={() => deleteVendor(v.id)} disabled={deletingVendorId === v.id} title={t('tenants.removeTitle')}
                        style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', width: 28, height: 28, borderRadius: 6, background: 'rgba(239,68,68,0.1)', border: '1px solid rgba(239,68,68,0.3)', color: '#EF4444', cursor: 'pointer', flexShrink: 0 }}>
                        <Trash2 size={12} />
                      </button>
                    </div>
                  ))}
                </div>
              ) : (
                <p style={{ fontSize: 12, color: 'var(--text-muted)', marginBottom: 22 }}>{t('vendors.emptyAddFirst')}</p>
              )}

              {/* Add vendor form */}
              <h3 style={{ fontFamily: 'Syne', fontWeight: 700, fontSize: 14, color: 'var(--text-primary)', marginBottom: 12 }}>{t('maintenance.addVendor')}</h3>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: 12, marginBottom: 12 }}>
                <div>
                  <label style={lbl}>{t('common.name')} <span style={{ color: '#EF4444' }}>*</span></label>
                  <input value={vendorForm.name} onChange={e => setVendorForm(p => ({ ...p, name: e.target.value }))} placeholder="Mike Torres" style={inp} spellCheck autoCorrect="on" autoCapitalize="words" />
                </div>
                <div>
                  <label style={lbl}>{t('common.company')}</label>
                  <input value={vendorForm.company} onChange={e => setVendorForm(p => ({ ...p, company: e.target.value }))} placeholder="Torres Plumbing Co." style={inp} spellCheck autoCorrect="on" autoCapitalize="words" />
                </div>
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: 12, marginBottom: 12 }}>
                <div>
                  <label style={lbl}>{t('common.email')}</label>
                  <input type="email" value={vendorForm.email} onChange={e => setVendorForm(p => ({ ...p, email: e.target.value }))} style={inp} spellCheck={false} autoCorrect="off" autoCapitalize="off" />
                </div>
                <div>
                  <label style={lbl}>{t('common.phone')}</label>
                  <input type="tel" value={vendorForm.phone} onChange={e => setVendorForm(p => ({ ...p, phone: e.target.value }))} style={inp} spellCheck={false} autoCorrect="off" autoCapitalize="off" />
                </div>
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: 12, marginBottom: 12 }}>
                <div>
                  <label style={lbl}>{t('maintenance.specialtiesLabel')}</label>
                  <input value={vendorForm.specialties} onChange={e => setVendorForm(p => ({ ...p, specialties: e.target.value }))} placeholder="plumbing, hvac" style={inp} spellCheck={false} autoCorrect="off" />
                </div>
                <div>
                  <label style={lbl}>{t('maintenance.hourlyRateLabel')}</label>
                  <input value={vendorForm.hourly_rate} onChange={e => setVendorForm(p => ({ ...p, hourly_rate: e.target.value }))} placeholder="75" style={inp} spellCheck={false} autoCorrect="off" />
                </div>
              </div>
              <div style={{ marginBottom: 12 }}>
                <label style={lbl}>{t('common.notes')}</label>
                <textarea value={vendorForm.notes} onChange={e => setVendorForm(p => ({ ...p, notes: e.target.value }))} placeholder={t('maintenance.vendorNotesPlaceholder')}
                  spellCheck autoCorrect="on" autoCapitalize="sentences"
                  style={{ ...inp, height: 60, resize: 'none' } as any} />
              </div>
              <label style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 18, fontSize: 13, color: 'var(--text-secondary)', cursor: 'pointer' }}>
                <input type="checkbox" checked={vendorForm.is_preferred} onChange={e => setVendorForm(p => ({ ...p, is_preferred: e.target.checked }))} />
                {t('maintenance.preferredVendorLabel')}
              </label>
              <button onClick={createVendor} disabled={savingVendor} style={{ width: '100%', padding: 12, background: 'linear-gradient(135deg, #FBC02D, #F57F17)', color: 'var(--bg-app)', fontWeight: 700, fontFamily: 'Syne', border: 'none', borderRadius: 8, cursor: 'pointer' }}>
                {savingVendor ? t('tenants.adding') : t('maintenance.addVendor')}
              </button>
            </div>
          </div>
        )}
      </div>
    </DashboardLayout>
  );
}

const lbl: React.CSSProperties = { display: 'block', marginBottom: 5, fontSize: 12, fontFamily: 'IBM Plex Mono', color: 'var(--text-secondary)' };
const inp: React.CSSProperties = { width: '100%', padding: '9px 12px', background: 'var(--bg-app)', border: '1px solid var(--border-input)', borderRadius: 8, color: 'var(--text-primary)', fontSize: 13, fontFamily: 'IBM Plex Sans', outline: 'none', boxSizing: 'border-box' };
