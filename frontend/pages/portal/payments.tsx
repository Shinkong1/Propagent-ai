import { useEffect, useState } from 'react';
import { useRouter } from 'next/router';
import Head from 'next/head';
import { CheckCircle, Clock, AlertCircle } from 'lucide-react';
import toast from 'react-hot-toast';
import PortalLayout from '../../components/PortalLayout';
import { tenantPortal } from '../../lib/tenantApi';
import { useCurrency } from '../../lib/CurrencyContext';

const STATUS_STYLE: Record<string, { color: string; icon: any; label: string }> = {
  paid: { color: '#10B981', icon: CheckCircle, label: 'Paid' },
  pending: { color: '#64748B', icon: Clock, label: 'Pending' },
  late: { color: '#EF4444', icon: AlertCircle, label: 'Late' },
  partial: { color: '#FBC02D', icon: AlertCircle, label: 'Partial' },
  missed: { color: '#EF4444', icon: AlertCircle, label: 'Missed' },
};

export default function TenantPayments() {
  const router = useRouter();
  const { formatMoney } = useCurrency();
  const [payments, setPayments] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [payingId, setPayingId] = useState<string | null>(null);

  const load = () => {
    tenantPortal.payments().then(r => setPayments(r.data || [])).catch(() => {}).finally(() => setLoading(false));
  };

  useEffect(() => {
    load();
    if (router.query.paid) toast.success('Payment received — thank you!');
    if (router.query.canceled) toast('Payment canceled', { icon: 'ℹ️' });
  }, []);

  const payNow = async (paymentId: string) => {
    setPayingId(paymentId);
    try {
      const res = await tenantPortal.payNow(paymentId);
      window.location.href = res.data.checkout_url;
    } catch (err: any) {
      toast.error(err?.response?.data?.detail || 'Could not start payment');
      setPayingId(null);
    }
  };

  return (
    <PortalLayout>
      <Head><title>Tenant Portal — Payments</title></Head>
      <h1 style={{ fontFamily: 'Syne', fontWeight: 800, fontSize: 24, color: 'var(--text-primary)', marginBottom: 20 }}>Payments</h1>

      {loading ? (
        <div style={{ color: '#64748B', fontFamily: 'IBM Plex Mono' }}>Loading...</div>
      ) : payments.length === 0 ? (
        <div style={{ background: 'var(--bg-surface)', border: '1px solid var(--border-strong)', borderRadius: 14, padding: 40, textAlign: 'center', color: '#64748B', fontSize: 14 }}>
          No payments on file yet.
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
          {payments.map((p) => {
            const style = STATUS_STYLE[p.status] || STATUS_STYLE.pending;
            const Icon = style.icon;
            const canPay = p.status !== 'paid';
            return (
              <div key={p.id} style={{ background: 'var(--bg-surface)', border: '1px solid var(--border-strong)', borderRadius: 12, padding: '16px 20px', display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: 12 }}>
                <div>
                  <div style={{ fontSize: 16, fontWeight: 700, fontFamily: 'Syne', color: 'var(--text-primary)', marginBottom: 4 }}>{formatMoney(p.amount)}</div>
                  <div style={{ fontSize: 12, color: '#64748B' }}>
                    Due {new Date(p.due_date).toLocaleDateString()}
                    {p.paid_date ? ` · Paid ${new Date(p.paid_date).toLocaleDateString()}` : ''}
                    {p.property_name ? ` · ${p.property_name}${p.unit_number ? ` #${p.unit_number}` : ''}` : ''}
                  </div>
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 5, fontSize: 12, color: style.color, fontFamily: 'IBM Plex Mono' }}>
                    <Icon size={13} /> {style.label}
                  </div>
                  {canPay && (
                    <button onClick={() => payNow(p.id)} disabled={payingId === p.id} style={{
                      padding: '8px 16px', background: 'linear-gradient(135deg, #FBC02D, #F57F17)', color: 'var(--bg-app)',
                      fontWeight: 700, fontFamily: 'Syne', fontSize: 13, border: 'none', borderRadius: 8, cursor: 'pointer',
                      opacity: payingId === p.id ? 0.6 : 1,
                    }}>
                      {payingId === p.id ? 'Starting...' : 'Pay Now'}
                    </button>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}
    </PortalLayout>
  );
}
