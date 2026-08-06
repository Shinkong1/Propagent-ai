import { useEffect, useState } from 'react';
import { useRouter } from 'next/router';
import DashboardLayout from '../../components/DashboardLayout';
import { DollarSign, TrendingUp, TrendingDown, Percent, Plus, X, Wallet } from 'lucide-react';
import { accounting as accountingApi, properties as propertiesApi } from '../../lib/api';
import { useCurrency } from '../../lib/CurrencyContext';
import ExportButtons from '../../components/ExportButtons';
import toast from 'react-hot-toast';

const EXPENSE_CATEGORIES = ['maintenance', 'utilities', 'insurance', 'property_tax', 'management_fee', 'mortgage', 'capital_improvement', 'other'];
const PAYMENT_METHODS = ['card', 'ach', 'check', 'cash', 'other'];
const PAYMENT_STATUSES = ['paid', 'pending', 'late', 'partial', 'missed'];

export default function Accounting() {
  const router = useRouter();
  const { formatMoney, symbol } = useCurrency();
  const fmtMoney = (v: number | null | undefined) => v == null ? '—' : formatMoney(Math.round(v));
  const [propertyList, setPropertyList] = useState<any[]>([]);
  const [propertyFilter, setPropertyFilter] = useState('all');
  const [report, setReport] = useState<any>(null);
  const [payments, setPayments] = useState<any[]>([]);
  const [expenses, setExpenses] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  const [showPaymentModal, setShowPaymentModal] = useState(false);
  const [leaseOptions, setLeaseOptions] = useState<any[]>([]);
  const [paymentForm, setPaymentForm] = useState({ lease_id: '', amount: '', due_date: '', paid_date: '', status: 'paid', payment_method: 'ach' });
  const [savingPayment, setSavingPayment] = useState(false);

  const [showExpenseModal, setShowExpenseModal] = useState(false);
  const [expenseForm, setExpenseForm] = useState({ property_id: '', category: 'other', amount: '', expense_date: '', description: '' });
  const [savingExpense, setSavingExpense] = useState(false);

  const load = (propertyId?: string) => {
    setLoading(true);
    const pid = propertyId === 'all' ? undefined : propertyId;
    const reportCall = pid ? accountingApi.propertyReport(pid) : accountingApi.portfolioReport();
    Promise.all([
      reportCall,
      accountingApi.listPayments(pid),
      accountingApi.listExpenses(pid),
    ]).then(([r, p, e]) => {
      setReport(r.data);
      setPayments(p.data || []);
      setExpenses(e.data || []);
    }).catch(() => toast.error('Failed to load financial data'))
      .finally(() => setLoading(false));
  };

  useEffect(() => {
    if (!router.isReady) return;
    const fromQuery = typeof router.query.property === 'string' ? router.query.property : 'all';
    setPropertyFilter(fromQuery);
    load(fromQuery);
    propertiesApi.list().then(r => setPropertyList(r.data || [])).catch(() => {});
    accountingApi.listLeases().then(r => setLeaseOptions(r.data || [])).catch(() => {});
  }, [router.isReady]);

  const changePropertyFilter = (propertyId: string) => {
    setPropertyFilter(propertyId);
    load(propertyId);
  };

  const openPaymentModal = () => {
    const today = new Date().toISOString().slice(0, 10);
    setPaymentForm({ lease_id: '', amount: '', due_date: today, paid_date: today, status: 'paid', payment_method: 'ach' });
    setShowPaymentModal(true);
  };

  const selectLease = (leaseId: string) => {
    const lease = leaseOptions.find(l => l.id === leaseId);
    setPaymentForm(p => ({ ...p, lease_id: leaseId, amount: lease ? String(lease.monthly_rent) : p.amount }));
  };

  const submitPayment = async () => {
    if (!paymentForm.lease_id || !paymentForm.amount || !paymentForm.due_date) { toast.error('Fill in lease, amount, and due date'); return; }
    setSavingPayment(true);
    try {
      await accountingApi.recordPayment({
        ...paymentForm,
        amount: parseFloat(paymentForm.amount),
        paid_date: paymentForm.paid_date || undefined,
      });
      toast.success('Payment recorded');
      setShowPaymentModal(false);
      load(propertyFilter);
    } catch { toast.error('Failed to record payment'); }
    finally { setSavingPayment(false); }
  };

  const openExpenseModal = () => {
    const today = new Date().toISOString().slice(0, 10);
    setExpenseForm({ property_id: propertyFilter !== 'all' ? propertyFilter : '', category: 'other', amount: '', expense_date: today, description: '' });
    setShowExpenseModal(true);
  };

  const submitExpense = async () => {
    if (!expenseForm.property_id || !expenseForm.amount || !expenseForm.expense_date) { toast.error('Fill in property, amount, and date'); return; }
    setSavingExpense(true);
    try {
      await accountingApi.recordExpense({ ...expenseForm, amount: parseFloat(expenseForm.amount) });
      toast.success('Expense recorded');
      setShowExpenseModal(false);
      load(propertyFilter);
    } catch { toast.error('Failed to record expense'); }
    finally { setSavingExpense(false); }
  };

  return (
    <DashboardLayout>
      <div style={{ maxWidth: 1200 }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 24, flexWrap: 'wrap', gap: 12 }}>
          <div>
            <h1 style={{ fontFamily: 'Syne', fontWeight: 800, fontSize: 28, color: 'var(--text-primary)', marginBottom: 4 }}>Accounting</h1>
            <p style={{ color: '#64748B', fontSize: 14 }}>
              {report ? `${report.period_start} → ${report.period_end}` : 'Loading...'}
            </p>
          </div>
          <div style={{ display: 'flex', gap: 10 }}>
            <select value={propertyFilter} onChange={e => changePropertyFilter(e.target.value)}
              style={{ padding: '9px 14px', background: 'var(--bg-surface)', border: '1px solid var(--border-strong)', borderRadius: 8, color: 'var(--text-secondary)', fontSize: 13, fontFamily: 'IBM Plex Sans', outline: 'none' }}>
              <option value="all">All Properties</option>
              {propertyList.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
            </select>
            <button onClick={openExpenseModal} style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '10px 16px', background: 'var(--bg-surface)', border: '1px solid var(--border-strong)', borderRadius: 8, color: 'var(--text-secondary)', fontWeight: 600, fontFamily: 'Syne', fontSize: 13, cursor: 'pointer' }}>
              <Plus size={14} /> Expense
            </button>
            <button onClick={openPaymentModal} style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '10px 16px', background: 'linear-gradient(135deg, #FBC02D, #F57F17)', color: 'var(--bg-app)', border: 'none', borderRadius: 8, fontWeight: 700, fontFamily: 'Syne', fontSize: 13, cursor: 'pointer' }}>
              <Plus size={14} /> Payment
            </button>
            <ExportButtons
              onExport={(format) => propertyFilter === 'all' ? accountingApi.exportPortfolioReport(format) : accountingApi.exportPropertyReport(propertyFilter, format)}
              filenameBase="financial_report"
            />
          </div>
        </div>

        {/* Financial stats */}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(140px, 1fr))', gap: 12, marginBottom: 28 }}>
          <StatCard icon={<TrendingUp size={15} color="#10B981" />} label="Income" value={fmtMoney(report?.total_income)} />
          <StatCard icon={<TrendingDown size={15} color="#EF4444" />} label="Expenses" value={fmtMoney(report?.total_expenses)} />
          <StatCard icon={<DollarSign size={15} color="#FBC02D" />} label="NOI" value={fmtMoney(report?.noi)} />
          <StatCard icon={<Percent size={15} color="#3B82F6" />} label="Cap Rate" value={report?.cap_rate != null ? `${report.cap_rate}%` : '—'} />
          <StatCard icon={<Wallet size={15} color="#8B5CF6" />} label="DSCR" value={report?.dscr != null ? report.dscr.toFixed(2) : '—'} />
          <StatCard icon={<DollarSign size={15} color={report?.cash_flow < 0 ? '#EF4444' : '#10B981'} />} label="Cash Flow" value={fmtMoney(report?.cash_flow)} />
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: 20 }}>
          {/* Recent Payments */}
          <Section title="Recent Rent Payments">
            {payments.length === 0 ? <Empty text="No payments recorded yet." /> : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 8, maxHeight: 420, overflowY: 'auto' }}>
                {payments.slice(0, 30).map((p: any) => (
                  <div key={p.id} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '10px 14px', background: 'var(--bg-app)', borderRadius: 8 }}>
                    <div>
                      <div style={{ fontSize: 13, color: 'var(--text-primary)', fontFamily: 'IBM Plex Sans', fontWeight: 600, marginBottom: 2 }}>{p.tenant_name || 'Unknown tenant'}</div>
                      <div style={{ fontSize: 12, color: 'var(--text-secondary)', fontFamily: 'IBM Plex Mono', marginBottom: 2 }}>{formatMoney(p.amount)} · {p.property_name}{p.unit_number ? ` · Unit ${p.unit_number}` : ''}</div>
                      <div style={{ fontSize: 11, color: '#64748B' }}>Due {p.due_date}{p.paid_date ? ` · Paid ${p.paid_date}` : ''}</div>
                    </div>
                    <span style={{ fontSize: 10, padding: '3px 8px', borderRadius: 4, fontFamily: 'IBM Plex Mono', background: `${STATUS_COLOR[p.status]}20`, color: STATUS_COLOR[p.status] }}>
                      {p.status}
                    </span>
                  </div>
                ))}
              </div>
            )}
          </Section>

          {/* Recent Expenses */}
          <Section title="Recent Expenses">
            {expenses.length === 0 ? <Empty text="No expenses recorded yet." /> : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 8, maxHeight: 420, overflowY: 'auto' }}>
                {expenses.slice(0, 30).map((e: any) => (
                  <div key={e.id} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '10px 14px', background: 'var(--bg-app)', borderRadius: 8 }}>
                    <div>
                      <div style={{ fontSize: 13, color: 'var(--text-primary)', fontFamily: 'IBM Plex Mono' }}>{formatMoney(e.amount)}</div>
                      <div style={{ fontSize: 11, color: '#64748B' }}>{e.expense_date}{e.description ? ` · ${e.description}` : ''}</div>
                    </div>
                    <span style={{ fontSize: 10, padding: '3px 8px', borderRadius: 4, fontFamily: 'IBM Plex Mono', background: 'rgba(100,116,139,0.15)', color: 'var(--text-secondary)', textTransform: 'capitalize' }}>
                      {e.category.replace('_', ' ')}
                    </span>
                  </div>
                ))}
              </div>
            )}
          </Section>
        </div>

        {/* Record Payment Modal */}
        {showPaymentModal && (
          <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.8)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000, padding: 20 }}>
            <div style={{ background: 'var(--bg-surface)', border: '1px solid var(--border-strong)', borderRadius: 16, padding: 28, width: '100%', maxWidth: 440 }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 }}>
                <h2 style={{ fontFamily: 'Syne', fontWeight: 700, fontSize: 18, color: 'var(--text-primary)' }}>Record Rent Payment</h2>
                <button onClick={() => setShowPaymentModal(false)} style={{ background: 'none', border: 'none', color: '#64748B', cursor: 'pointer' }}><X size={18} /></button>
              </div>
              <div style={{ marginBottom: 14 }}>
                <label style={lbl}>Tenant / Lease</label>
                <select value={paymentForm.lease_id} onChange={e => selectLease(e.target.value)} style={{ ...inp } as any}>
                  <option value="">Select...</option>
                  {leaseOptions.map(l => <option key={l.id} value={l.id}>{l.tenant_name} — {l.property_name} · Unit {l.unit_number}</option>)}
                </select>
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: 12, marginBottom: 14 }}>
                <div>
                  <label style={lbl}>Amount ({symbol})</label>
                  <input value={paymentForm.amount} onChange={e => setPaymentForm(p => ({ ...p, amount: e.target.value }))} style={inp} spellCheck={false} autoCorrect="off" />
                </div>
                <div>
                  <label style={lbl}>Status</label>
                  <select value={paymentForm.status} onChange={e => setPaymentForm(p => ({ ...p, status: e.target.value }))} style={{ ...inp } as any}>
                    {PAYMENT_STATUSES.map(s => <option key={s} value={s}>{s}</option>)}
                  </select>
                </div>
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: 12, marginBottom: 14 }}>
                <div>
                  <label style={lbl}>Due Date</label>
                  <input type="date" value={paymentForm.due_date} onChange={e => setPaymentForm(p => ({ ...p, due_date: e.target.value }))} style={inp} />
                </div>
                <div>
                  <label style={lbl}>Paid Date</label>
                  <input type="date" value={paymentForm.paid_date} onChange={e => setPaymentForm(p => ({ ...p, paid_date: e.target.value }))} style={inp} />
                </div>
              </div>
              <div style={{ marginBottom: 20 }}>
                <label style={lbl}>Payment Method</label>
                <select value={paymentForm.payment_method} onChange={e => setPaymentForm(p => ({ ...p, payment_method: e.target.value }))} style={{ ...inp } as any}>
                  {PAYMENT_METHODS.map(m => <option key={m} value={m}>{m}</option>)}
                </select>
              </div>
              <button onClick={submitPayment} disabled={savingPayment} style={{ width: '100%', padding: 12, background: 'linear-gradient(135deg, #FBC02D, #F57F17)', color: 'var(--bg-app)', fontWeight: 700, fontFamily: 'Syne', border: 'none', borderRadius: 8, cursor: 'pointer' }}>
                {savingPayment ? 'Saving...' : 'Record Payment'}
              </button>
            </div>
          </div>
        )}

        {/* Record Expense Modal */}
        {showExpenseModal && (
          <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.8)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000, padding: 20 }}>
            <div style={{ background: 'var(--bg-surface)', border: '1px solid var(--border-strong)', borderRadius: 16, padding: 28, width: '100%', maxWidth: 440 }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 }}>
                <h2 style={{ fontFamily: 'Syne', fontWeight: 700, fontSize: 18, color: 'var(--text-primary)' }}>Record Expense</h2>
                <button onClick={() => setShowExpenseModal(false)} style={{ background: 'none', border: 'none', color: '#64748B', cursor: 'pointer' }}><X size={18} /></button>
              </div>
              <div style={{ marginBottom: 14 }}>
                <label style={lbl}>Property</label>
                <select value={expenseForm.property_id} onChange={e => setExpenseForm(p => ({ ...p, property_id: e.target.value }))} style={{ ...inp } as any}>
                  <option value="">Select...</option>
                  {propertyList.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
                </select>
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: 12, marginBottom: 14 }}>
                <div>
                  <label style={lbl}>Category</label>
                  <select value={expenseForm.category} onChange={e => setExpenseForm(p => ({ ...p, category: e.target.value }))} style={{ ...inp } as any}>
                    {EXPENSE_CATEGORIES.map(c => <option key={c} value={c}>{c.replace('_', ' ')}</option>)}
                  </select>
                </div>
                <div>
                  <label style={lbl}>Amount ({symbol})</label>
                  <input value={expenseForm.amount} onChange={e => setExpenseForm(p => ({ ...p, amount: e.target.value }))} style={inp} spellCheck={false} autoCorrect="off" />
                </div>
              </div>
              <div style={{ marginBottom: 14 }}>
                <label style={lbl}>Date</label>
                <input type="date" value={expenseForm.expense_date} onChange={e => setExpenseForm(p => ({ ...p, expense_date: e.target.value }))} style={inp} />
              </div>
              <div style={{ marginBottom: 20 }}>
                <label style={lbl}>Description</label>
                <input value={expenseForm.description} onChange={e => setExpenseForm(p => ({ ...p, description: e.target.value }))} placeholder="Roof repair, quarterly insurance..." style={inp} spellCheck autoCorrect="on" autoCapitalize="sentences" />
              </div>
              <button onClick={submitExpense} disabled={savingExpense} style={{ width: '100%', padding: 12, background: 'linear-gradient(135deg, #FBC02D, #F57F17)', color: 'var(--bg-app)', fontWeight: 700, fontFamily: 'Syne', border: 'none', borderRadius: 8, cursor: 'pointer' }}>
                {savingExpense ? 'Saving...' : 'Record Expense'}
              </button>
            </div>
          </div>
        )}
      </div>
    </DashboardLayout>
  );
}

const STATUS_COLOR: any = { paid: '#10B981', pending: '#3B82F6', late: '#F97316', partial: '#8B5CF6', missed: '#EF4444' };

function StatCard({ icon, label, value }: { icon: React.ReactNode; label: string; value: string }) {
  return (
    <div style={{ background: 'var(--bg-surface)', border: '1px solid var(--border-strong)', borderRadius: 12, padding: 14 }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 8 }}>
        {icon}
        <span style={{ fontSize: 10, color: '#64748B', fontFamily: 'IBM Plex Mono', letterSpacing: '0.5px' }}>{label.toUpperCase()}</span>
      </div>
      <div style={{ fontSize: 18, fontWeight: 700, color: 'var(--text-primary)', fontFamily: 'Syne' }}>{value}</div>
    </div>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div style={{ background: 'var(--bg-surface)', border: '1px solid var(--border-strong)', borderRadius: 12, padding: 20 }}>
      <h3 style={{ fontFamily: 'Syne', fontWeight: 700, fontSize: 14, color: 'var(--text-primary)', marginBottom: 14 }}>{title}</h3>
      {children}
    </div>
  );
}

function Empty({ text }: { text: string }) {
  return <div style={{ textAlign: 'center', padding: '24px 0', color: '#475569', fontSize: 12, fontFamily: 'IBM Plex Mono' }}>{text}</div>;
}

const lbl: React.CSSProperties = { display: 'block', marginBottom: 5, fontSize: 12, fontFamily: 'IBM Plex Mono', color: 'var(--text-secondary)' };
const inp: React.CSSProperties = { width: '100%', padding: '9px 12px', background: 'var(--bg-app)', border: '1px solid var(--border-input)', borderRadius: 8, color: 'var(--text-primary)', fontSize: 13, fontFamily: 'IBM Plex Sans', outline: 'none', boxSizing: 'border-box' };
