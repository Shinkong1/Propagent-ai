import Head from 'next/head';
import Link from 'next/link';
import { Zap, Lock, ShieldCheck, KeyRound, Database, CreditCard, Server, Timer, Mail, Check, Building2 } from 'lucide-react';
import PublicFooter from '../components/PublicFooter';

const LAST_UPDATED = 'August 7, 2026';

export default function Security() {
  return (
    <>
      <Head>
        <title>Security &amp; Data Handling — PropAgent AI</title>
        <meta name="description" content="How PropAgent AI protects your account, your tenants' data, and your payment information." />
      </Head>
      <div style={{ minHeight: '100vh', background: 'var(--bg-app)', color: '#E2E8F0' }}>
        <nav style={{ display: 'flex', alignItems: 'center', padding: '20px 48px', borderBottom: '1px solid var(--border-subtle)' }}>
          <Link href="/" style={{ display: 'flex', alignItems: 'center', gap: 10, textDecoration: 'none' }}>
            <div style={{ width: 32, height: 32, borderRadius: 8, background: 'linear-gradient(135deg, #FBC02D, #F57F17)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              <Zap size={16} color="var(--bg-app)" strokeWidth={2.5} />
            </div>
            <span style={{ fontFamily: 'Syne', fontWeight: 800, fontSize: 18, color: 'var(--text-primary)' }}>PropAgent AI</span>
          </Link>
        </nav>

        <div style={{ maxWidth: 900, margin: '0 auto', padding: '48px 24px 80px' }}>
          <h1 style={{ fontFamily: 'Syne', fontWeight: 800, fontSize: 36, color: 'var(--text-primary)', marginBottom: 10 }}>Security &amp; Data Handling</h1>
          <p style={{ color: '#64748B', fontSize: 13, fontFamily: 'IBM Plex Mono', marginBottom: 20 }}>Last updated: {LAST_UPDATED}</p>
          <p style={{ fontSize: 15, lineHeight: 1.75, color: 'var(--text-secondary)', marginBottom: 20, maxWidth: 680 }}>
            This page describes the technical measures PropAgent AI actually has in place today to protect your
            account, your organization&apos;s data, and your tenants&apos; information — in plain language, without
            marketing gloss.
          </p>
          <div style={{ display: 'flex', gap: 12, background: 'rgba(251,192,45,0.08)', border: '1px solid rgba(251,192,45,0.25)', borderRadius: 12, padding: '16px 18px', marginBottom: 40, maxWidth: 680 }}>
            <ShieldCheck size={20} color="#FBC02D" style={{ flexShrink: 0, marginTop: 2 }} />
            <p style={{ fontSize: 13, lineHeight: 1.6, color: 'var(--text-secondary)' }}>
              This describes measures we&apos;ve built into the product. It is not a third-party certification or
              audit, and we do not currently claim compliance with any specific framework (e.g. SOC 2, HIPAA,
              PCI-DSS, ISO 27001). If a compliance framework matters for your use case, contact us before you sign up.
            </p>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(340px, 1fr))', gap: 20, marginBottom: 20 }}>
            <Card icon={KeyRound} title="Account Security">
              <ul style={list}>
                <li style={li}>Passwords must be at least 8 characters, cannot be a password from our list of
                  commonly-breached passwords, and must mix at least two character types (upper/lowercase, digits,
                  symbols) so repetitive strings like &quot;aaaaaaaa&quot; are rejected — enforced on every signup,
                  password change, and reset, for both staff and tenant-portal accounts.</li>
                <li style={li}>Passwords are hashed with bcrypt before storage. We never store or log plaintext
                  passwords.</li>
                <li style={li}>Optional two-factor authentication (TOTP) works with any standard authenticator app
                  (Google Authenticator, Authy, 1Password, etc.), set up via QR code.</li>
                <li style={li}>Enabling 2FA generates 10 single-use backup codes, shown to you once. Each is stored
                  only as a bcrypt hash, the same as your password.</li>
                <li style={li}>Disabling 2FA or regenerating backup codes requires re-entering your password.</li>
                <li style={li}>If you lose access to your authenticator app and your backup codes, an administrator
                  can reset 2FA on your account as a last-resort recovery step — every such reset is logged.</li>
              </ul>
            </Card>

            <Card icon={Lock} title="Data Encryption">
              <ul style={list}>
                <li style={li}>All traffic to the app and API is served over HTTPS/TLS — our hosting providers
                  (Vercel for the app, Render for the API) terminate TLS on every request and automatically redirect
                  any plain HTTP request to HTTPS.</li>
                <li style={li}>The app sends security headers on every response: X-Frame-Options (blocks the site
                  from being embedded in another page — anti-clickjacking), X-Content-Type-Options, a strict
                  Referrer-Policy, and a Permissions-Policy that disables camera/microphone/location access by
                  default.</li>
                <li style={li}>Our database runs on Neon&apos;s managed PostgreSQL, whose infrastructure encrypts
                  stored data at rest.</li>
              </ul>
            </Card>

            <Card icon={CreditCard} title="Payment Security">
              <ul style={list}>
                <li style={li}>Subscription payments and rent payments are processed by Stripe Checkout and the
                  Stripe Billing Portal. Card numbers are entered directly into Stripe&apos;s hosted forms — they are
                  never sent to or stored on PropAgent&apos;s servers.</li>
                <li style={li}>We store only what Stripe reports back to us about your subscription: plan, status,
                  and billing metadata — never a raw card number.</li>
                <li style={li}>Payment webhook events from Stripe are verified by signature before we act on
                  them.</li>
              </ul>
            </Card>

            <Card icon={Building2} title="Data Isolation Between Organizations">
              <ul style={list}>
                <li style={li}>PropAgent is multi-tenant: every property, unit, tenant, lease, maintenance ticket,
                  document, and financial record belongs to one organization.</li>
                <li style={li}>Every query for that data is scoped to the requesting user&apos;s organization at the
                  database level — one customer&apos;s account has no path to another customer&apos;s data.</li>
                <li style={li}>External integrations (Zapier, Make, custom scripts) authenticate with a per-organization
                  API key, scoped the same way as a logged-in user.</li>
              </ul>
            </Card>

            <Card icon={Server} title="Infrastructure">
              <ul style={list}>
                <li style={li}>Frontend: hosted on Vercel.</li>
                <li style={li}>API/backend: hosted on Render.</li>
                <li style={li}>Database: managed PostgreSQL on Neon.</li>
                <li style={li}>We rely on established infrastructure providers rather than self-managing servers, so
                  patching, network security, and physical security of the underlying hardware are handled by those
                  providers.</li>
              </ul>
            </Card>

            <Card icon={Timer} title="Rate Limiting &amp; Abuse Prevention">
              <ul style={list}>
                <li style={li}>Login, signup, password-reset, and 2FA endpoints are rate-limited per IP address
                  (typically 5–10 attempts per minute) to slow down credential-stuffing and brute-force
                  attempts.</li>
                <li style={li}>The tenant portal&apos;s login and password-reset endpoints are rate-limited the same
                  way.</li>
                <li style={li}>Rate limiting keys off the real client IP as reported by our hosting provider&apos;s
                  edge network, not a value a client can spoof.</li>
              </ul>
            </Card>
          </div>

          <div style={{ display: 'flex', gap: 14, background: 'var(--bg-surface)', border: '1px solid var(--border-strong)', borderRadius: 14, padding: '22px 24px', marginTop: 12 }}>
            <Mail size={22} color="#FBC02D" style={{ flexShrink: 0, marginTop: 2 }} />
            <div>
              <h2 style={{ fontFamily: 'Syne', fontWeight: 700, fontSize: 17, color: 'var(--text-primary)', marginBottom: 6 }}>
                Responsible Disclosure
              </h2>
              <p style={{ fontSize: 14, lineHeight: 1.7, color: 'var(--text-secondary)' }}>
                If you believe you&apos;ve found a security vulnerability in PropAgent, please email us at{' '}
                <a href="mailto:propagentapp@gmail.com" style={{ color: '#FBC02D' }}>propagentapp@gmail.com</a>{' '}
                with details and steps to reproduce. We ask that you give us a reasonable window to investigate and
                fix an issue before disclosing it publicly, and that you avoid accessing or modifying data that
                isn&apos;t your own while testing. You can also reach us through our{' '}
                <Link href="/contact" style={{ color: '#FBC02D' }}>contact page</Link>.
              </p>
            </div>
          </div>

          <p style={{ fontSize: 13, lineHeight: 1.7, color: '#64748B', marginTop: 32 }}>
            See also our <Link href="/privacy" style={{ color: '#FBC02D' }}>Privacy Policy</Link> for what
            information we collect and how it&apos;s used, and our{' '}
            <Link href="/terms" style={{ color: '#FBC02D' }}>Terms of Service</Link>.
          </p>
        </div>
        <PublicFooter />
      </div>
    </>
  );
}

function Card({ icon: Icon, title, children }: { icon: any; title: string; children: React.ReactNode }) {
  return (
    <div style={{ background: 'var(--bg-surface)', border: '1px solid var(--border-strong)', borderRadius: 14, padding: 22 }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 14 }}>
        <div style={{ width: 32, height: 32, borderRadius: 8, background: 'rgba(251,192,45,0.12)', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
          <Icon size={16} color="#FBC02D" strokeWidth={2.25} />
        </div>
        <h2 style={{ fontFamily: 'Syne', fontWeight: 700, fontSize: 16, color: 'var(--text-primary)' }}>{title}</h2>
      </div>
      {children}
    </div>
  );
}

const list: React.CSSProperties = { listStyle: 'disc', margin: 0, padding: '0 0 0 18px', display: 'flex', flexDirection: 'column', gap: 10 };
const li: React.CSSProperties = { fontSize: 13, lineHeight: 1.65, color: 'var(--text-secondary)' };
