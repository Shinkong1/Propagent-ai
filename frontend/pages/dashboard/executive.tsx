import { useEffect, useRef, useState } from 'react';
import Link from 'next/link';
import DashboardLayout from '../../components/DashboardLayout';
import { Sparkles, Send, Lock, User as UserIcon } from 'lucide-react';
import { executive as executiveApi } from '../../lib/api';
import { getUser } from '../../lib/auth';
import { useLanguage } from '../../lib/LanguageContext';

interface Message {
  role: 'user' | 'assistant';
  text: string;
  confidence?: number;
  explanation?: string;
  data?: any;
}

function DataTable({ data }: { data: any }) {
  if (!data) return null;
  if (Array.isArray(data)) {
    if (data.length === 0) return null;
    const columns = Object.keys(data[0]);
    return (
      <div style={{ marginTop: 10, overflowX: 'auto', border: '1px solid var(--border-strong)', borderRadius: 8 }}>
        <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 11 }}>
          <thead>
            <tr style={{ background: 'rgba(255,255,255,0.03)' }}>
              {columns.map(c => (
                <th key={c} style={{ padding: '6px 10px', textAlign: 'left', color: '#64748B', fontFamily: 'IBM Plex Mono', fontWeight: 500, whiteSpace: 'nowrap' }}>
                  {c.replace(/_/g, ' ')}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {data.slice(0, 10).map((row: any, i: number) => (
              <tr key={i} style={{ borderTop: '1px solid var(--border-subtle)' }}>
                {columns.map(c => (
                  <td key={c} style={{ padding: '6px 10px', color: 'var(--text-hover)', whiteSpace: 'nowrap' }}>
                    {Array.isArray(row[c]) ? row[c].join(', ') : String(row[c] ?? '—')}
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
        {data.length > 10 && (
          <div style={{ padding: '6px 10px', fontSize: 11, color: '#475569' }}>+ {data.length - 10} more</div>
        )}
      </div>
    );
  }
  if (typeof data === 'object') {
    return (
      <div style={{ marginTop: 10, display: 'flex', gap: 16, flexWrap: 'wrap' }}>
        {Object.entries(data).map(([k, v]) => (
          <div key={k} style={{ fontSize: 11 }}>
            <div style={{ color: '#64748B', fontFamily: 'IBM Plex Mono' }}>{k.replace(/_/g, ' ')}</div>
            <div style={{ color: 'var(--text-primary)', fontWeight: 600 }}>{String(v)}</div>
          </div>
        ))}
      </div>
    );
  }
  return null;
}

export default function ExecutiveAssistant() {
  const { t } = useLanguage();
  const userPlan = getUser()?.plan;
  const hasAccess = userPlan === 'professional' || userPlan === 'enterprise';

  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState('');
  const [suggestions, setSuggestions] = useState<string[]>([]);
  const [sending, setSending] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!hasAccess) return;
    executiveApi.suggestions().then(r => setSuggestions(r.data?.suggestions || [])).catch(() => {});
  }, [hasAccess]);

  useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: 'smooth' });
  }, [messages, sending]);

  const send = async (query: string) => {
    const text = query.trim();
    if (!text || sending) return;
    setMessages(prev => [...prev, { role: 'user', text }]);
    setInput('');
    setSending(true);
    try {
      const res = await executiveApi.query(text);
      setMessages(prev => [...prev, {
        role: 'assistant',
        text: res.data.answer,
        confidence: res.data.confidence,
        explanation: res.data.explanation,
        data: res.data.data,
      }]);
    } catch {
      setMessages(prev => [...prev, { role: 'assistant', text: 'Something went wrong answering that — please try again.' }]);
    } finally {
      setSending(false);
    }
  };

  if (!hasAccess) {
    return (
      <DashboardLayout>
        <div style={{ maxWidth: 640, margin: '80px auto', textAlign: 'center' }}>
          <div style={{ width: 56, height: 56, borderRadius: 14, background: 'rgba(var(--accent-rgb),0.1)', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 20px' }}>
            <Lock size={26} color="#FBC02D" />
          </div>
          <h1 style={{ fontFamily: 'Syne', fontWeight: 800, fontSize: 24, color: 'var(--text-primary)', marginBottom: 10 }}>{t('executive.title')}</h1>
          <p style={{ color: '#64748B', fontSize: 14, marginBottom: 24 }}>{t('executive.locked')}</p>
          <Link href="/pricing" style={{ display: 'inline-flex', alignItems: 'center', gap: 8, padding: '11px 22px', background: 'linear-gradient(135deg, #FBC02D, #F57F17)', color: 'var(--bg-app)', borderRadius: 8, fontWeight: 700, fontFamily: 'Syne', fontSize: 14, textDecoration: 'none' }}>
            {t('executive.upgradeCta')}
          </Link>
        </div>
      </DashboardLayout>
    );
  }

  return (
    <DashboardLayout>
      <div style={{ maxWidth: 820, height: 'calc(100vh - 120px)', display: 'flex', flexDirection: 'column' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 6 }}>
          <Sparkles size={24} color="#FBC02D" />
          <h1 style={{ fontFamily: 'Syne', fontWeight: 800, fontSize: 26, color: 'var(--text-primary)' }}>{t('executive.title')}</h1>
        </div>
        <p style={{ color: '#64748B', fontSize: 14, marginBottom: 18 }}>{t('executive.subtitle')}</p>

        <div ref={scrollRef} style={{ flex: 1, overflowY: 'auto', background: 'var(--bg-surface)', border: '1px solid var(--border-strong)', borderRadius: 12, padding: 20, marginBottom: 14 }}>
          {messages.length === 0 && (
            <div>
              <div style={{ fontSize: 12, color: '#64748B', fontFamily: 'IBM Plex Mono', marginBottom: 10 }}>{t('executive.examples')}</div>
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
                {suggestions.map(s => (
                  <button key={s} onClick={() => send(s)} style={{ padding: '8px 14px', borderRadius: 20, background: 'rgba(var(--accent-rgb),0.08)', border: '1px solid rgba(var(--accent-rgb),0.25)', color: '#FBC02D', fontSize: 12, fontFamily: 'IBM Plex Sans', cursor: 'pointer' }}>
                    {s}
                  </button>
                ))}
              </div>
            </div>
          )}

          {messages.map((m, i) => (
            <div key={i} style={{ display: 'flex', justifyContent: m.role === 'user' ? 'flex-end' : 'flex-start', marginBottom: 16 }}>
              <div style={{ maxWidth: '85%', minWidth: 0, display: 'flex', gap: 10, flexDirection: m.role === 'user' ? 'row-reverse' : 'row' }}>
                <div style={{ width: 28, height: 28, flexShrink: 0, borderRadius: '50%', background: m.role === 'user' ? 'var(--border-input)' : 'linear-gradient(135deg, #FBC02D, #F57F17)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                  {m.role === 'user' ? <UserIcon size={14} color="var(--text-hover)" /> : <Sparkles size={14} color="var(--bg-app)" />}
                </div>
                <div style={{ minWidth: 0 }}>
                  <div style={{
                    padding: '10px 14px', borderRadius: 12,
                    background: m.role === 'user' ? 'var(--border-input)' : 'var(--border-subtle)',
                    color: '#F1F5F9', fontSize: 13.5, fontFamily: 'IBM Plex Sans', lineHeight: 1.5,
                    wordBreak: 'break-word',
                  }}>
                    {m.text}
                  </div>
                  {m.role === 'assistant' && (m.confidence !== undefined || m.explanation) && (
                    <div style={{ marginTop: 6, fontSize: 11, color: '#475569' }}>
                      {m.confidence !== undefined && (
                        <span style={{ marginRight: 10, color: '#64748B', fontFamily: 'IBM Plex Mono' }}>
                          {t('executive.confidence')}: {Math.round(m.confidence * 100)}%
                        </span>
                      )}
                      {m.explanation && <span title={t('executive.explanation')}>{m.explanation}</span>}
                    </div>
                  )}
                  <DataTable data={m.data} />
                </div>
              </div>
            </div>
          ))}

          {sending && (
            <div style={{ display: 'flex', gap: 10 }}>
              <div style={{ width: 28, height: 28, borderRadius: '50%', background: 'linear-gradient(135deg, #FBC02D, #F57F17)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                <Sparkles size={14} color="var(--bg-app)" />
              </div>
              <div style={{ padding: '10px 14px', borderRadius: 12, background: 'var(--border-subtle)', color: '#64748B', fontSize: 13 }}>...</div>
            </div>
          )}
        </div>

        <div style={{ display: 'flex', gap: 10 }}>
          <input
            value={input}
            onChange={e => setInput(e.target.value)}
            onKeyDown={e => { if (e.key === 'Enter') send(input); }}
            placeholder={t('executive.placeholder')}
            spellCheck autoCorrect="on" autoCapitalize="sentences"
            style={{ flex: 1, padding: '12px 16px', background: 'var(--bg-surface)', border: '1px solid var(--border-strong)', borderRadius: 10, color: 'var(--text-primary)', fontSize: 14, fontFamily: 'IBM Plex Sans', outline: 'none' }}
          />
          <button onClick={() => send(input)} disabled={sending || !input.trim()} style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '0 20px', background: 'linear-gradient(135deg, #FBC02D, #F57F17)', color: 'var(--bg-app)', border: 'none', borderRadius: 10, fontWeight: 700, fontFamily: 'Syne', fontSize: 14, cursor: 'pointer', opacity: sending || !input.trim() ? 0.6 : 1 }}>
            <Send size={15} /> {t('executive.send')}
          </button>
        </div>
      </div>
    </DashboardLayout>
  );
}
