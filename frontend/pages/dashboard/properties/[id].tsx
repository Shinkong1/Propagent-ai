import { useEffect, useState } from 'react';
import { useRouter } from 'next/router';
import Link from 'next/link';
import DashboardLayout from '../../../components/DashboardLayout';
import {
  ArrowLeft, Building2, MapPin, DollarSign, Home, Wrench, Users,
  CheckCircle, XCircle, Star, Phone, Mail, ChevronDown, ChevronUp, FileText, Lock, Pencil, X,
} from 'lucide-react';
import { properties as propertiesApi, tenants as tenantsApi, maintenance as maintenanceApi, accounting as accountingApi } from '../../../lib/api';
import { getUser } from '../../../lib/auth';
import { useCurrency } from '../../../lib/CurrencyContext';
import { useSidebar } from '../../../lib/SidebarContext';
import toast from 'react-hot-toast';

const TYPE_COLOR: any = { apartment: '#3B82F6', single_family: '#10B981', multi_family: '#8B5CF6', condo: '#F97316', commercial: '#EF4444' };
const STATUS_COLOR: any = { open: '#EF4444', in_progress: '#3B82F6', waiting_vendor: '#F97316', scheduled: '#8B5CF6', completed: '#10B981' };
const PRIORITY_COLOR: any = { emergency: '#EF4444', high: '#F97316', medium: '#FBC02D', low: '#10B981' };
const PROPERTY_TYPES = ['apartment', 'single_family', 'multi_family', 'condo', 'commercial'];

export default function PropertyDetail() {
  const router = useRouter();
  const { id } = router.query;
  const { formatMoney } = useCurrency();
  const { isMobile } = useSidebar();

  const [property, setProperty] = useState<any>(null);
  const [stats, setStats] = useState<any>(null);
  const [units, setUnits] = useState<any[]>([]);
  const [tenantList, setTenantList] = useState<any[]>([]);
  const [tickets, setTickets] = useState<any[]>([]);
  const [vendors, setVendors] = useState<any[]>([]);
  const [financials, setFinancials] = useState<any>(null);
  const [recentPayments, setRecentPayments] = useState<any[]>([]);
  const [recentExpenses, setRecentExpenses] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);
  const [expandedVendor, setExpandedVendor] = useState<string | null>(null);
  const [downloadingLease, setDownloadingLease] = useState<string | null>(null);

  const [showEditProperty, setShowEditProperty] = useState(false);
  const [propertyForm, setPropertyForm] = useState<any>({});
  const [savingProperty, setSavingProperty] = useState(false);

  const [editingUnit, setEditingUnit] = useState<any | null>(null);
  const [unitForm, setUnitForm] = useState<any>({});
  const [savingUnit, setSavingUnit] = useState(false);

  const userPlan = getUser()?.plan;
  const canGenerateContracts = userPlan === 'professional' || userPlan === 'enterprise';

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

  const openEditProperty = () => {
    setPropertyForm({
      name: property.name, address: property.address, city: property.city,
      state: property.state, zip_code: property.zip_code, property_type: property.property_type,
      year_built: property.year_built ?? '', purchase_price: property.purchase_price ?? '',
      mortgage_payment: property.mortgage_payment ?? '', description: property.description ?? '',
    });
    setShowEditProperty(true);
  };

  const saveProperty = async () => {
    setSavingProperty(true);
    try {
      const payload = {
        ...propertyForm,
        year_built: propertyForm.year_built === '' ? null : Number(propertyForm.year_built),
        purchase_price: propertyForm.purchase_price === '' ? null : Number(propertyForm.purchase_price),
        mortgage_payment: propertyForm.mortgage_payment === '' ? null : Number(propertyForm.mortgage_payment),
      };
      const res = await propertiesApi.update(id as string, payload);
      setProperty(res.data);
      toast.success('Property updated');
      setShowEditProperty(false);
    } catch (err: any) {
      toast.error(err?.response?.data?.detail || 'Failed to update property');
    } finally {
      setSavingProperty(false);
    }
  };

  const openEditUnit = (u: any) => {
    setUnitForm({
      unit_number: u.unit_number, bedrooms: u.bedrooms, bathrooms: u.bathrooms,
      square_feet: u.square_feet ?? '', monthly_rent: u.monthly_rent,
      is_occupied: u.is_occupied, is_available: u.is_available,
    });
    setEditingUnit(u);
  };

  const saveUnit = async () => {
    setSavingUnit(true);
    try {
      const payload = {
        ...unitForm,
        bedrooms: Number(unitForm.bedrooms),
        bathrooms: Number(unitForm.bathrooms),
        square_feet: unitForm.square_feet === '' ? null : Number(unitForm.square_feet),
        monthly_rent: Number(unitForm.monthly_rent),
      };
      const res = await propertiesApi.updateUnit(id as string, editingUnit.id, payload);
      setUnits(prev => prev.map(u => u.id === editingUnit.id ? res.data : u));
      toast.success('Unit updated');
      setEditingUnit(null);
    } catch (err: any) {
      toast.error(err?.response?.data?.detail || 'Failed to update unit');
    } finally {
      setSavingUnit(false);
    }
  };

  useEffect(() => {
    if (!id || typeof id !== 'string') return;
    setLoading(true);
    setError(false);
    Promise.all([
      propertiesApi.get(id),
      propertiesApi.propertyStats(id),
      propertiesApi.listUnits(id),
      tenantsApi.list(id),
      maintenanceApi.list(undefined, id),
      propertiesApi.propertyVendors(id),
      accountingApi.propertyReport(id),
      accountingApi.listPayments(id),
      accountingApi.listExpenses(id),
    ])
      .then(([p, s, u, t, m, v, f, pay, exp]) => {
        setProperty(p.data);
        setStats(s.data);
        setUnits(u.data || []);
        setTenantList(t.data || []);
        setTickets(m.data || []);
        setVendors(v.data || []);
        setFinancials(f.data);
        setRecentPayments((pay.data || []).slice(0, 5));
        setRecentExpenses((exp.data || []).slice(0, 5));
      })
      .catch(() => setError(true))
      .finally(() => setLoading(false));
  }, [id]);

  if (loading) return (
    <DashboardLayout>
      <div style={{ color: '#64748B', fontFamily: 'IBM Plex Mono', padding: 40 }}>Loading property...</div>
    </DashboardLayout>
  );

  if (error || !property) return (
    <DashboardLayout>
      <div style={{ color: '#64748B', fontFamily: 'IBM Plex Mono', padding: 40 }}>
        Property not found. <Link href="/dashboard/properties" style={{ color: '#FBC02D' }}>Back to Properties</Link>
      </div>
    </DashboardLayout>
  );

  const activeTickets = tickets.filter(t => t.status !== 'completed' && t.status !== 'cancelled');

  return (
    <DashboardLayout>
      <div style={{ maxWidth: 1100 }}>
        <Link href="/dashboard/properties" style={{ display: 'inline-flex', alignItems: 'center', gap: 6, color: '#64748B', fontSize: 13, fontFamily: 'IBM Plex Sans', textDecoration: 'none', marginBottom: 20 }}>
          <ArrowLeft size={14} /> Back to Properties
        </Link>

        {/* Header */}
        <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', marginBottom: 28 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 14 }}>
            <div style={{ width: 52, height: 52, borderRadius: 12, background: `${TYPE_COLOR[property.property_type] || '#3B82F6'}20`, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              <Building2 size={26} color={TYPE_COLOR[property.property_type] || '#3B82F6'} />
            </div>
            <div>
              <h1 style={{ fontFamily: 'Syne', fontWeight: 800, fontSize: 26, color: 'var(--text-primary)', marginBottom: 4 }}>{property.name}</h1>
              <div style={{ display: 'flex', alignItems: 'center', gap: 6, color: '#64748B', fontSize: 13, fontFamily: 'IBM Plex Sans' }}>
                <MapPin size={13} />
                {property.address}, {property.city}, {property.state} {property.zip_code}
              </div>
            </div>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <span style={{ fontSize: 11, padding: '5px 12px', borderRadius: 6, background: `${TYPE_COLOR[property.property_type] || '#3B82F6'}20`, color: TYPE_COLOR[property.property_type] || '#3B82F6', fontFamily: 'IBM Plex Mono', textTransform: 'capitalize' }}>
              {property.property_type?.replace('_', ' ')}
            </span>
            <button onClick={openEditProperty} style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '7px 14px', borderRadius: 8, background: 'var(--bg-surface)', border: '1px solid var(--border-strong)', color: 'var(--text-secondary)', fontSize: 12, fontFamily: 'Syne', fontWeight: 600, cursor: 'pointer' }}>
              <Pencil size={12} /> Edit Property
            </button>
          </div>
        </div>

        {/* Stats row */}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: 14, marginBottom: 32 }}>
          <StatCard icon={<DollarSign size={16} color="#10B981" />} label="Monthly Revenue" value={formatMoney(stats?.monthly_revenue || 0)} />
          <StatCard icon={<Home size={16} color="#3B82F6" />} label="Occupancy" value={`${stats?.occupied_units || 0}/${stats?.total_units || 0}`} sub={`${stats?.vacancy_rate ?? 0}% vacant`} />
          <StatCard icon={<Wrench size={16} color="#F97316" />} label="Open Tickets" value={String(stats?.open_tickets ?? 0)} />
          <StatCard icon={<Users size={16} color="#8B5CF6" />} label="Tenants" value={String(tenantList.length)} />
        </div>

        {/* Financials */}
        <Section title="Financials" action={<Link href={`/dashboard/accounting?property=${id}`} style={linkStyle}>View in Accounting</Link>}>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: 12, marginBottom: 18 }}>
            <MiniStat label="NOI (annualized)" value={financials?.annualized_noi != null ? formatMoney(Math.round(financials.annualized_noi)) : '—'} />
            <MiniStat label="Cap Rate" value={financials?.cap_rate != null ? `${financials.cap_rate}%` : '—'} />
            <MiniStat label="DSCR" value={financials?.dscr != null ? financials.dscr.toFixed(2) : '—'} />
            <MiniStat label="Cash Flow" value={financials?.cash_flow != null ? formatMoney(Math.round(financials.cash_flow)) : '—'} negative={financials?.cash_flow < 0} />
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: 20 }}>
            <div>
              <div style={{ fontSize: 11, color: '#64748B', fontFamily: 'IBM Plex Mono', marginBottom: 8 }}>RECENT PAYMENTS</div>
              {recentPayments.length === 0 ? <Empty text="No payments recorded." /> : (
                <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                  {recentPayments.map((p: any) => (
                    <div key={p.id} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '8px 12px', background: 'var(--bg-app)', borderRadius: 8, fontSize: 12 }}>
                      <div>
                        <div style={{ color: '#E2E8F0' }}>{p.tenant_name || 'Unknown tenant'}</div>
                        <div style={{ color: '#64748B', fontSize: 11 }}>{p.due_date}{p.unit_number ? ` · Unit ${p.unit_number}` : ''}</div>
                      </div>
                      <span style={{ color: 'var(--text-primary)', fontFamily: 'IBM Plex Mono' }}>{formatMoney(p.amount)}</span>
                    </div>
                  ))}
                </div>
              )}
            </div>
            <div>
              <div style={{ fontSize: 11, color: '#64748B', fontFamily: 'IBM Plex Mono', marginBottom: 8 }}>RECENT EXPENSES</div>
              {recentExpenses.length === 0 ? <Empty text="No expenses recorded." /> : (
                <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                  {recentExpenses.map((e: any) => (
                    <div key={e.id} style={{ display: 'flex', justifyContent: 'space-between', padding: '8px 12px', background: 'var(--bg-app)', borderRadius: 8, fontSize: 12 }}>
                      <span style={{ color: 'var(--text-secondary)', textTransform: 'capitalize' }}>{e.category.replace('_', ' ')}</span>
                      <span style={{ color: 'var(--text-primary)', fontFamily: 'IBM Plex Mono' }}>{formatMoney(e.amount)}</span>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        </Section>

        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: 20, marginTop: 20 }}>
          {/* Units & occupancy */}
          <Section title="Units & Occupancy">
            {units.length === 0 ? <Empty text="No units yet." /> : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                {units.map((u: any) => (
                  <div key={u.id} style={{ padding: '10px 14px', background: 'var(--bg-app)', borderRadius: 8 }}>
                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                        <span style={{ fontFamily: 'IBM Plex Mono', fontSize: 12, color: 'var(--text-primary)' }}>Unit {u.unit_number}</span>
                        <span style={{ fontSize: 11, color: '#64748B' }}>{u.bedrooms}bd / {u.bathrooms}ba</span>
                      </div>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                        <span style={{ fontFamily: 'IBM Plex Mono', fontSize: 12, color: 'var(--text-secondary)' }}>{formatMoney(Number(u.monthly_rent))}/mo</span>
                        {u.is_occupied ? (
                          <span style={{ display: 'flex', alignItems: 'center', gap: 4, fontSize: 11, color: '#10B981' }}><CheckCircle size={12} /> Occupied</span>
                        ) : (
                          <span style={{ display: 'flex', alignItems: 'center', gap: 4, fontSize: 11, color: '#64748B' }}><XCircle size={12} /> Vacant</span>
                        )}
                        <button onClick={() => openEditUnit(u)} title="Edit unit" style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', width: 22, height: 22, borderRadius: 5, background: 'transparent', border: '1px solid var(--border-strong)', color: '#64748B', cursor: 'pointer' }}>
                          <Pencil size={11} />
                        </button>
                      </div>
                    </div>
                    {u.is_occupied && (
                      <div style={{ marginTop: 6, display: 'flex', alignItems: 'center', gap: 6, fontSize: 11, color: '#8B5CF6' }}>
                        <Users size={11} /> {u.tenant_name || 'Tenant on file'}
                      </div>
                    )}
                  </div>
                ))}
              </div>
            )}
          </Section>

          {/* Tenants */}
          <Section title="Tenants" action={<Link href={`/dashboard/tenants?property=${id}`} style={linkStyle}>View all</Link>}>
            {tenantList.length === 0 ? <Empty text="No tenants at this property." /> : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                {tenantList.map((t: any) => (
                  <div key={t.id} style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '10px 14px', background: 'var(--bg-app)', borderRadius: 8 }}>
                    <div style={{ width: 28, height: 28, borderRadius: '50%', background: 'linear-gradient(135deg, var(--border-input), var(--border-strong))', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 11, fontWeight: 700, color: 'var(--text-secondary)', fontFamily: 'Syne' }}>
                      {t.first_name?.[0]}{t.last_name?.[0]}
                    </div>
                    <div style={{ flex: 1 }}>
                      <div style={{ fontSize: 13, color: 'var(--text-primary)', fontFamily: 'IBM Plex Sans' }}>{t.first_name} {t.last_name}</div>
                      <div style={{ fontSize: 11, color: '#64748B' }}>{t.email || '—'}</div>
                    </div>
                    {t.active_lease_id && (
                      canGenerateContracts ? (
                        <button
                          onClick={() => downloadContract(t.active_lease_id, `${t.first_name}_${t.last_name}`)}
                          disabled={downloadingLease === t.active_lease_id}
                          style={{ display: 'flex', alignItems: 'center', gap: 5, padding: '5px 10px', borderRadius: 6, background: 'rgba(var(--accent-rgb),0.1)', border: '1px solid rgba(var(--accent-rgb),0.3)', color: '#FBC02D', fontSize: 11, fontFamily: 'IBM Plex Mono', cursor: 'pointer' }}>
                          <FileText size={11} /> {downloadingLease === t.active_lease_id ? 'Generating...' : 'Contract'}
                        </button>
                      ) : (
                        <Link href="/pricing" title="Upgrade to Professional to generate rental contracts" style={{ display: 'flex', alignItems: 'center', gap: 5, padding: '5px 10px', borderRadius: 6, background: 'rgba(100,116,139,0.1)', border: '1px solid var(--border-strong)', color: '#64748B', fontSize: 11, fontFamily: 'IBM Plex Mono', textDecoration: 'none' }}>
                          <Lock size={11} /> Contract
                        </Link>
                      )
                    )}
                  </div>
                ))}
              </div>
            )}
          </Section>

          {/* Current maintenance requests */}
          <Section title="Current Maintenance Requests" action={<Link href={`/dashboard/maintenance?property=${id}`} style={linkStyle}>View all</Link>}>
            {activeTickets.length === 0 ? <Empty text="No open maintenance requests." /> : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                {activeTickets.map((t: any) => (
                  <Link key={t.id} href="/dashboard/maintenance" style={{ textDecoration: 'none', display: 'block' }}>
                    <div style={{ padding: '10px 14px', background: 'var(--bg-app)', borderRadius: 8 }}>
                      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 4 }}>
                        <span style={{ fontSize: 13, color: 'var(--text-primary)', fontFamily: 'IBM Plex Sans', fontWeight: 600 }}>{t.title}</span>
                        <span style={{ fontSize: 10, padding: '2px 8px', borderRadius: 4, background: `${STATUS_COLOR[t.status]}20`, color: STATUS_COLOR[t.status] }}>{t.status?.replace('_', ' ')}</span>
                      </div>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 6, fontSize: 11, color: '#64748B', fontFamily: 'IBM Plex Mono' }}>
                        <Building2 size={11} /> {t.property_name}{t.unit_number ? ` · Unit ${t.unit_number}` : ' · Unit unspecified'}
                      </div>
                      <div style={{ display: 'flex', gap: 6 }}>
                        <span style={{ fontSize: 10, padding: '2px 6px', borderRadius: 4, background: `${PRIORITY_COLOR[t.priority]}20`, color: PRIORITY_COLOR[t.priority], fontFamily: 'IBM Plex Mono' }}>{t.priority}</span>
                        <span style={{ fontSize: 10, padding: '2px 6px', borderRadius: 4, background: 'rgba(100,116,139,0.15)', color: 'var(--text-secondary)', fontFamily: 'IBM Plex Mono' }}>{t.category}</span>
                      </div>
                    </div>
                  </Link>
                ))}
              </div>
            )}
          </Section>

          {/* Local vendors */}
          <Section title="Local Vendors">
            {vendors.length === 0 ? <Empty text="No vendors have worked at this property yet." /> : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                {vendors.map((v: any) => {
                  const isOpen = expandedVendor === v.id;
                  return (
                    <div key={v.id} style={{ background: 'var(--bg-app)', borderRadius: 8, overflow: 'hidden' }}>
                      <div
                        onClick={() => setExpandedVendor(isOpen ? null : v.id)}
                        style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '10px 14px', cursor: 'pointer' }}>
                        <div>
                          <div style={{ fontSize: 13, color: 'var(--text-primary)', fontFamily: 'IBM Plex Sans' }}>{v.name}</div>
                          <div style={{ fontSize: 11, color: '#64748B' }}>{v.company} · {(v.specialties || []).join(', ')}</div>
                        </div>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                          {v.rating && (
                            <div style={{ display: 'flex', alignItems: 'center', gap: 4, fontSize: 12, color: '#FBC02D' }}>
                              <Star size={12} fill="#FBC02D" /> {v.rating}
                            </div>
                          )}
                          {isOpen ? <ChevronUp size={14} color="#64748B" /> : <ChevronDown size={14} color="#64748B" />}
                        </div>
                      </div>
                      {isOpen && (
                        <div style={{ padding: '0 14px 12px', display: 'flex', flexDirection: 'column', gap: 6, borderTop: '1px solid var(--border-subtle)' }}>
                          {v.phone && (
                            <a href={`tel:${v.phone}`} style={{ display: 'flex', alignItems: 'center', gap: 8, marginTop: 10, fontSize: 12, color: 'var(--text-secondary)', textDecoration: 'none' }}>
                              <Phone size={12} color="#FBC02D" /> {v.phone}
                            </a>
                          )}
                          {v.email && (
                            <a href={`mailto:${v.email}`} style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 12, color: 'var(--text-secondary)', textDecoration: 'none' }}>
                              <Mail size={12} color="#FBC02D" /> {v.email}
                            </a>
                          )}
                          {v.hourly_rate && (
                            <div style={{ fontSize: 12, color: '#64748B' }}>{formatMoney(v.hourly_rate)}/hr</div>
                          )}
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            )}
          </Section>
        </div>

        {showEditProperty && (
          <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.8)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000 }}>
            <div style={{ background: 'var(--bg-surface)', border: '1px solid var(--border-strong)', borderRadius: 16, padding: 28, width: 480, maxHeight: '85vh', overflowY: 'auto' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 }}>
                <h2 style={{ fontFamily: 'Syne', fontWeight: 700, fontSize: 18, color: 'var(--text-primary)' }}>Edit Property</h2>
                <button onClick={() => setShowEditProperty(false)} style={{ background: 'none', border: 'none', color: '#64748B', cursor: 'pointer' }}><X size={18} /></button>
              </div>

              <label style={mlbl}>Name</label>
              <input value={propertyForm.name || ''} onChange={e => setPropertyForm((p: any) => ({ ...p, name: e.target.value }))} spellCheck autoCorrect="on" autoCapitalize="words" style={minp} />

              <label style={{ ...mlbl, marginTop: 12 }}>Address</label>
              <input value={propertyForm.address || ''} onChange={e => setPropertyForm((p: any) => ({ ...p, address: e.target.value }))} spellCheck autoCorrect="on" style={minp} />

              <div style={{ display: 'grid', gridTemplateColumns: isMobile ? '1fr' : '2fr 1fr 1fr', gap: 10, marginTop: 12 }}>
                <div>
                  <label style={mlbl}>City</label>
                  <input value={propertyForm.city || ''} onChange={e => setPropertyForm((p: any) => ({ ...p, city: e.target.value }))} spellCheck autoCorrect="on" style={minp} />
                </div>
                <div>
                  <label style={mlbl}>State</label>
                  <input value={propertyForm.state || ''} onChange={e => setPropertyForm((p: any) => ({ ...p, state: e.target.value }))} style={minp} />
                </div>
                <div>
                  <label style={mlbl}>Zip</label>
                  <input value={propertyForm.zip_code || ''} onChange={e => setPropertyForm((p: any) => ({ ...p, zip_code: e.target.value }))} style={minp} />
                </div>
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: 10, marginTop: 12 }}>
                <div>
                  <label style={mlbl}>Property Type</label>
                  <select value={propertyForm.property_type || 'apartment'} onChange={e => setPropertyForm((p: any) => ({ ...p, property_type: e.target.value }))} style={minp as any}>
                    {PROPERTY_TYPES.map(pt => <option key={pt} value={pt}>{pt.replace('_', ' ')}</option>)}
                  </select>
                </div>
                <div>
                  <label style={mlbl}>Year Built</label>
                  <input type="number" value={propertyForm.year_built ?? ''} onChange={e => setPropertyForm((p: any) => ({ ...p, year_built: e.target.value }))} style={minp} />
                </div>
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: 10, marginTop: 12 }}>
                <div>
                  <label style={mlbl}>Purchase Price</label>
                  <input type="number" value={propertyForm.purchase_price ?? ''} onChange={e => setPropertyForm((p: any) => ({ ...p, purchase_price: e.target.value }))} style={minp} />
                </div>
                <div>
                  <label style={mlbl}>Monthly Mortgage</label>
                  <input type="number" value={propertyForm.mortgage_payment ?? ''} onChange={e => setPropertyForm((p: any) => ({ ...p, mortgage_payment: e.target.value }))} style={minp} />
                </div>
              </div>

              <label style={{ ...mlbl, marginTop: 12 }}>Description</label>
              <textarea value={propertyForm.description || ''} onChange={e => setPropertyForm((p: any) => ({ ...p, description: e.target.value }))} spellCheck autoCorrect="on" autoCapitalize="sentences" style={{ ...minp, height: 80, resize: 'none' } as any} />

              <button onClick={saveProperty} disabled={savingProperty} style={{ width: '100%', marginTop: 18, padding: 12, background: 'linear-gradient(135deg, #FBC02D, #F57F17)', color: 'var(--bg-app)', fontWeight: 700, fontFamily: 'Syne', border: 'none', borderRadius: 8, cursor: 'pointer' }}>
                {savingProperty ? 'Saving...' : 'Save Changes'}
              </button>
            </div>
          </div>
        )}

        {editingUnit && (
          <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.8)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000 }}>
            <div style={{ background: 'var(--bg-surface)', border: '1px solid var(--border-strong)', borderRadius: 16, padding: 28, width: 420 }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 }}>
                <h2 style={{ fontFamily: 'Syne', fontWeight: 700, fontSize: 18, color: 'var(--text-primary)' }}>Edit Unit {editingUnit.unit_number}</h2>
                <button onClick={() => setEditingUnit(null)} style={{ background: 'none', border: 'none', color: '#64748B', cursor: 'pointer' }}><X size={18} /></button>
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: 10 }}>
                <div>
                  <label style={mlbl}>Unit Number</label>
                  <input value={unitForm.unit_number || ''} onChange={e => setUnitForm((u: any) => ({ ...u, unit_number: e.target.value }))} style={minp} />
                </div>
                <div>
                  <label style={mlbl}>Monthly Rent</label>
                  <input type="number" value={unitForm.monthly_rent ?? ''} onChange={e => setUnitForm((u: any) => ({ ...u, monthly_rent: e.target.value }))} style={minp} />
                </div>
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(160px, 1fr))', gap: 10, marginTop: 12 }}>
                <div>
                  <label style={mlbl}>Bedrooms</label>
                  <input type="number" value={unitForm.bedrooms ?? ''} onChange={e => setUnitForm((u: any) => ({ ...u, bedrooms: e.target.value }))} style={minp} />
                </div>
                <div>
                  <label style={mlbl}>Bathrooms</label>
                  <input type="number" step="0.5" value={unitForm.bathrooms ?? ''} onChange={e => setUnitForm((u: any) => ({ ...u, bathrooms: e.target.value }))} style={minp} />
                </div>
                <div>
                  <label style={mlbl}>Sq Ft</label>
                  <input type="number" value={unitForm.square_feet ?? ''} onChange={e => setUnitForm((u: any) => ({ ...u, square_feet: e.target.value }))} style={minp} />
                </div>
              </div>

              <div style={{ display: 'flex', gap: 20, marginTop: 16 }}>
                <label style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 13, color: 'var(--text-secondary)', cursor: 'pointer' }}>
                  <input type="checkbox" checked={!!unitForm.is_occupied} onChange={e => setUnitForm((u: any) => ({ ...u, is_occupied: e.target.checked }))} />
                  Occupied
                </label>
                <label style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 13, color: 'var(--text-secondary)', cursor: 'pointer' }}>
                  <input type="checkbox" checked={!!unitForm.is_available} onChange={e => setUnitForm((u: any) => ({ ...u, is_available: e.target.checked }))} />
                  Available for lease
                </label>
              </div>

              <button onClick={saveUnit} disabled={savingUnit} style={{ width: '100%', marginTop: 18, padding: 12, background: 'linear-gradient(135deg, #FBC02D, #F57F17)', color: 'var(--bg-app)', fontWeight: 700, fontFamily: 'Syne', border: 'none', borderRadius: 8, cursor: 'pointer' }}>
                {savingUnit ? 'Saving...' : 'Save Changes'}
              </button>
            </div>
          </div>
        )}
      </div>
    </DashboardLayout>
  );
}

function MiniStat({ label, value, negative }: { label: string; value: string; negative?: boolean }) {
  return (
    <div style={{ background: 'var(--bg-app)', borderRadius: 8, padding: 12 }}>
      <div style={{ fontSize: 10, color: '#64748B', fontFamily: 'IBM Plex Mono', marginBottom: 4 }}>{label.toUpperCase()}</div>
      <div style={{ fontSize: 16, fontWeight: 700, fontFamily: 'Syne', color: negative ? '#EF4444' : 'var(--text-primary)' }}>{value}</div>
    </div>
  );
}

function StatCard({ icon, label, value, sub }: { icon: React.ReactNode; label: string; value: string; sub?: string }) {
  return (
    <div style={{ background: 'var(--bg-surface)', border: '1px solid var(--border-strong)', borderRadius: 12, padding: 16 }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 8 }}>
        {icon}
        <span style={{ fontSize: 11, color: '#64748B', fontFamily: 'IBM Plex Mono', letterSpacing: '0.5px' }}>{label.toUpperCase()}</span>
      </div>
      <div style={{ fontSize: 22, fontWeight: 700, color: 'var(--text-primary)', fontFamily: 'Syne' }}>{value}</div>
      {sub && <div style={{ fontSize: 11, color: '#64748B', marginTop: 2 }}>{sub}</div>}
    </div>
  );
}

function Section({ title, action, children }: { title: string; action?: React.ReactNode; children: React.ReactNode }) {
  return (
    <div style={{ background: 'var(--bg-surface)', border: '1px solid var(--border-strong)', borderRadius: 12, padding: 20 }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 14 }}>
        <h3 style={{ fontFamily: 'Syne', fontWeight: 700, fontSize: 14, color: 'var(--text-primary)' }}>{title}</h3>
        {action}
      </div>
      {children}
    </div>
  );
}

function Empty({ text }: { text: string }) {
  return <div style={{ textAlign: 'center', padding: '24px 0', color: '#475569', fontSize: 12, fontFamily: 'IBM Plex Mono' }}>{text}</div>;
}

const linkStyle: React.CSSProperties = { fontSize: 11, color: '#FBC02D', fontFamily: 'IBM Plex Mono', textDecoration: 'none' };
const mlbl: React.CSSProperties = { display: 'block', marginBottom: 5, fontSize: 12, fontFamily: 'IBM Plex Mono', color: 'var(--text-secondary)' };
const minp: React.CSSProperties = { width: '100%', padding: '9px 12px', background: 'var(--bg-app)', border: '1px solid var(--border-input)', borderRadius: 8, color: 'var(--text-primary)', fontSize: 13, fontFamily: 'IBM Plex Sans', outline: 'none', boxSizing: 'border-box' };
