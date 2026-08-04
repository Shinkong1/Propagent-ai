import { useEffect, useState } from 'react';
import { useRouter } from 'next/router';
import DashboardLayout from '../../components/DashboardLayout';
import { Settings as SettingsIcon, Check, Sun, Moon, Building2, Bell, Lock, Globe, DollarSign, HelpCircle, Users, Mail, UserPlus } from 'lucide-react';
import { useLanguage } from '../../lib/LanguageContext';
import { useTheme } from '../../lib/ThemeContext';
import { useCurrency } from '../../lib/CurrencyContext';
import { useTutorial } from '../../lib/TutorialContext';
import { CURRENCIES } from '../../lib/currency';
import { LANGUAGES } from '../../lib/translations';
import { getUser, setUser } from '../../lib/auth';
import { auth as authApi, team as teamApi, mfa as mfaApi } from '../../lib/api';
import toast from 'react-hot-toast';

const TIMEZONES = [
  'America/New_York', 'America/Chicago', 'America/Denver', 'America/Los_Angeles',
  'America/Anchorage', 'Pacific/Honolulu', 'Europe/London', 'Europe/Paris',
  'Europe/Berlin', 'Asia/Shanghai', 'Asia/Seoul', 'Asia/Tokyo', 'Australia/Sydney',
];

const TABS = ['appearance', 'language', 'currency', 'organization', 'team', 'notifications', 'security'] as const;
type Tab = typeof TABS[number];
const TAB_ICON: Record<Tab, any> = { appearance: Sun, language: Globe, currency: DollarSign, organization: Building2, team: Users, notifications: Bell, security: Lock };

interface TeamMember {
  id: string;
  email: string;
  first_name: string;
  last_name: string;
  role: 'owner' | 'manager' | 'staff';
  is_active: boolean;
}

export default function SettingsPage() {
  const { t, language, setLanguage } = useLanguage();
  const { theme, setTheme } = useTheme();
  const { currency, setCurrency } = useCurrency();
  const { openTour } = useTutorial();
  const router = useRouter();
  const [tab, setTab] = useState<Tab>('appearance');

  const [orgName, setOrgName] = useState('');
  const [timezone, setTimezone] = useState('America/New_York');
  const [notifyEmail, setNotifyEmail] = useState(true);
  const [notifySms, setNotifySms] = useState(true);
  const [savingOrg, setSavingOrg] = useState(false);
  const [savingNotify, setSavingNotify] = useState(false);

  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [savingPassword, setSavingPassword] = useState(false);

  const [mfaEnabled, setMfaEnabled] = useState(false);
  const [mfaSetup, setMfaSetup] = useState<{ secret: string; qr_code_base64: string } | null>(null);
  const [mfaEnrollCode, setMfaEnrollCode] = useState('');
  const [confirmingMfa, setConfirmingMfa] = useState(false);
  const [showMfaDisable, setShowMfaDisable] = useState(false);
  const [disablePassword, setDisablePassword] = useState('');
  const [disableCode, setDisableCode] = useState('');
  const [disablingMfa, setDisablingMfa] = useState(false);

  const loadMfaStatus = async () => {
    try {
      const res = await mfaApi.status();
      setMfaEnabled(res.data.mfa_enabled);
    } catch {
      // silent — status just gates which MFA UI to show
    }
  };

  const [members, setMembers] = useState<TeamMember[]>([]);
  const [loadingMembers, setLoadingMembers] = useState(false);
  const [inviteFirstName, setInviteFirstName] = useState('');
  const [inviteLastName, setInviteLastName] = useState('');
  const [inviteEmail, setInviteEmail] = useState('');
  const [inviteRole, setInviteRole] = useState<'manager' | 'staff'>('staff');
  const [inviting, setInviting] = useState(false);
  const [tempPassword, setTempPassword] = useState<{ email: string; password: string } | null>(null);

  const currentUserId = getUser()?.user_id;
  const myRole: 'owner' | 'manager' | 'staff' = getUser()?.role || 'owner';
  const canInviteManager = myRole === 'owner';
  const canInvite = myRole === 'owner' || myRole === 'manager';
  const canChangeRole = myRole === 'owner';
  const canDeactivate = myRole === 'owner' || myRole === 'manager';

  const loadMembers = async () => {
    setLoadingMembers(true);
    try {
      const res = await teamApi.list();
      setMembers(res.data);
    } catch {
      // silent — member list is non-critical, tab still usable for inviting
    } finally {
      setLoadingMembers(false);
    }
  };

  useEffect(() => {
    if (tab === 'team') loadMembers();
    if (tab === 'security') loadMfaStatus();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tab]);

  const startMfaSetup = async () => {
    try {
      const res = await mfaApi.setup();
      setMfaSetup(res.data);
    } catch (err: any) {
      toast.error(err?.response?.data?.detail || t('settings.mfaInvalidCode'));
    }
  };

  const cancelMfaSetup = () => {
    setMfaSetup(null);
    setMfaEnrollCode('');
  };

  const confirmMfaSetup = async () => {
    setConfirmingMfa(true);
    try {
      await mfaApi.verify(mfaEnrollCode);
      toast.success(t('settings.mfaEnabledSuccess'));
      setMfaEnabled(true);
      setMfaSetup(null);
      setMfaEnrollCode('');
    } catch (err: any) {
      toast.error(err?.response?.data?.detail || t('settings.mfaInvalidCode'));
    } finally {
      setConfirmingMfa(false);
    }
  };

  const submitDisableMfa = async () => {
    setDisablingMfa(true);
    try {
      await mfaApi.disable(disablePassword, disableCode);
      toast.success(t('settings.mfaDisabledSuccess'));
      setMfaEnabled(false);
      setShowMfaDisable(false);
      setDisablePassword(''); setDisableCode('');
    } catch (err: any) {
      toast.error(err?.response?.data?.detail || t('settings.mfaInvalidCode'));
    } finally {
      setDisablingMfa(false);
    }
  };

  const sendInvite = async () => {
    if (!inviteEmail || !inviteFirstName || !inviteLastName) {
      toast.error(t('team.inviteFailed'));
      return;
    }
    setInviting(true);
    setTempPassword(null);
    try {
      const res = await teamApi.invite({
        email: inviteEmail, first_name: inviteFirstName, last_name: inviteLastName, role: inviteRole,
      });
      toast.success(t('team.inviteSent'));
      if (res.data.temporary_password) {
        setTempPassword({ email: inviteEmail, password: res.data.temporary_password });
      }
      setInviteFirstName(''); setInviteLastName(''); setInviteEmail(''); setInviteRole('staff');
      loadMembers();
    } catch (err: any) {
      toast.error(err?.response?.data?.detail || t('team.inviteFailed'));
    } finally {
      setInviting(false);
    }
  };

  const changeMemberRole = async (userId: string, role: string) => {
    try {
      await teamApi.changeRole(userId, role);
      loadMembers();
    } catch (err: any) {
      toast.error(err?.response?.data?.detail || t('team.inviteFailed'));
    }
  };

  const toggleMemberActive = async (userId: string) => {
    try {
      await teamApi.toggleActive(userId);
      loadMembers();
    } catch (err: any) {
      toast.error(err?.response?.data?.detail || t('team.inviteFailed'));
    }
  };

  useEffect(() => {
    const t = router.query.tab;
    if (typeof t === 'string' && (TABS as readonly string[]).includes(t)) setTab(t as Tab);
  }, [router.query.tab]);

  useEffect(() => {
    const user = getUser();
    setOrgName(user?.organization_name || '');
    setTimezone(user?.timezone || 'America/New_York');
    setNotifyEmail(user?.notify_email_enabled ?? true);
    setNotifySms(user?.notify_sms_enabled ?? true);
  }, []);

  const goTab = (next: Tab) => {
    setTab(next);
    router.push({ pathname: '/dashboard/settings', query: { tab: next } }, undefined, { shallow: true });
  };

  const saveOrganization = async () => {
    setSavingOrg(true);
    try {
      await authApi.updateOrganization({ name: orgName, timezone });
      const user = getUser();
      if (user) setUser({ ...user, organization_name: orgName, timezone });
      toast.success(t('settings.saved'));
    } catch (err: any) {
      toast.error(err?.response?.data?.detail || t('settings.saveFailed'));
    } finally {
      setSavingOrg(false);
    }
  };

  const saveNotifications = async (email: boolean, sms: boolean) => {
    setSavingNotify(true);
    try {
      await authApi.updateOrganization({ notify_email_enabled: email, notify_sms_enabled: sms });
      const user = getUser();
      if (user) setUser({ ...user, notify_email_enabled: email, notify_sms_enabled: sms });
      toast.success(t('settings.saved'));
    } catch (err: any) {
      toast.error(err?.response?.data?.detail || t('settings.saveFailed'));
    } finally {
      setSavingNotify(false);
    }
  };

  const changePassword = async () => {
    if (!currentPassword || !newPassword) {
      toast.error(t('settings.passwordRequiredError'));
      return;
    }
    if (newPassword !== confirmPassword) {
      toast.error(t('settings.passwordMismatchError'));
      return;
    }
    setSavingPassword(true);
    try {
      await authApi.changePassword(currentPassword, newPassword);
      toast.success(t('settings.passwordChanged'));
      setCurrentPassword(''); setNewPassword(''); setConfirmPassword('');
    } catch (err: any) {
      toast.error(err?.response?.data?.detail || t('settings.passwordChangeFailed'));
    } finally {
      setSavingPassword(false);
    }
  };

  return (
    <DashboardLayout>
      <div style={{ maxWidth: 820 }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 6, flexWrap: 'wrap', gap: 12 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
            <SettingsIcon size={26} color="#FBC02D" />
            <h1 style={{ fontFamily: 'Syne', fontWeight: 800, fontSize: 28, color: 'var(--text-primary)' }}>{t('settings.title')}</h1>
          </div>
          <button onClick={openTour} style={{
            display: 'flex', alignItems: 'center', gap: 8, padding: '9px 16px',
            background: 'var(--bg-surface)', border: '1px solid var(--border-strong)', borderRadius: 8,
            color: 'var(--text-secondary)', fontSize: 13, fontWeight: 600, fontFamily: 'Syne', cursor: 'pointer',
          }}>
            <HelpCircle size={14} /> {t('tour.replay')}
          </button>
        </div>
        <p style={{ color: '#64748B', fontSize: 14, marginBottom: 24 }}>{t('settings.subtitle')}</p>

        <div style={{ display: 'flex', gap: 6, marginBottom: 28, borderBottom: '1px solid var(--border-strong)', flexWrap: 'wrap' }}>
          {TABS.map(tb => {
            const Icon = TAB_ICON[tb];
            const active = tab === tb;
            return (
              <button key={tb} onClick={() => goTab(tb)} style={{
                display: 'flex', alignItems: 'center', gap: 7, padding: '10px 16px',
                background: 'transparent', border: 'none', cursor: 'pointer',
                color: active ? '#FBC02D' : 'var(--text-secondary)',
                borderBottom: active ? '2px solid #FBC02D' : '2px solid transparent',
                fontFamily: 'Syne', fontWeight: 600, fontSize: 13, marginBottom: -1,
              }}>
                <Icon size={14} /> {t(`settings.tab.${tb}`)}
              </button>
            );
          })}
        </div>

        {tab === 'appearance' && (
          <div>
            <h2 style={{ fontFamily: 'Syne', fontWeight: 700, fontSize: 16, color: 'var(--text-primary)', marginBottom: 4 }}>{t('settings.appearanceTitle')}</h2>
            <p style={{ fontSize: 12, color: '#64748B', marginBottom: 18 }}>{t('settings.appearanceSubtitle')}</p>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: 14, maxWidth: 480 }}>
              {(['dark', 'light'] as const).map(mode => {
                const isActive = theme === mode;
                const Icon = mode === 'dark' ? Moon : Sun;
                return (
                  <div key={mode} onClick={() => setTheme(mode)} style={{
                    display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                    padding: '18px', borderRadius: 12, cursor: 'pointer',
                    background: isActive ? 'rgba(var(--accent-rgb),0.08)' : 'var(--bg-surface)',
                    border: `1px solid ${isActive ? '#FBC02D' : 'var(--border-strong)'}`,
                  }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                      <Icon size={20} color={isActive ? '#FBC02D' : 'var(--text-secondary)'} />
                      <span style={{ fontFamily: 'Syne', fontWeight: 700, fontSize: 14, color: 'var(--text-primary)' }}>{t(`settings.theme.${mode}`)}</span>
                    </div>
                    {isActive && <Check size={16} color="#FBC02D" />}
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {tab === 'language' && (
          <div>
            <h2 style={{ fontFamily: 'Syne', fontWeight: 700, fontSize: 16, color: 'var(--text-primary)', marginBottom: 4 }}>{t('language.title')}</h2>
            <p style={{ fontSize: 12, color: '#64748B', marginBottom: 18 }}>{t('language.subtitle')}</p>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: 14, marginBottom: 20 }}>
              {LANGUAGES.map(lang => {
                const isActive = language === lang.code;
                return (
                  <div
                    key={lang.code}
                    onClick={() => setLanguage(lang.code)}
                    style={{
                      display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                      padding: '16px 18px', borderRadius: 12, cursor: 'pointer',
                      background: isActive ? 'rgba(var(--accent-rgb),0.08)' : 'var(--bg-surface)',
                      border: `1px solid ${isActive ? '#FBC02D' : 'var(--border-strong)'}`,
                      transition: 'border-color 0.15s',
                    }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 14 }}>
                      <span style={{ fontSize: 26 }}>{lang.flag}</span>
                      <div>
                        <div style={{ fontFamily: 'Syne', fontWeight: 700, fontSize: 15, color: 'var(--text-primary)' }}>{lang.nativeName}</div>
                        <div style={{ fontSize: 12, color: '#64748B' }}>{lang.name}</div>
                      </div>
                    </div>
                    {isActive && (
                      <div style={{ display: 'flex', alignItems: 'center', gap: 4, color: '#FBC02D', fontSize: 11, fontFamily: 'IBM Plex Mono', fontWeight: 600 }}>
                        <Check size={14} /> {t('language.current')}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {tab === 'currency' && (
          <div>
            <h2 style={{ fontFamily: 'Syne', fontWeight: 700, fontSize: 16, color: 'var(--text-primary)', marginBottom: 4 }}>{t('settings.currencyTitle')}</h2>
            <p style={{ fontSize: 12, color: '#64748B', marginBottom: 18 }}>{t('settings.currencySubtitle')}</p>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: 14, maxWidth: 560 }}>
              {CURRENCIES.map(cur => {
                const isActive = currency === cur.code;
                return (
                  <div
                    key={cur.code}
                    onClick={() => setCurrency(cur.code)}
                    style={{
                      display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                      padding: '16px 18px', borderRadius: 12, cursor: 'pointer',
                      background: isActive ? 'rgba(var(--accent-rgb),0.08)' : 'var(--bg-surface)',
                      border: `1px solid ${isActive ? '#FBC02D' : 'var(--border-strong)'}`,
                      transition: 'border-color 0.15s',
                    }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 14 }}>
                      <span style={{ fontSize: 20, fontFamily: 'IBM Plex Mono', fontWeight: 700, color: isActive ? '#FBC02D' : 'var(--text-secondary)', width: 32 }}>{cur.symbol}</span>
                      <div>
                        <div style={{ fontFamily: 'Syne', fontWeight: 700, fontSize: 15, color: 'var(--text-primary)' }}>{cur.code}</div>
                        <div style={{ fontSize: 12, color: '#64748B' }}>{cur.name}</div>
                      </div>
                    </div>
                    {isActive && <Check size={16} color="#FBC02D" />}
                  </div>
                );
              })}
            </div>
            <p style={{ fontSize: 11, color: '#475569', marginTop: 16 }}>{t('settings.currencyNote')}</p>
          </div>
        )}

        {tab === 'organization' && (
          <div style={{ maxWidth: 420 }}>
            <h2 style={{ fontFamily: 'Syne', fontWeight: 700, fontSize: 16, color: 'var(--text-primary)', marginBottom: 4 }}>{t('settings.organizationTitle')}</h2>
            <p style={{ fontSize: 12, color: '#64748B', marginBottom: 18 }}>{t('settings.organizationSubtitle')}</p>
            <label style={lbl}>{t('settings.organizationName')}</label>
            <input value={orgName} onChange={e => setOrgName(e.target.value)} spellCheck autoCorrect="on" autoCapitalize="words" style={inp} />
            <label style={{ ...lbl, marginTop: 14 }}>{t('settings.timezone')}</label>
            <select value={timezone} onChange={e => setTimezone(e.target.value)} style={inp as any}>
              {TIMEZONES.map(tz => <option key={tz} value={tz}>{tz.replace('_', ' ')}</option>)}
            </select>
            <button onClick={saveOrganization} disabled={savingOrg} style={{ ...btn, marginTop: 18 }}>
              {savingOrg ? t('settings.saving') : t('settings.saveChanges')}
            </button>
          </div>
        )}

        {tab === 'team' && (
          <div style={{ maxWidth: 640 }}>
            <h2 style={{ fontFamily: 'Syne', fontWeight: 700, fontSize: 16, color: 'var(--text-primary)', marginBottom: 4 }}>{t('team.title')}</h2>
            <p style={{ fontSize: 12, color: '#64748B', marginBottom: 18 }}>{t('team.subtitle')}</p>

            {canInvite && (
              <div style={{ background: 'var(--bg-surface)', border: '1px solid var(--border-strong)', borderRadius: 12, padding: 20, marginBottom: 24 }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 14 }}>
                  <UserPlus size={15} color="#FBC02D" />
                  <h3 style={{ fontFamily: 'Syne', fontWeight: 700, fontSize: 14, color: 'var(--text-primary)' }}>{t('team.inviteTitle')}</h3>
                </div>
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: 10 }}>
                  <div>
                    <label style={lbl}>{t('team.firstName')}</label>
                    <input value={inviteFirstName} onChange={e => setInviteFirstName(e.target.value)} spellCheck autoCorrect="on" autoCapitalize="words" style={inp} />
                  </div>
                  <div>
                    <label style={lbl}>{t('team.lastName')}</label>
                    <input value={inviteLastName} onChange={e => setInviteLastName(e.target.value)} spellCheck autoCorrect="on" autoCapitalize="words" style={inp} />
                  </div>
                </div>
                <label style={{ ...lbl, marginTop: 12 }}>{t('team.email')}</label>
                <input type="email" value={inviteEmail} onChange={e => setInviteEmail(e.target.value)} style={inp} />
                <label style={{ ...lbl, marginTop: 12 }}>{t('team.role')}</label>
                <select value={inviteRole} onChange={e => setInviteRole(e.target.value as any)} style={inp as any}>
                  <option value="staff">{t('team.roleStaff')}</option>
                  {canInviteManager && <option value="manager">{t('team.roleManager')}</option>}
                </select>
                <button onClick={sendInvite} disabled={inviting} style={{ ...btn, marginTop: 16 }}>
                  {inviting ? t('team.sending') : t('team.sendInvite')}
                </button>

                {tempPassword && (
                  <div style={{ marginTop: 14, padding: 12, borderRadius: 8, background: 'rgba(var(--accent-rgb),0.08)', border: '1px solid #FBC02D' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 12, color: 'var(--text-secondary)', marginBottom: 6 }}>
                      <Mail size={12} /> {t('team.inviteLoggedOnly')}
                    </div>
                    <div style={{ fontFamily: 'IBM Plex Mono', fontSize: 13, color: 'var(--text-primary)' }}>
                      {tempPassword.email} — <strong>{tempPassword.password}</strong>
                    </div>
                  </div>
                )}
              </div>
            )}

            <h3 style={{ fontFamily: 'Syne', fontWeight: 700, fontSize: 14, color: 'var(--text-primary)', marginBottom: 12 }}>{t('team.membersTitle')}</h3>
            <div style={{ border: '1px solid var(--border-strong)', borderRadius: 12, overflow: 'hidden' }}>
              {members.map((m, i) => (
                <div key={m.id} style={{
                  display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '12px 16px',
                  borderTop: i === 0 ? 'none' : '1px solid var(--border-subtle)',
                }}>
                  <div>
                    <div style={{ fontSize: 13, fontWeight: 600, color: 'var(--text-primary)', fontFamily: 'IBM Plex Sans' }}>
                      {m.first_name} {m.last_name} {m.id === currentUserId && <span style={{ color: '#64748B', fontWeight: 400 }}>({t('team.you')})</span>}
                    </div>
                    <div style={{ fontSize: 12, color: '#64748B' }}>{m.email}</div>
                  </div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                    {canChangeRole && m.role !== 'owner' && m.id !== currentUserId ? (
                      <select value={m.role} onChange={e => changeMemberRole(m.id, e.target.value)} style={{ ...inp, width: 'auto', padding: '6px 10px', fontSize: 12 } as any}>
                        <option value="manager">{t('team.roleManager')}</option>
                        <option value="staff">{t('team.roleStaff')}</option>
                      </select>
                    ) : (
                      <span style={{ fontSize: 12, color: 'var(--text-secondary)', fontFamily: 'IBM Plex Mono' }}>
                        {m.role === 'owner' ? t('team.roleOwner') : m.role === 'manager' ? t('team.roleManager') : t('team.roleStaff')}
                      </span>
                    )}
                    <span style={{
                      fontSize: 11, padding: '3px 8px', borderRadius: 6,
                      background: m.is_active ? 'rgba(34,197,94,0.12)' : 'rgba(148,163,184,0.15)',
                      color: m.is_active ? '#22C55E' : '#94A3B8', fontFamily: 'IBM Plex Mono',
                    }}>
                      {m.is_active ? t('team.active') : t('team.inactive')}
                    </span>
                    {canDeactivate && m.role !== 'owner' && m.id !== currentUserId && (
                      <button onClick={() => toggleMemberActive(m.id)} style={{
                        fontSize: 11, padding: '5px 10px', borderRadius: 6, cursor: 'pointer',
                        background: 'transparent', border: '1px solid var(--border-strong)', color: 'var(--text-secondary)',
                      }}>
                        {m.is_active ? t('team.deactivate') : t('team.activate')}
                      </button>
                    )}
                  </div>
                </div>
              ))}
              {!loadingMembers && members.length === 0 && (
                <div style={{ padding: 20, textAlign: 'center', fontSize: 13, color: '#64748B' }}>—</div>
              )}
            </div>
            <p style={{ fontSize: 11, color: '#475569', marginTop: 16 }}>{t('team.permissionNote')}</p>
          </div>
        )}

        {tab === 'notifications' && (
          <div style={{ maxWidth: 480 }}>
            <h2 style={{ fontFamily: 'Syne', fontWeight: 700, fontSize: 16, color: 'var(--text-primary)', marginBottom: 4 }}>{t('settings.notificationsTitle')}</h2>
            <p style={{ fontSize: 12, color: '#64748B', marginBottom: 18 }}>{t('settings.notificationsSubtitle')}</p>

            <ToggleRow
              label={t('settings.notifyEmail')}
              description={t('settings.notifyEmailDesc')}
              checked={notifyEmail}
              disabled={savingNotify}
              onChange={(v) => { setNotifyEmail(v); saveNotifications(v, notifySms); }}
            />
            <ToggleRow
              label={t('settings.notifySms')}
              description={t('settings.notifySmsDesc')}
              checked={notifySms}
              disabled={savingNotify}
              onChange={(v) => { setNotifySms(v); saveNotifications(notifyEmail, v); }}
            />
            <p style={{ fontSize: 11, color: '#475569', marginTop: 16 }}>{t('settings.notificationsNote')}</p>
          </div>
        )}

        {tab === 'security' && (
          <div style={{ maxWidth: 420 }}>
            <h2 style={{ fontFamily: 'Syne', fontWeight: 700, fontSize: 16, color: 'var(--text-primary)', marginBottom: 4 }}>{t('settings.securityTitle')}</h2>
            <p style={{ fontSize: 12, color: '#64748B', marginBottom: 18 }}>{t('settings.securitySubtitle')}</p>
            <label style={lbl}>{t('settings.currentPassword')}</label>
            <input type="password" value={currentPassword} onChange={e => setCurrentPassword(e.target.value)} style={inp} />
            <label style={{ ...lbl, marginTop: 14 }}>{t('settings.newPassword')}</label>
            <input type="password" value={newPassword} onChange={e => setNewPassword(e.target.value)} style={inp} />
            <label style={{ ...lbl, marginTop: 14 }}>{t('settings.confirmPassword')}</label>
            <input type="password" value={confirmPassword} onChange={e => setConfirmPassword(e.target.value)} style={inp} />
            <button onClick={changePassword} disabled={savingPassword} style={{ ...btn, marginTop: 18 }}>
              {savingPassword ? t('settings.saving') : t('settings.changePassword')}
            </button>

            <div style={{ marginTop: 32, paddingTop: 24, borderTop: '1px solid var(--border-strong)' }}>
              <h2 style={{ fontFamily: 'Syne', fontWeight: 700, fontSize: 16, color: 'var(--text-primary)', marginBottom: 4 }}>{t('settings.mfaTitle')}</h2>
              <p style={{ fontSize: 12, color: '#64748B', marginBottom: 18 }}>{t('settings.mfaSubtitle')}</p>

              {mfaSetup ? (
                <div>
                  <p style={{ fontSize: 12, color: 'var(--text-secondary)', marginBottom: 12 }}>{t('settings.mfaScanQr')}</p>
                  <img src={mfaSetup.qr_code_base64} alt="MFA QR code" style={{ width: 180, height: 180, borderRadius: 8, background: '#fff', padding: 8 }} />
                  <label style={{ ...lbl, marginTop: 12 }}>{t('settings.mfaManualKey')}</label>
                  <div style={{ ...inp, fontFamily: 'IBM Plex Mono', fontSize: 12, userSelect: 'all' } as any}>{mfaSetup.secret}</div>
                  <label style={{ ...lbl, marginTop: 14 }}>{t('settings.mfaEnterCode')}</label>
                  <input
                    type="text" value={mfaEnrollCode} maxLength={6} inputMode="numeric"
                    onChange={e => setMfaEnrollCode(e.target.value.replace(/\D/g, ''))}
                    style={{ ...inp, letterSpacing: 4, fontFamily: 'IBM Plex Mono' }}
                  />
                  <div style={{ display: 'flex', gap: 10, marginTop: 16 }}>
                    <button onClick={confirmMfaSetup} disabled={confirmingMfa || mfaEnrollCode.length !== 6} style={btn}>
                      {confirmingMfa ? t('settings.saving') : t('settings.mfaConfirm')}
                    </button>
                    <button onClick={cancelMfaSetup} style={{ ...btn, background: 'var(--bg-app)', color: 'var(--text-secondary)', border: '1px solid var(--border-strong)' }}>
                      {t('settings.mfaCancel')}
                    </button>
                  </div>
                </div>
              ) : mfaEnabled ? (
                <div>
                  <p style={{ fontSize: 13, color: '#22C55E', marginBottom: 14 }}>{t('settings.mfaEnabled')}</p>
                  {showMfaDisable ? (
                    <div style={{ maxWidth: 320 }}>
                      <h3 style={{ fontFamily: 'Syne', fontWeight: 700, fontSize: 14, color: 'var(--text-primary)', marginBottom: 12 }}>{t('settings.mfaDisableTitle')}</h3>
                      <label style={lbl}>{t('settings.mfaDisablePassword')}</label>
                      <input type="password" value={disablePassword} onChange={e => setDisablePassword(e.target.value)} style={inp} />
                      <label style={{ ...lbl, marginTop: 12 }}>{t('settings.mfaDisableCode')}</label>
                      <input
                        type="text" value={disableCode} maxLength={6} inputMode="numeric"
                        onChange={e => setDisableCode(e.target.value.replace(/\D/g, ''))}
                        style={{ ...inp, letterSpacing: 4, fontFamily: 'IBM Plex Mono' }}
                      />
                      <div style={{ display: 'flex', gap: 10, marginTop: 14 }}>
                        <button onClick={submitDisableMfa} disabled={disablingMfa || !disablePassword || disableCode.length !== 6} style={{ ...btn, background: '#EF4444', color: '#fff' }}>
                          {disablingMfa ? t('settings.saving') : t('settings.mfaDisableButton')}
                        </button>
                        <button onClick={() => setShowMfaDisable(false)} style={{ ...btn, background: 'var(--bg-app)', color: 'var(--text-secondary)', border: '1px solid var(--border-strong)' }}>
                          {t('settings.mfaCancel')}
                        </button>
                      </div>
                    </div>
                  ) : (
                    <button onClick={() => setShowMfaDisable(true)} style={{ ...btn, background: 'var(--bg-app)', color: 'var(--text-secondary)', border: '1px solid var(--border-strong)' }}>
                      {t('settings.mfaDisableButton')}
                    </button>
                  )}
                </div>
              ) : (
                <button onClick={startMfaSetup} style={btn}>{t('settings.mfaSetupButton')}</button>
              )}
            </div>
          </div>
        )}
      </div>
    </DashboardLayout>
  );
}

function ToggleRow({ label, description, checked, disabled, onChange }: { label: string; description: string; checked: boolean; disabled: boolean; onChange: (v: boolean) => void }) {
  return (
    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '14px 0', borderBottom: '1px solid var(--border-subtle)' }}>
      <div style={{ paddingRight: 16 }}>
        <div style={{ fontSize: 13, fontWeight: 600, color: 'var(--text-primary)', fontFamily: 'IBM Plex Sans' }}>{label}</div>
        <div style={{ fontSize: 12, color: '#64748B', marginTop: 2 }}>{description}</div>
      </div>
      <div
        onClick={() => !disabled && onChange(!checked)}
        style={{
          width: 42, height: 24, borderRadius: 12, flexShrink: 0, cursor: disabled ? 'default' : 'pointer',
          background: checked ? '#FBC02D' : 'var(--border-input)', position: 'relative', transition: 'background 0.15s',
          opacity: disabled ? 0.6 : 1,
        }}>
        <div style={{
          width: 18, height: 18, borderRadius: '50%', background: '#fff', position: 'absolute', top: 3,
          left: checked ? 21 : 3, transition: 'left 0.15s',
        }} />
      </div>
    </div>
  );
}

const lbl: React.CSSProperties = { display: 'block', marginBottom: 5, fontSize: 12, fontFamily: 'IBM Plex Mono', color: 'var(--text-secondary)' };
const inp: React.CSSProperties = { width: '100%', padding: '9px 12px', background: 'var(--bg-app)', border: '1px solid var(--border-input)', borderRadius: 8, color: 'var(--text-primary)', fontSize: 13, fontFamily: 'IBM Plex Sans', outline: 'none', boxSizing: 'border-box' };
const btn: React.CSSProperties = { padding: '10px 20px', background: 'linear-gradient(135deg, #FBC02D, #F57F17)', color: '#060B18', fontWeight: 700, fontFamily: 'Syne', border: 'none', borderRadius: 8, cursor: 'pointer' };
