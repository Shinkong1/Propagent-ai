import { useRouter } from 'next/router';
import Link from 'next/link';
import { createPortal } from 'react-dom';
import { useEffect, useRef, useState } from 'react';
import {
  LayoutDashboard, Building2, Users, Wrench, UserSearch,
  BarChart3, Phone, CreditCard, LogOut, Zap, User, Landmark, Sparkles, Boxes, ShieldCheck, AlertTriangle, TrendingUp, FileText, LineChart, ClipboardCheck, MessageSquare, MessageCircle, Settings, Lock, Crown, ChevronLeft, ChevronRight, Workflow, Radar, ChevronRight as CaretRight, X
} from 'lucide-react';
import { clearToken, getUser } from '../lib/auth';
import { useLanguage } from '../lib/LanguageContext';
import { useSidebar } from '../lib/SidebarContext';
import { hasPlanAccess, PlanTier } from './PlanLock';

type NavLeaf = { group?: false; href: string; key: string; icon: any; minTier?: PlanTier; masterOnly?: boolean };
type NavGroup = { group: true; groupKey: string; labelKey: string; icon: any; masterOnly?: boolean; items: NavLeaf[] };
type NavEntry = NavLeaf | NavGroup;

function isNavGroup(entry: NavEntry): entry is NavGroup {
  return entry.group === true;
}

const NAV: NavEntry[] = [
  { href: '/dashboard', key: 'nav.overview', icon: LayoutDashboard },
  { href: '/dashboard/admin', key: 'nav.admin', icon: Crown, masterOnly: true },
  {
    group: true, groupKey: 'property_ops', labelKey: 'nav.groupPropertyOps', icon: Building2,
    items: [
      { href: '/dashboard/properties', key: 'nav.properties', icon: Building2 },
      { href: '/dashboard/tenants', key: 'nav.tenants', icon: Users },
      { href: '/dashboard/maintenance', key: 'nav.maintenance', icon: Wrench },
      { href: '/dashboard/inspections', key: 'nav.inspections', icon: ClipboardCheck, minTier: 'professional' },
      { href: '/dashboard/accounting', key: 'nav.accounting', icon: Landmark },
      { href: '/dashboard/collections', key: 'nav.collections', icon: AlertTriangle, minTier: 'professional' },
      { href: '/dashboard/compliance', key: 'nav.compliance', icon: ShieldCheck, minTier: 'professional' },
      { href: '/dashboard/documents', key: 'nav.documents', icon: FileText },
      { href: '/dashboard/communications', key: 'nav.communications', icon: MessageSquare, minTier: 'professional' },
      { href: '/dashboard/leads', key: 'nav.leads', icon: UserSearch },
      { href: '/dashboard/analytics', key: 'nav.analytics', icon: BarChart3 },
      { href: '/dashboard/portfolio', key: 'nav.portfolio', icon: Boxes, minTier: 'enterprise' },
      { href: '/dashboard/investment', key: 'nav.investment', icon: TrendingUp, minTier: 'enterprise' },
      { href: '/dashboard/pricing-intel', key: 'nav.pricingIntel', icon: LineChart, minTier: 'enterprise' },
      { href: '/dashboard/workflows', key: 'nav.workflows', icon: Workflow, minTier: 'enterprise' },
      { href: '/dashboard/predictive', key: 'nav.predictive', icon: Radar, minTier: 'enterprise' },
    ],
  },
  {
    group: true, groupKey: 'ai_assistants', labelKey: 'nav.groupAiAssistants', icon: Sparkles,
    items: [
      { href: '/dashboard/executive', key: 'nav.executive', icon: Sparkles, minTier: 'professional' },
      { href: '/dashboard/voice', key: 'nav.voice', icon: Phone, minTier: 'professional' },
    ],
  },
];

const BOTTOM_NAV: { href: string; key: string; icon: any }[] = [
  { href: '/dashboard/settings', key: 'nav.settings', icon: Settings },
  { href: '/dashboard/profile', key: 'nav.profile', icon: User },
  { href: '/dashboard/contact', key: 'nav.contact', icon: MessageCircle },
];

export const SIDEBAR_WIDTH_EXPANDED = 240;
export const SIDEBAR_WIDTH_COLLAPSED = 68;

export default function Sidebar() {
  const router = useRouter();
  const { t } = useLanguage();
  const { collapsed, toggleCollapsed, mobileOpen, setMobileOpen, isMobile } = useSidebar();
  const effectiveCollapsed = isMobile ? false : collapsed;
  const [plan, setPlan] = useState<string | null>(null);
  const [isMaster, setIsMaster] = useState(false);
  const [hoverGroup, setHoverGroup] = useState<string | null>(null);
  const [flyoutPos, setFlyoutPos] = useState<{ top: number; left: number } | null>(null);
  const [expandedGroup, setExpandedGroup] = useState<string | null>(null);
  const closeTimer = useRef<any>(null);

  useEffect(() => {
    setMobileOpen(false);
    setExpandedGroup(null);
  }, [router.pathname]);

  useEffect(() => {
    setPlan(getUser()?.plan || 'starter');
    setIsMaster(!!getUser()?.is_master);
  }, []);

  const handleLogout = () => {
    clearToken();
    router.push('/login');
  };

  const openFlyout = (key: string, el: HTMLElement) => {
    if (isMobile) return;
    if (closeTimer.current) clearTimeout(closeTimer.current);
    const rect = el.getBoundingClientRect();
    const group = NAV.find(e => isNavGroup(e) && e.groupKey === key) as NavGroup | undefined;
    const itemCount = group ? group.items.length : 0;
    const estimatedHeight = 40 + itemCount * 34 + 12;
    const margin = 8;
    const maxTop = window.innerHeight - estimatedHeight - margin;
    const top = Math.max(margin, Math.min(rect.top, maxTop));
    setFlyoutPos({ top, left: rect.right + 6 });
    setHoverGroup(key);
  };
  const scheduleClose = () => {
    closeTimer.current = setTimeout(() => setHoverGroup(null), 150);
  };
  const cancelClose = () => { if (closeTimer.current) clearTimeout(closeTimer.current); };

  const isItemActive = (href: string) => href === '/dashboard' ? router.pathname === href : router.pathname.startsWith(href);
  const isLocked = (minTier?: PlanTier) => !!minTier && plan !== null && !hasPlanAccess(minTier);

  return (
    <>
      {isMobile && mobileOpen && (
        <div
          onClick={() => setMobileOpen(false)}
          style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.5)', zIndex: 999 }}
        />
      )}
      <aside style={{
        width: effectiveCollapsed ? SIDEBAR_WIDTH_COLLAPSED : SIDEBAR_WIDTH_EXPANDED,
        height: '100vh',
        background: 'var(--bg-surface)',
        borderRight: '1px solid var(--border-strong)',
        display: 'flex',
        flexDirection: 'column',
        position: 'fixed',
        top: 0,
        left: 0,
        zIndex: 1000,
        transition: isMobile ? 'transform 0.22s ease' : 'width 0.18s ease',
        transform: isMobile ? (mobileOpen ? 'translateX(0)' : 'translateX(-100%)') : 'none',
        boxShadow: isMobile && mobileOpen ? '0 0 40px rgba(0,0,0,0.5)' : 'none',
        overflow: 'hidden',
      }}>
      {/* Logo */}
      <div style={{ padding: effectiveCollapsed ? '20px 0' : '24px 20px 20px', borderBottom: '1px solid var(--border-strong)', display: 'flex', alignItems: 'center', justifyContent: effectiveCollapsed ? 'center' : 'space-between' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <div style={{
            width: 34, height: 34, borderRadius: 8, flexShrink: 0,
            background: 'linear-gradient(135deg, #FBC02D, #F57F17)',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
          }}>
            <Zap size={18} color="var(--bg-surface)" strokeWidth={2.5} />
          </div>
          {!effectiveCollapsed && (
            <div>
              <div style={{ fontFamily: 'Syne, sans-serif', fontWeight: 800, fontSize: 16, color: 'var(--text-primary)', letterSpacing: '-0.3px', whiteSpace: 'nowrap' }}>
                PropAgent
              </div>
              <div style={{ fontSize: 10, color: '#FBC02D', fontFamily: 'IBM Plex Mono, monospace', letterSpacing: '1px' }}>
                AI
              </div>
            </div>
          )}
        </div>
        {isMobile ? (
          <button onClick={() => setMobileOpen(false)} title={t('nav.close')} style={{
            width: 28, height: 28, borderRadius: 6, border: '1px solid var(--border-strong)', background: 'transparent',
            color: '#64748B', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0,
          }}>
            <X size={15} />
          </button>
        ) : !collapsed && (
          <button onClick={toggleCollapsed} title={t('nav.collapse')} style={{
            width: 24, height: 24, borderRadius: 6, border: '1px solid var(--border-strong)', background: 'transparent',
            color: '#64748B', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0,
          }}>
            <ChevronLeft size={13} />
          </button>
        )}
      </div>

      {!isMobile && collapsed && (
        <button onClick={toggleCollapsed} title={t('nav.expand')} style={{
          width: 28, height: 28, borderRadius: 6, border: '1px solid var(--border-strong)', background: 'var(--bg-surface)',
          color: '#64748B', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center',
          margin: '10px auto 0',
        }}>
          <ChevronRight size={14} />
        </button>
      )}

      {/* Nav */}
      <nav style={{ flex: 1, minHeight: 0, overflowY: 'auto', overflowX: 'hidden', padding: effectiveCollapsed ? '12px 8px' : '12px 12px' }}>
        {NAV.filter(item => !item.masterOnly || isMaster).map((entry) => {
          if (isNavGroup(entry)) {
            const { groupKey, labelKey, icon: Icon, items } = entry;
            const visibleItems = items;
            const active = visibleItems.some(i => isItemActive(i.href));
            const expanded = isMobile && expandedGroup === groupKey;
            return (
              <div key={groupKey}>
                <div
                  onMouseEnter={e => openFlyout(groupKey, e.currentTarget)}
                  onMouseLeave={scheduleClose}
                  onClick={() => { if (isMobile) setExpandedGroup(prev => prev === groupKey ? null : groupKey); }}
                  style={{
                    display: 'flex', alignItems: 'center', gap: 10,
                    justifyContent: effectiveCollapsed ? 'center' : 'flex-start',
                    padding: effectiveCollapsed ? '9px 0' : '9px 12px', borderRadius: 8, marginBottom: 2,
                    background: active ? 'rgba(var(--accent-rgb),0.12)' : 'transparent',
                    color: active ? '#FBC02D' : 'var(--text-secondary)',
                    cursor: 'pointer',
                    fontFamily: 'IBM Plex Sans, sans-serif',
                    fontSize: 13,
                    fontWeight: active ? 600 : 400,
                    borderLeft: effectiveCollapsed ? 'none' : (active ? '2px solid #FBC02D' : '2px solid transparent'),
                  }}
                  title={effectiveCollapsed ? t(labelKey) : undefined}
                >
                  <Icon size={16} />
                  {!effectiveCollapsed && <span style={{ flex: 1 }}>{t(labelKey)}</span>}
                  {!effectiveCollapsed && <CaretRight size={13} style={{ opacity: 0.5, transform: expanded ? 'rotate(90deg)' : 'none', transition: 'transform 0.15s' }} />}
                </div>
                {expanded && (
                  <div style={{ paddingLeft: 14, marginBottom: 4 }}>
                    {items.map(item => {
                      const itemActive = isItemActive(item.href);
                      const itemLocked = isLocked(item.minTier);
                      return (
                        <Link key={item.href} href={item.href} style={{ textDecoration: 'none' }} onClick={() => setMobileOpen(false)}>
                          <div style={{
                            display: 'flex', alignItems: 'center', gap: 9, padding: '8px 10px', borderRadius: 7, marginBottom: 2,
                            background: itemActive ? 'rgba(var(--accent-rgb),0.12)' : 'transparent',
                            color: itemActive ? '#FBC02D' : (itemLocked ? '#475569' : 'var(--text-secondary)'),
                            fontSize: 13, fontFamily: 'IBM Plex Sans, sans-serif', fontWeight: itemActive ? 600 : 400,
                          }}>
                            <item.icon size={14} />
                            <span style={{ flex: 1 }}>{t(item.key)}</span>
                            {itemLocked && <Lock size={11} />}
                          </div>
                        </Link>
                      );
                    })}
                  </div>
                )}
              </div>
            );
          }

          const { href, key, icon: Icon, minTier } = entry;
          const active = isItemActive(href);
          const locked = isLocked(minTier);
          return (
            <div key={href}>
              {entry.masterOnly && !effectiveCollapsed && (
                <div style={{ padding: '10px 12px 4px', fontSize: 10, fontFamily: 'IBM Plex Mono', color: '#475569', letterSpacing: '0.8px', textTransform: 'uppercase' }}>
                  {t('nav.platformAdmin')}
                </div>
              )}
              <Link href={href} style={{ textDecoration: 'none' }} title={effectiveCollapsed ? t(key) : undefined} onClick={() => setMobileOpen(false)}>
                <div style={{
                  display: 'flex', alignItems: 'center', gap: 10,
                  justifyContent: effectiveCollapsed ? 'center' : 'flex-start',
                  padding: effectiveCollapsed ? '9px 0' : '9px 12px', borderRadius: 8, marginBottom: 2,
                  background: active ? 'rgba(var(--accent-rgb),0.12)' : 'transparent',
                  color: active ? '#FBC02D' : (locked ? '#475569' : 'var(--text-secondary)'),
                  cursor: 'pointer',
                  transition: 'all 0.15s',
                  fontFamily: 'IBM Plex Sans, sans-serif',
                  fontSize: 13,
                  fontWeight: active ? 600 : 400,
                  borderLeft: effectiveCollapsed ? 'none' : (active ? '2px solid #FBC02D' : '2px solid transparent'),
                }}
                onMouseEnter={e => { if (!active) { (e.currentTarget as HTMLElement).style.background = 'var(--hover-overlay)'; (e.currentTarget as HTMLElement).style.color = locked ? '#64748B' : 'var(--text-hover)'; } }}
                onMouseLeave={e => { if (!active) { (e.currentTarget as HTMLElement).style.background = 'transparent'; (e.currentTarget as HTMLElement).style.color = locked ? '#475569' : 'var(--text-secondary)'; } }}
                >
                  <Icon size={16} />
                  {!effectiveCollapsed && <span style={{ flex: 1 }}>{t(key)}</span>}
                  {!effectiveCollapsed && locked && <Lock size={11} />}
                </div>
              </Link>
              {entry.masterOnly && !effectiveCollapsed && (
                <div style={{ padding: '6px 12px 4px', fontSize: 10, fontFamily: 'IBM Plex Mono', color: '#475569', letterSpacing: '0.8px', textTransform: 'uppercase', borderTop: '1px solid var(--border-strong)', marginTop: 6 }}>
                  {t('nav.propertyToolsBelow')}
                </div>
              )}
            </div>
          );
        })}
      </nav>

      {/* Flyout submenu (portal, escapes sidebar overflow) — desktop only */}
      {!isMobile && hoverGroup && flyoutPos && createPortal(
        (() => {
          const group = NAV.find(e => e.group && e.groupKey === hoverGroup) as NavGroup | undefined;
          if (!group) return null;
          return (
            <div
              onMouseEnter={cancelClose}
              onMouseLeave={scheduleClose}
              style={{
                position: 'fixed', top: flyoutPos.top, left: flyoutPos.left, zIndex: 2000,
                background: 'var(--bg-surface)', border: '1px solid var(--border-strong)', borderRadius: 10,
                padding: 6, minWidth: 208, boxShadow: '0 10px 30px rgba(0,0,0,0.45)',
                maxHeight: 'calc(100vh - 16px)', overflowY: 'auto',
              }}
            >
              <div style={{ padding: '6px 10px 8px', fontSize: 11, fontFamily: 'IBM Plex Mono', color: '#64748B', letterSpacing: '0.5px', textTransform: 'uppercase' }}>
                {t(group.labelKey)}
              </div>
              {group.items.map(item => {
                const active = isItemActive(item.href);
                const locked = isLocked(item.minTier);
                return (
                  <Link key={item.href} href={item.href} style={{ textDecoration: 'none' }} onClick={() => setHoverGroup(null)}>
                    <div style={{
                      display: 'flex', alignItems: 'center', gap: 9, padding: '8px 10px', borderRadius: 7,
                      background: active ? 'rgba(var(--accent-rgb),0.12)' : 'transparent',
                      color: active ? '#FBC02D' : (locked ? '#475569' : 'var(--text-secondary)'),
                      fontSize: 13, fontFamily: 'IBM Plex Sans, sans-serif', fontWeight: active ? 600 : 400,
                      cursor: 'pointer',
                    }}
                    onMouseEnter={e => { if (!active) { (e.currentTarget as HTMLElement).style.background = 'var(--hover-overlay)'; (e.currentTarget as HTMLElement).style.color = locked ? '#64748B' : 'var(--text-hover)'; } }}
                    onMouseLeave={e => { if (!active) { (e.currentTarget as HTMLElement).style.background = 'transparent'; (e.currentTarget as HTMLElement).style.color = locked ? '#475569' : 'var(--text-secondary)'; } }}
                    >
                      <item.icon size={14} />
                      <span style={{ flex: 1 }}>{t(item.key)}</span>
                      {locked && <Lock size={11} />}
                    </div>
                  </Link>
                );
              })}
            </div>
          );
        })(),
        document.body
      )}

      {/* Bottom */}
      <div style={{ padding: effectiveCollapsed ? '12px 8px' : '12px 12px', borderTop: '1px solid var(--border-strong)' }}>
        <Link href="/pricing" style={{ textDecoration: 'none' }} title={effectiveCollapsed ? t('nav.upgradePlan') : undefined} onClick={() => setMobileOpen(false)}>
          <div style={{
            padding: effectiveCollapsed ? '8px 0' : '8px 12px', borderRadius: 8, marginBottom: 4,
            background: 'rgba(var(--accent-rgb),0.08)', border: '1px solid rgba(var(--accent-rgb),0.2)',
            color: '#FBC02D', fontSize: 12, fontWeight: 600, cursor: 'pointer',
            display: 'flex', alignItems: 'center', gap: 8, justifyContent: effectiveCollapsed ? 'center' : 'flex-start',
          }}>
            <CreditCard size={14} />
            {!effectiveCollapsed && t('nav.upgradePlan')}
          </div>
        </Link>
        {BOTTOM_NAV.map(({ href, key, icon: Icon }) => {
          const active = router.pathname.startsWith(href);
          return (
            <Link key={href} href={href} style={{ textDecoration: 'none' }} title={effectiveCollapsed ? t(key) : undefined} onClick={() => setMobileOpen(false)}>
              <div style={{
                display: 'flex', alignItems: 'center', gap: 8,
                justifyContent: effectiveCollapsed ? 'center' : 'flex-start',
                padding: effectiveCollapsed ? '8px 0' : '8px 12px', borderRadius: 8, marginBottom: 4,
                background: active ? 'rgba(var(--accent-rgb),0.12)' : 'transparent',
                color: active ? '#FBC02D' : '#64748B',
                cursor: 'pointer', fontSize: 13,
              }}
              onMouseEnter={e => { if (!active) { (e.currentTarget as HTMLElement).style.background = 'var(--hover-overlay)'; (e.currentTarget as HTMLElement).style.color = 'var(--text-hover)'; } }}
              onMouseLeave={e => { if (!active) { (e.currentTarget as HTMLElement).style.background = 'transparent'; (e.currentTarget as HTMLElement).style.color = '#64748B'; } }}
              >
                <Icon size={14} />
                {!effectiveCollapsed && t(key)}
              </div>
            </Link>
          );
        })}
        <button onClick={handleLogout} title={effectiveCollapsed ? t('nav.signOut') : undefined} style={{
          width: '100%', padding: effectiveCollapsed ? '8px 0' : '8px 12px', borderRadius: 8,
          background: 'transparent', border: 'none', color: '#64748B',
          fontSize: 13, cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 8,
          justifyContent: effectiveCollapsed ? 'center' : 'flex-start',
        }}>
          <LogOut size={14} />
          {!effectiveCollapsed && t('nav.signOut')}
        </button>
      </div>
      </aside>
    </>
  );
}
