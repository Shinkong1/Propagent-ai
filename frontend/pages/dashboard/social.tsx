import { useEffect, useState } from 'react';
import { useRouter } from 'next/router';
import DashboardLayout from '../../components/DashboardLayout';
import { Share2, Facebook, Instagram, Linkedin, Send, Unlink, CheckCircle2, XCircle, Image as ImageIcon, Link as LinkIcon } from 'lucide-react';
import { social as socialApi } from '../../lib/api';
import { useLanguage } from '../../lib/LanguageContext';
import toast from 'react-hot-toast';

// Social posting for a SUBSCRIBER's own properties/business (Facebook Page +
// Instagram Business Account via Meta's Graph API, LinkedIn Company Page via
// LinkedIn's Marketing API). This is distinct from /dashboard/marketing,
// which is PropAgent's OWN master-only tool for promoting PropAgent AI
// itself -- keep the two separate.
//
// X/Twitter is intentionally not offered here -- posting to X requires a
// paid API tier that hasn't been purchased. TODO: add it once that
// decision is made.

type Connection = {
  id: string;
  platform: 'facebook' | 'instagram' | 'linkedin';
  page_id: string;
  page_name: string | null;
  connected_at: string;
  is_active: boolean;
};

type Post = {
  id: string;
  connection_id: string;
  platform: string | null;
  message: string;
  image_url: string | null;
  status: string;
  platform_post_id: string | null;
  error_message: string | null;
  trigger: string;
  created_at: string;
};

const PLATFORM_META: Record<string, { label: string; icon: any; color: string }> = {
  facebook: { label: 'Facebook Page', icon: Facebook, color: '#1877F2' },
  instagram: { label: 'Instagram Business', icon: Instagram, color: '#E4405F' },
  linkedin: { label: 'LinkedIn Company Page', icon: Linkedin, color: '#0A66C2' },
};

export default function SocialMedia() {
  const router = useRouter();
  const { t } = useLanguage();
  const [configLoaded, setConfigLoaded] = useState(false);
  const [facebookEnabled, setFacebookEnabled] = useState(false);
  const [linkedinEnabled, setLinkedinEnabled] = useState(false);
  const [connections, setConnections] = useState<Connection[]>([]);
  const [posts, setPosts] = useState<Post[]>([]);
  const [loadingConnections, setLoadingConnections] = useState(true);
  const [loadingPosts, setLoadingPosts] = useState(true);
  const [message, setMessage] = useState('');
  const [imageUrl, setImageUrl] = useState('');
  const [link, setLink] = useState('');
  const [selected, setSelected] = useState<Record<string, boolean>>({});
  const [posting, setPosting] = useState(false);

  const loadConnections = () => {
    setLoadingConnections(true);
    socialApi.connections().then(r => setConnections(r.data || [])).catch(() => setConnections([])).finally(() => setLoadingConnections(false));
  };
  const loadPosts = () => {
    setLoadingPosts(true);
    socialApi.posts().then(r => setPosts(r.data || [])).catch(() => setPosts([])).finally(() => setLoadingPosts(false));
  };

  useEffect(() => {
    socialApi.config().then(r => {
      setFacebookEnabled(!!r.data?.facebook_enabled);
      setLinkedinEnabled(!!r.data?.linkedin_enabled);
    }).catch(() => {}).finally(() => setConfigLoaded(true));
    loadConnections();
    loadPosts();
  }, []);

  useEffect(() => {
    if (!router.isReady) return;
    const { connected, error } = router.query;
    if (connected) {
      toast.success(t('social.toast.connected', { platform: connected === 'facebook' ? 'Facebook & Instagram' : 'LinkedIn' }));
      loadConnections();
      router.replace('/dashboard/social', undefined, { shallow: true });
    } else if (error) {
      toast.error(t('social.toast.connectionFailed', { error: String(error).replace(/_/g, ' ') }));
      router.replace('/dashboard/social', undefined, { shallow: true });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [router.isReady, router.query]);

  const byPlatform = (platform: string) => connections.filter(c => c.platform === platform);

  const disconnect = async (id: string) => {
    try {
      await socialApi.disconnect(id);
      toast.success(t('social.toast.disconnected'));
      loadConnections();
    } catch (err: any) {
      toast.error(err?.response?.data?.detail || t('social.toast.disconnectFailed'));
    }
  };

  const toggleSelected = (id: string) => setSelected(s => ({ ...s, [id]: !s[id] }));

  const post = async () => {
    const connectionIds = Object.keys(selected).filter(id => selected[id]);
    if (connectionIds.length === 0) {
      toast.error(t('social.toast.selectAccount'));
      return;
    }
    if (!message.trim()) {
      toast.error(t('social.toast.writeMessage'));
      return;
    }
    setPosting(true);
    try {
      const res = await socialApi.compose({
        connection_ids: connectionIds,
        message,
        image_url: imageUrl.trim() || undefined,
        link: link.trim() || undefined,
      });
      const results: Post[] = res.data || [];
      const succeeded = results.filter(r => r.status === 'posted').length;
      const failed = results.filter(r => r.status === 'failed');
      if (succeeded > 0) toast.success(t('social.toast.postedToAccounts', { count: succeeded, s: succeeded === 1 ? '' : 's' }));
      failed.forEach(f => toast.error(`${PLATFORM_META[f.platform || '']?.label || f.platform}: ${f.error_message || t('social.status.failed')}`));
      setMessage(''); setImageUrl(''); setLink(''); setSelected({});
      loadPosts();
    } catch (err: any) {
      toast.error(err?.response?.data?.detail || t('social.toast.postFailed'));
    } finally {
      setPosting(false);
    }
  };

  const activeConnections = connections.filter(c => c.is_active);

  return (
    <DashboardLayout>
      <div style={{ maxWidth: 1100 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 6 }}>
          <Share2 size={24} color="#FBC02D" />
          <h1 style={{ fontFamily: 'Syne', fontWeight: 800, fontSize: 26, color: 'var(--text-primary)' }}>{t('social.title')}</h1>
        </div>
        <p style={{ color: 'var(--text-muted)', fontSize: 14, marginBottom: 24 }}>
          {t('social.subtitle')}
        </p>

        {/* Connection cards */}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: 14, marginBottom: 28 }}>
          {/* Facebook + Instagram share one Meta connection flow */}
          <div style={cardStyle}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 10 }}>
              <Facebook size={18} color="#1877F2" />
              <span style={{ fontWeight: 700, fontFamily: 'Syne', fontSize: 14, color: 'var(--text-primary)' }}>Facebook</span>
            </div>
            {byPlatform('facebook').length > 0 ? (
              byPlatform('facebook').map(c => (
                <ConnectedRow key={c.id} conn={c} onDisconnect={() => disconnect(c.id)} />
              ))
            ) : (
              <NotConnectedRow />
            )}
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginTop: 14, marginBottom: 10 }}>
              <Instagram size={18} color="#E4405F" />
              <span style={{ fontWeight: 700, fontFamily: 'Syne', fontSize: 14, color: 'var(--text-primary)' }}>Instagram</span>
            </div>
            {byPlatform('instagram').length > 0 ? (
              byPlatform('instagram').map(c => (
                <ConnectedRow key={c.id} conn={c} onDisconnect={() => disconnect(c.id)} />
              ))
            ) : (
              <NotConnectedRow />
            )}
            {configLoaded && !facebookEnabled ? (
              <p style={{ fontSize: 11, color: '#475569', marginTop: 10 }}>{t('social.notConfiguredMeta')}</p>
            ) : (
              <button onClick={() => { window.location.href = socialApi.facebookConnectUrl(); }} style={connectBtnStyle('#1877F2')}>
                {t('social.connectFacebookInstagram')}
              </button>
            )}
          </div>

          {/* LinkedIn */}
          <div style={cardStyle}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 10 }}>
              <Linkedin size={18} color="#0A66C2" />
              <span style={{ fontWeight: 700, fontFamily: 'Syne', fontSize: 14, color: 'var(--text-primary)' }}>LinkedIn</span>
            </div>
            {byPlatform('linkedin').length > 0 ? (
              byPlatform('linkedin').map(c => (
                <ConnectedRow key={c.id} conn={c} onDisconnect={() => disconnect(c.id)} />
              ))
            ) : (
              <NotConnectedRow />
            )}
            {configLoaded && !linkedinEnabled ? (
              <p style={{ fontSize: 11, color: '#475569', marginTop: 10 }}>{t('social.notConfiguredLinkedin')}</p>
            ) : (
              <button onClick={() => { window.location.href = socialApi.linkedinConnectUrl(); }} style={connectBtnStyle('#0A66C2')}>
                {t('social.connectLinkedin')}
              </button>
            )}
          </div>

          {/* X/Twitter — explicitly not built */}
          <div style={{ ...cardStyle, opacity: 0.6 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 10 }}>
              <XCircle size={18} color="#64748B" />
              <span style={{ fontWeight: 700, fontFamily: 'Syne', fontSize: 14, color: 'var(--text-primary)' }}>X / Twitter</span>
            </div>
            <p style={{ fontSize: 12, color: 'var(--text-muted)' }}>
              {t('social.xNotAvailable')}
            </p>
          </div>
        </div>

        {/* Compose box */}
        <div style={{ ...cardStyle, marginBottom: 28 }}>
          <h2 style={{ fontFamily: 'Syne', fontWeight: 700, fontSize: 16, color: 'var(--text-primary)', marginBottom: 14 }}>{t('social.composeTitle')}</h2>
          <textarea
            value={message}
            onChange={e => setMessage(e.target.value)}
            placeholder={t('social.composePlaceholder')}
            spellCheck autoCorrect="on" autoCapitalize="sentences"
            style={{ ...inputStyle, height: 100, resize: 'vertical', marginBottom: 12 } as any}
          />
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: 12, marginBottom: 14 }}>
            <div>
              <label style={labelStyle}><ImageIcon size={12} style={{ verticalAlign: -2 }} /> {t('social.imageUrlLabel')}</label>
              <input value={imageUrl} onChange={e => setImageUrl(e.target.value)} placeholder="https://..." style={inputStyle} />
            </div>
            <div>
              <label style={labelStyle}><LinkIcon size={12} style={{ verticalAlign: -2 }} /> {t('social.linkLabel')}</label>
              <input value={link} onChange={e => setLink(e.target.value)} placeholder="https://..." style={inputStyle} />
            </div>
          </div>

          {activeConnections.length === 0 ? (
            <p style={{ fontSize: 13, color: 'var(--text-muted)' }}>{t('social.connectFirst')}</p>
          ) : (
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 10, marginBottom: 16 }}>
              {activeConnections.map(c => {
                const meta = PLATFORM_META[c.platform];
                return (
                  <label key={c.id} style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '7px 12px', borderRadius: 8, border: `1px solid ${selected[c.id] ? meta.color : 'var(--border-strong)'}`, background: selected[c.id] ? `${meta.color}18` : 'transparent', cursor: 'pointer', fontSize: 12, color: 'var(--text-primary)' }}>
                    <input type="checkbox" checked={!!selected[c.id]} onChange={() => toggleSelected(c.id)} style={{ accentColor: meta.color }} />
                    <meta.icon size={13} color={meta.color} />
                    {c.page_name || meta.label}
                  </label>
                );
              })}
            </div>
          )}

          <button onClick={post} disabled={posting || activeConnections.length === 0} style={{
            display: 'flex', alignItems: 'center', gap: 8, padding: '10px 20px',
            background: 'linear-gradient(135deg, #FBC02D, #F57F17)', color: 'var(--bg-app)',
            fontWeight: 700, fontFamily: 'Syne', border: 'none', borderRadius: 8,
            cursor: posting || activeConnections.length === 0 ? 'not-allowed' : 'pointer',
            opacity: posting || activeConnections.length === 0 ? 0.6 : 1,
          }}>
            <Send size={15} /> {posting ? t('social.posting') : t('social.postNow')}
          </button>
        </div>

        {/* Post history */}
        <h2 style={{ fontFamily: 'Syne', fontWeight: 700, fontSize: 16, color: 'var(--text-primary)', marginBottom: 12 }}>{t('social.postHistory')}</h2>
        <div style={{ background: 'var(--bg-surface)', border: '1px solid var(--border-strong)', borderRadius: 12, overflow: 'hidden' }}>
          <div style={{ overflowX: 'auto' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', minWidth: 700 }}>
              <thead>
                <tr style={{ borderBottom: '1px solid var(--border-strong)' }}>
                  {[t('social.col.platform'), t('social.col.message'), t('social.col.status'), t('social.col.trigger'), t('social.col.date')].map(h => (
                    <th key={h} style={{ padding: '10px 14px', textAlign: 'left', fontSize: 10, fontFamily: 'IBM Plex Mono', color: 'var(--text-muted)', letterSpacing: '0.5px', whiteSpace: 'nowrap' }}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {loadingConnections || loadingPosts ? (
                  <tr><td colSpan={5} style={{ textAlign: 'center', padding: '30px', color: '#475569' }}>{t('social.loading')}</td></tr>
                ) : posts.length === 0 ? (
                  <tr><td colSpan={5} style={{ textAlign: 'center', padding: '50px', color: '#475569' }}>{t('social.noPosts')}</td></tr>
                ) : posts.map(p => {
                  const meta = PLATFORM_META[p.platform || ''] || { label: p.platform, icon: Share2, color: 'var(--text-muted)' };
                  return (
                    <tr key={p.id} style={{ borderBottom: '1px solid var(--border-subtle)' }} title={p.error_message || ''}>
                      <td style={{ padding: '10px 14px', fontSize: 12, color: 'var(--text-primary)' }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                          <meta.icon size={13} color={meta.color} /> {meta.label}
                        </div>
                      </td>
                      <td style={{ padding: '10px 14px', fontSize: 12, color: 'var(--text-secondary)', maxWidth: 320, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{p.message}</td>
                      <td style={{ padding: '10px 14px' }}>
                        <span style={{ display: 'inline-flex', alignItems: 'center', gap: 4, fontSize: 10, padding: '3px 8px', borderRadius: 4, background: p.status === 'posted' ? '#10B98120' : '#EF444420', color: p.status === 'posted' ? '#10B981' : '#EF4444', fontFamily: 'IBM Plex Mono' }}>
                          {p.status === 'posted' ? <CheckCircle2 size={11} /> : <XCircle size={11} />}
                          {p.status === 'posted' ? t('social.status.posted') : t('social.status.failed')}
                        </span>
                      </td>
                      <td style={{ padding: '10px 14px', fontSize: 11, color: 'var(--text-muted)' }}>{p.trigger === 'auto_listing' ? t('social.triggerAuto') : t('social.triggerManual')}</td>
                      <td style={{ padding: '10px 14px', fontSize: 11, fontFamily: 'IBM Plex Mono', color: 'var(--text-muted)', whiteSpace: 'nowrap' }}>{new Date(p.created_at).toLocaleString()}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
        <p style={{ marginTop: 20, fontSize: 11, color: '#475569' }}>
          {t('social.footerNote')}
        </p>
      </div>
    </DashboardLayout>
  );
}

function ConnectedRow({ conn, onDisconnect }: { conn: Connection; onDisconnect: () => void }) {
  const { t } = useLanguage();
  return (
    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 8, padding: '8px 10px', borderRadius: 8, background: 'rgba(16,185,129,0.08)', border: '1px solid rgba(16,185,129,0.25)', marginBottom: 6 }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 6, minWidth: 0 }}>
        <CheckCircle2 size={13} color="#10B981" />
        <span style={{ fontSize: 12, color: 'var(--text-primary)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{conn.page_name || conn.page_id}</span>
      </div>
      <button onClick={onDisconnect} title={t('social.disconnect')} style={{ background: 'transparent', border: 'none', color: 'var(--text-muted)', cursor: 'pointer', display: 'flex', padding: 2 }}>
        <Unlink size={13} />
      </button>
    </div>
  );
}

function NotConnectedRow() {
  const { t } = useLanguage();
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '8px 10px', borderRadius: 8, background: 'var(--bg-app)', border: '1px solid var(--border-strong)', marginBottom: 6 }}>
      <XCircle size={13} color="#64748B" />
      <span style={{ fontSize: 12, color: 'var(--text-muted)' }}>{t('social.notConnected')}</span>
    </div>
  );
}

const cardStyle: React.CSSProperties = { background: 'var(--bg-surface)', border: '1px solid var(--border-strong)', borderRadius: 12, padding: 18 };
const labelStyle: React.CSSProperties = { display: 'block', marginBottom: 5, fontSize: 12, fontFamily: 'IBM Plex Mono', color: 'var(--text-secondary)' };
const inputStyle: React.CSSProperties = { width: '100%', padding: '9px 12px', background: 'var(--bg-app)', border: '1px solid var(--border-input)', borderRadius: 8, color: 'var(--text-primary)', fontSize: 13, fontFamily: 'IBM Plex Sans', outline: 'none', boxSizing: 'border-box' };
const connectBtnStyle = (color: string): React.CSSProperties => ({
  width: '100%', marginTop: 10, padding: '9px 14px', borderRadius: 8, border: `1px solid ${color}`,
  background: 'transparent', color, fontSize: 13, fontWeight: 600, cursor: 'pointer',
});
