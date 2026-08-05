import { useEffect, useState } from 'react';
import Head from 'next/head';
import Link from 'next/link';
import { Home, MapPin, DollarSign, Calendar, CreditCard, Wrench, ArrowRight } from 'lucide-react';
import PortalLayout from '../../components/PortalLayout';
import { tenantPortal } from '../../lib/tenantApi';
import { useCurrency } from '../../lib/CurrencyContext';

export default function TenantDashboard() {
  const { formatMoney } = useCurrency();
  const [me, setMe] = useState<any>(null);
  const [payments, setPayments] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    Promise.all([tenantPortal.me(), tenantPortal.payments()])
      .then(([meRes, paymentsRes]) => {
        setMe(meRes.data);
        setPayments(paymentsRes.data || []);
      })
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  const unpaid = payments.filter(p => p.status !== 'paid');
  const balanceDue = unpaid.reduce((sum, p) => sum + p.amount, 0);

  return (
    <PortalLayout>
      <Head><title>Tenant Portal — Dashboard</title></Head>
      {loading ? (
        <div style={{ color: '#64748B', fontFamily: 'IBM Plex Mono' }}>Loading...</div>
      ) : (
        <>
          <h1 style={{ fontFamily: 'Syne', fontWeight: 800, fontSize: 24, color: 'var(--text-primary)', marginBottom: 4 }}>
            Welcome, {me?.first_name}
          </h1>
          <p style={{ color: '#64748B', fontSize: 14, marginBottom: 24 }}>{me?.organization_name}</p>

          {me?.active_lease ? (
            <div style={{ background: 'var(--bg-surface)', border: '1px solid var(--border-strong)', borderRadius: 14, padding: 24, marginBottom: 20 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 16 }}>
                <Home size={18} color="#FBC02D" />
                <h2 style={{ fontFamily: 'Syne', fontWeight: 700, fontSize: 16, color: 'var(--text-primary)' }}>{me.active_lease.property_name}</h2>
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: 6, color: '#64748B', fontSize: 13, marginBottom: 16 }}>
                <MapPin size={13} /> {me.active_lease.property_address}{me.active_lease.unit_number ? ` · Unit ${me.active_lease.unit_number}` : ''}
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(140px, 1fr))', gap: 14 }}>
                <MiniStat icon={<DollarSign size={14} color="#10B981" />} label="Monthly Rent" value={formatMoney(me.active_lease.monthly_rent)} />
                <MiniStat icon={<Calendar size={14} color="#3B82F6" />} label="Lease Ends" value={new Date(me.active_lease.end_date).toLocaleDateString()} />
                <MiniStat icon={<DollarSign size={14} color={balanceDue > 0 ? '#EF4444' : '#10B981'} />} label="Balance Due" value={formatMoney(balanceDue)} negative={balanceDue > 0} />
              </div>
            </div>
          ) : (
            <div style={{ background: 'var(--bg-surface)', border: '1px solid var(--border-strong)', borderRadius: 14, padding: 24, marginBottom: 20, textAlign: 'center', color: '#64748B', fontSize: 13 }}>
              No active lease on file. Contact your property manager if this looks wrong.
            </div>
          )}

          {!me?.rent_payments_enabled && me?.active_lease && (
            <div style={{ background: 'rgba(251,192,45,0.06)', border: '1px solid rgba(251,192,45,0.25)', borderRadius: 12, padding: '14px 18px', marginBottom: 20, fontSize: 13, color: 'var(--text-secondary)' }}>
              Online rent payment isn't set up for this property yet — your property manager will need to complete that first.
            </div>
          )}

          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: 14 }}>
            <Link href="/portal/payments" style={{ textDecoration: 'none' }}>
              <div style={quickLinkStyle}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                  <CreditCard size={18} color="#FBC02D" />
                  <div>
                    <div style={{ fontFamily: 'Syne', fontWeight: 700, fontSize: 14, color: 'var(--text-primary)' }}>Payments</div>
                    <div style={{ fontSize: 12, color: '#64748B' }}>{unpaid.length > 0 ? `${unpaid.length} due` : 'All caught up'}</div>
                  </div>
                </div>
                <ArrowRight size={16} color="#64748B" />
              </div>
            </Link>
            <Link href="/portal/maintenance" style={{ textDecoration: 'none' }}>
              <div style={quickLinkStyle}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                  <Wrench size={18} color="#FBC02D" />
                  <div>
                    <div style={{ fontFamily: 'Syne', fontWeight: 700, fontSize: 14, color: 'var(--text-primary)' }}>Maintenance</div>
                    <div style={{ fontSize: 12, color: '#64748B' }}>Submit or view requests</div>
                  </div>
                </div>
                <ArrowRight size={16} color="#64748B" />
              </div>
            </Link>
          </div>
        </>
      )}
    </PortalLayout>
  );
}

function MiniStat({ icon, label, value, negative }: { icon: React.ReactNode; label: string; value: string; negative?: boolean }) {
  return (
    <div style={{ background: 'var(--bg-app)', borderRadius: 10, padding: 14 }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 6 }}>
        {icon}
        <span style={{ fontSize: 10, color: '#64748B', fontFamily: 'IBM Plex Mono', letterSpacing: '0.5px' }}>{label.toUpperCase()}</span>
      </div>
      <div style={{ fontSize: 16, fontWeight: 700, fontFamily: 'Syne', color: negative ? '#EF4444' : 'var(--text-primary)' }}>{value}</div>
    </div>
  );
}

const quickLinkStyle: React.CSSProperties = {
  display: 'flex', alignItems: 'center', justifyContent: 'space-between', background: 'var(--bg-surface)',
  border: '1px solid var(--border-strong)', borderRadius: 14, padding: 20, cursor: 'pointer',
};
