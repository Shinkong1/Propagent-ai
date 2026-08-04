import { useState } from 'react';
import DashboardLayout from '../../components/DashboardLayout';
import { Mail, Send } from 'lucide-react';
import { contact as contactApi } from '../../lib/api';
import { useLanguage } from '../../lib/LanguageContext';
import toast from 'react-hot-toast';

export default function ContactUs() {
  const { t } = useLanguage();
  const [subject, setSubject] = useState('');
  const [message, setMessage] = useState('');
  const [sending, setSending] = useState(false);

  const send = async () => {
    if (!subject.trim() || !message.trim()) {
      toast.error(t('contact.requiredError'));
      return;
    }
    setSending(true);
    try {
      const res = await contactApi.send(subject.trim(), message.trim());
      if (res.data?.status === 'sent') {
        toast.success(t('contact.sent'));
      } else {
        toast.error(t('contact.sendFailed'));
      }
      setSubject(''); setMessage('');
    } catch (err: any) {
      toast.error(err?.response?.data?.detail || t('contact.sendFailed'));
    } finally {
      setSending(false);
    }
  };

  return (
    <DashboardLayout>
      <div style={{ maxWidth: 560 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 6 }}>
          <Mail size={26} color="#FBC02D" />
          <h1 style={{ fontFamily: 'Syne', fontWeight: 800, fontSize: 28, color: 'var(--text-primary)' }}>{t('contact.title')}</h1>
        </div>
        <p style={{ color: '#64748B', fontSize: 14, marginBottom: 24 }}>{t('contact.subtitle')}</p>

        <div style={{ background: 'var(--bg-surface)', border: '1px solid var(--border-strong)', borderRadius: 12, padding: 24 }}>
          <label style={lbl}>{t('contact.subjectLabel')}</label>
          <input
            value={subject}
            onChange={e => setSubject(e.target.value)}
            placeholder={t('contact.subjectPlaceholder')}
            spellCheck autoCorrect="on" autoCapitalize="sentences"
            style={inp}
          />
          <label style={{ ...lbl, marginTop: 16 }}>{t('contact.messageLabel')}</label>
          <textarea
            value={message}
            onChange={e => setMessage(e.target.value)}
            placeholder={t('contact.messagePlaceholder')}
            spellCheck autoCorrect="on" autoCapitalize="sentences"
            style={{ ...inp, height: 160, resize: 'none' } as any}
          />
          <button onClick={send} disabled={sending} style={{
            display: 'flex', alignItems: 'center', gap: 8, marginTop: 18, padding: '11px 22px',
            background: 'linear-gradient(135deg, #FBC02D, #F57F17)', color: 'var(--bg-app)',
            fontWeight: 700, fontFamily: 'Syne', border: 'none', borderRadius: 8, cursor: 'pointer', fontSize: 14,
          }}>
            <Send size={15} /> {sending ? t('contact.sending') : t('contact.send')}
          </button>
        </div>
        <p style={{ marginTop: 20, fontSize: 11, color: '#475569' }}>{t('contact.note')}</p>
      </div>
    </DashboardLayout>
  );
}

const lbl: React.CSSProperties = { display: 'block', marginBottom: 5, fontSize: 12, fontFamily: 'IBM Plex Mono', color: 'var(--text-secondary)' };
const inp: React.CSSProperties = { width: '100%', padding: '9px 12px', background: 'var(--bg-app)', border: '1px solid var(--border-input)', borderRadius: 8, color: 'var(--text-primary)', fontSize: 13, fontFamily: 'IBM Plex Sans', outline: 'none', boxSizing: 'border-box' };
