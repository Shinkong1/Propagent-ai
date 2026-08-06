import Head from 'next/head';
import Link from 'next/link';
import { Zap, AlertTriangle } from 'lucide-react';
import PublicFooter from '../components/PublicFooter';

const LAST_UPDATED = 'August 3, 2026';

export default function Privacy() {
  return (
    <>
      <Head>
        <title>Privacy Policy — PropAgent AI</title>
        <meta name="description" content="Privacy Policy for PropAgent AI." />
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

        <div style={{ maxWidth: 780, margin: '0 auto', padding: '48px 24px 80px' }}>
          <h1 style={{ fontFamily: 'Syne', fontWeight: 800, fontSize: 32, color: 'var(--text-primary)', marginBottom: 8 }}>Privacy Policy</h1>
          <p style={{ color: '#64748B', fontSize: 13, fontFamily: 'IBM Plex Mono', marginBottom: 24 }}>Last updated: {LAST_UPDATED}</p>

          <div style={{ display: 'flex', gap: 12, background: 'rgba(251,192,45,0.08)', border: '1px solid rgba(251,192,45,0.25)', borderRadius: 12, padding: '16px 18px', marginBottom: 32 }}>
            <AlertTriangle size={20} color="#FBC02D" style={{ flexShrink: 0, marginTop: 2 }} />
            <p style={{ fontSize: 13, lineHeight: 1.6, color: 'var(--text-secondary)' }}>
              <strong style={{ color: '#FBC02D' }}>Draft placeholder — not legal advice.</strong> This describes what the app actually does with data today. It has not been reviewed by an attorney and does not yet address jurisdiction-specific requirements (GDPR, CCPA, etc.). Fill in the bracketed placeholders and have it reviewed before relying on it for real customer data.
            </p>
          </div>

          <Section title="1. What This Policy Covers">
            This Privacy Policy explains how NamaStay LLC ("we", "us") collects, uses, and shares information when you use PropAgent AI (the "Service"). It applies to information about you as a Customer, and — where you upload it — information about your tenants, leads, and vendors ("Third-Party Data").
          </Section>

          <Section title="2. Information We Collect">
            <strong>Account information:</strong> name, email, organization name, and password (stored hashed, never in plain text).<br /><br />
            <strong>Customer Data you provide:</strong> property, unit, tenant, lease, maintenance, accounting, and document records you enter or upload.<br /><br />
            <strong>Communications data:</strong> transcripts and metadata from AI chat, Voice AI calls, and SMS conducted through the Service, when those features are enabled.<br /><br />
            <strong>Payment information:</strong> subscription payments are processed by Stripe. We do not store your card number; we retain only subscription status and billing metadata Stripe provides to us.<br /><br />
            <strong>Usage data:</strong> log data such as login times, feature usage, and error reports, used to operate and improve the Service.
          </Section>

          <Section title="3. How We Use Information">
            We use information to: provide and operate the Service (including the AI agents you enable); process payments; send account and billing notifications; respond to support requests; and monitor for security, abuse, and reliability issues. AI features send relevant Customer Data to our AI processing provider (OpenAI) solely to generate the response, summary, or document you requested.
          </Section>

          <Section title="4. Third-Party Subprocessors">
            We share information with the following categories of service providers strictly to operate the Service: payment processing (Stripe), voice/SMS delivery (Twilio), AI processing (OpenAI), and cloud hosting/database/caching infrastructure. These providers are contractually restricted from using your data for any purpose other than providing their service to us.
          </Section>

          <Section title="5. Tenant and Third-Party Data">
            If you upload information about your tenants, leads, or vendors, you are the data controller for that information and we act as a data processor on your behalf. You are responsible for having a lawful basis to collect and share that information with us, including any consent required before enabling AI voice calls or SMS to those individuals.
          </Section>

          <Section title="6. Data Retention">
            We retain Customer Data for as long as your account is active. If you cancel, we retain data for 90 days to allow reactivation, after which it is deleted, except where retention is required for legal or accounting purposes.
          </Section>

          <Section title="7. Security">
            We use industry-standard measures including encrypted password storage, rate limiting, and role-based access controls to protect your data. No system is completely secure, and we cannot guarantee absolute security.
          </Section>

          <Section title="8. Your Rights">
            Depending on your location, you may have rights to access, correct, export, or delete your personal information. You can update most account information directly in Settings, or contact us at propagentapp@gmail.com to make a request.
          </Section>

          <Section title="9. Cookies">
            We use essential cookies/local storage to keep you signed in and remember your preferences (theme, language, currency). We do not currently use third-party advertising or tracking cookies.
          </Section>

          <Section title="10. Children's Privacy">
            The Service is intended for business use by adults managing rental properties and is not directed at children under 16. We do not knowingly collect personal information from children.
          </Section>

          <Section title="11. Changes to This Policy">
            We may update this Privacy Policy from time to time. We will post the updated version here with a new "Last updated" date.
          </Section>

          <Section title="12. Contact">
            Questions about this Privacy Policy or our <Link href="/terms" style={{ color: '#FBC02D' }}>Terms of Service</Link> can be sent to propagentapp@gmail.com.
          </Section>
        </div>
        <PublicFooter />
      </div>
    </>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div style={{ marginBottom: 26 }}>
      <h2 style={{ fontFamily: 'Syne', fontWeight: 700, fontSize: 18, color: 'var(--text-primary)', marginBottom: 8 }}>{title}</h2>
      <p style={{ fontSize: 14, lineHeight: 1.75, color: 'var(--text-secondary)' }}>{children}</p>
    </div>
  );
}
