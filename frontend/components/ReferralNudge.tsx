import { useEffect, useState } from 'react';
import { Gift, Copy, X } from 'lucide-react';
import { auth } from '../lib/api';
import toast from 'react-hot-toast';

// The referral program itself (code generation, the credit-earning webhook
// hook in routes/billing.py, the full editable view on the Profile page)
// was already fully built -- this was just never surfaced anywhere a user
// would actually see it day to day, only on Profile, which nothing points
// people toward. This is a slim, dismissible pointer on the page people
// actually land on, reusing the same GET /auth/organization/referral call
// Profile already makes; no new backend work.
const DISMISS_KEY = 'referralNudgeDismissed';

export default function ReferralNudge() {
  const [referral, setReferral] = useState<{ referral_code: string; referral_credits_earned: number } | null>(null);
  const [dismissed, setDismissed] = useState(() => {
    if (typeof window === 'undefined') return false;
    return localStorage.getItem(DISMISS_KEY) === '1';
  });

  useEffect(() => {
    auth.referral().then(r => setReferral(r.data)).catch(() => {});
  }, []);

  if (dismissed || !referral) return null;

  const referralLink = `https://propagent.app/signup?ref=${referral.referral_code}`;

  const copyLink = async () => {
    try {
      await navigator.clipboard.writeText(referralLink);
      toast.success('Referral link copied');
    } catch {
      toast.error('Could not copy — copy it from your Profile page instead');
    }
  };

  const dismiss = () => {
    localStorage.setItem(DISMISS_KEY, '1');
    setDismissed(true);
  };

  return (
    <div style={{
      display: 'flex', alignItems: 'center', gap: 12, flexWrap: 'wrap',
      background: 'linear-gradient(135deg, rgba(251,192,45,0.07), var(--bg-surface))',
      border: '1px solid rgba(251,192,45,0.25)', borderRadius: 12, padding: '14px 18px', marginBottom: 24,
    }}>
      <Gift size={16} color="#FBC02D" style={{ flexShrink: 0 }} />
      <div style={{ flex: 1, minWidth: 200, fontSize: 13, color: 'var(--text-secondary)', fontFamily: 'IBM Plex Sans' }}>
        Know another property manager? Send them your link — when they convert to a paid plan, you earn a referral credit.
        {referral.referral_credits_earned > 0 && (
          <span style={{ color: 'var(--text-primary)', fontWeight: 600 }}> You've earned {referral.referral_credits_earned} so far.</span>
        )}
      </div>
      <button onClick={copyLink} className="pa-focus" style={{
        display: 'inline-flex', alignItems: 'center', gap: 6, background: 'var(--bg-app)', border: '1px solid var(--border-strong)',
        borderRadius: 8, padding: '7px 12px', fontSize: 12.5, fontFamily: 'IBM Plex Mono', color: 'var(--text-primary)', cursor: 'pointer', whiteSpace: 'nowrap',
      }}>
        <Copy size={13} /> Copy my link
      </button>
      <button onClick={dismiss} aria-label="Dismiss" className="pa-focus" style={{
        background: 'none', border: 'none', color: 'var(--text-muted)', cursor: 'pointer', padding: 4, display: 'flex',
      }}>
        <X size={15} />
      </button>
    </div>
  );
}
