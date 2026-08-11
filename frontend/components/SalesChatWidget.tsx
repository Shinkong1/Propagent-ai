import { useState, useRef, useEffect } from 'react';
import { MessageCircle, X, Send, Zap } from 'lucide-react';
import { contact } from '../lib/api';

type ChatMsg = { role: 'user' | 'assistant'; content: string };

const GREETING = "Hi! I'm PropAgent's AI sales assistant. Ask me anything about plans, features, or pricing.";

// Public, unauthenticated pre-sales chat widget for marketing pages (pricing,
// landing, etc). Talks to the same sales_agent used elsewhere in the app
// (grounded in real plan data, see agents/agents/sales_agent.py) via
// POST /contact/sales-chat -- not a generic chatbot, answers are pulled from
// the actual plan/feature data this app ships with.
export default function SalesChatWidget() {
  const [open, setOpen] = useState(false);
  const [messages, setMessages] = useState<ChatMsg[]>([{ role: 'assistant', content: GREETING }]);
  const [input, setInput] = useState('');
  const [sending, setSending] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (scrollRef.current) scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
  }, [messages, open]);

  const send = async () => {
    const text = input.trim();
    if (!text || sending) return;
    const history = messages;
    setMessages(prev => [...prev, { role: 'user', content: text }]);
    setInput('');
    setSending(true);
    try {
      const res = await contact.salesChat(text, history);
      setMessages(prev => [...prev, { role: 'assistant', content: res.data.response }]);
    } catch {
      setMessages(prev => [...prev, { role: 'assistant', content: "Sorry, I couldn't respond just now. Feel free to reach out through the Contact page instead." }]);
    } finally {
      setSending(false);
    }
  };

  return (
    <>
      {open && (
        <div style={{
          position: 'fixed', bottom: 92, right: 24, width: 340, maxWidth: 'calc(100vw - 32px)', height: 460,
          background: 'var(--bg-surface)', border: '1px solid var(--border-strong)', borderRadius: 16,
          boxShadow: '0 12px 40px rgba(0,0,0,0.35)', display: 'flex', flexDirection: 'column', zIndex: 2100, overflow: 'hidden',
        }}>
          <div style={{ padding: '14px 16px', borderBottom: '1px solid var(--border-strong)', display: 'flex', alignItems: 'center', gap: 10 }}>
            <div style={{ width: 30, height: 30, borderRadius: 8, background: 'linear-gradient(135deg, #FBC02D, #F57F17)', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
              <Zap size={15} color="var(--bg-app)" strokeWidth={2.5} />
            </div>
            <div style={{ flex: 1 }}>
              <div style={{ fontFamily: 'Syne', fontWeight: 700, fontSize: 13, color: 'var(--text-primary)' }}>PropAgent Sales</div>
              <div style={{ fontSize: 11, color: 'var(--text-muted)' }}>Usually replies instantly</div>
            </div>
            <button onClick={() => setOpen(false)} style={{ background: 'transparent', border: 'none', color: 'var(--text-muted)', cursor: 'pointer', padding: 4 }}>
              <X size={16} />
            </button>
          </div>

          <div ref={scrollRef} style={{ flex: 1, overflowY: 'auto', padding: '14px 16px', display: 'flex', flexDirection: 'column', gap: 10 }}>
            {messages.map((m, i) => (
              <div key={i} style={{
                alignSelf: m.role === 'user' ? 'flex-end' : 'flex-start',
                maxWidth: '85%', padding: '8px 12px', borderRadius: 12,
                background: m.role === 'user' ? 'rgba(251,192,45,0.15)' : 'var(--bg-app)',
                border: `1px solid ${m.role === 'user' ? 'rgba(251,192,45,0.3)' : 'var(--border-subtle)'}`,
                color: 'var(--text-primary)', fontSize: 13, fontFamily: 'IBM Plex Sans', lineHeight: 1.5, whiteSpace: 'pre-wrap',
              }}>
                {m.content}
              </div>
            ))}
            {sending && (
              <div style={{ alignSelf: 'flex-start', fontSize: 12, color: 'var(--text-muted)', fontFamily: 'IBM Plex Mono', padding: '4px 12px' }}>...</div>
            )}
          </div>

          <div style={{ padding: 12, borderTop: '1px solid var(--border-strong)', display: 'flex', gap: 8 }}>
            <input
              value={input}
              onChange={e => setInput(e.target.value)}
              onKeyDown={e => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); send(); } }}
              placeholder="Ask about plans, features..."
              style={{ flex: 1, padding: '9px 12px', background: 'var(--bg-app)', border: '1px solid var(--border-strong)', borderRadius: 8, color: 'var(--text-primary)', fontSize: 13, outline: 'none' }}
            />
            <button onClick={send} disabled={sending || !input.trim()} style={{
              width: 36, height: 36, borderRadius: 8, background: '#FBC02D', border: 'none',
              display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer', flexShrink: 0,
              opacity: sending || !input.trim() ? 0.5 : 1,
            }}>
              <Send size={15} color="#0B0F1A" />
            </button>
          </div>
        </div>
      )}

      <button
        onClick={() => setOpen(o => !o)}
        aria-label={open ? 'Close sales chat' : 'Open sales chat'}
        style={{
          position: 'fixed', bottom: 24, right: 24, width: 56, height: 56, borderRadius: '50%',
          background: 'linear-gradient(135deg, #FBC02D, #F57F17)', border: 'none', cursor: 'pointer',
          display: 'flex', alignItems: 'center', justifyContent: 'center', boxShadow: '0 6px 20px rgba(251,192,45,0.4)',
          zIndex: 2100,
        }}
      >
        {open ? <X size={22} color="#0B0F1A" /> : <MessageCircle size={22} color="#0B0F1A" />}
      </button>
    </>
  );
}
