import Head from 'next/head';
import Link from 'next/link';
import { Zap, AlertTriangle } from 'lucide-react';

const LAST_UPDATED = 'August 3, 2026';

export default function Terms() {
  return (
    <>
      <Head>
        <title>Terms of Service — PropAgent AI</title>
        <meta name="description" content="Terms of Service for PropAgent AI." />
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
          <h1 style={{ fontFamily: 'Syne', fontWeight: 800, fontSize: 32, color: 'var(--text-primary)', marginBottom: 8 }}>Terms of Service</h1>
          <p style={{ color: '#64748B', fontSize: 13, fontFamily: 'IBM Plex Mono', marginBottom: 24 }}>Last updated: {LAST_UPDATED}</p>

          <div style={{ display: 'flex', gap: 12, background: 'rgba(251,192,45,0.08)', border: '1px solid rgba(251,192,45,0.25)', borderRadius: 12, padding: '16px 18px', marginBottom: 32 }}>
            <AlertTriangle size={20} color="#FBC02D" style={{ flexShrink: 0, marginTop: 2 }} />
            <p style={{ fontSize: 13, lineHeight: 1.6, color: 'var(--text-secondary)' }}>
              <strong style={{ color: '#FBC02D' }}>Draft placeholder — not legal advice.</strong> This is a starting-point template covering PropAgent AI's actual functionality. It has not been reviewed by an attorney. Replace the bracketed placeholders with your real legal entity, jurisdiction, and contact details, and have it reviewed by counsel before relying on it — especially the sections on AI-initiated calls/texts (TCPA), payment processing, and tenant data handling.
            </p>
          </div>

          <Section title="1. Agreement to Terms">
            These Terms of Service ("Terms") govern access to and use of PropAgent AI (the "Service"), operated by <Placeholder>[Legal Entity Name]</Placeholder> ("Company", "we", "us"). By creating an account or using the Service, you ("Customer", "you") agree to be bound by these Terms. If you are entering into these Terms on behalf of a company or other legal entity, you represent that you have authority to bind that entity.
          </Section>

          <Section title="2. The Service">
            PropAgent AI is a property management platform that provides tools for managing properties, units, tenants, leases, maintenance requests, accounting, leasing, and compliance, along with a suite of AI-assisted agents that can draft communications, analyze documents, generate reports, and — where enabled by you — place or receive phone calls and send text messages to tenants and prospective tenants on your behalf.
          </Section>

          <Section title="3. Your Account">
            You are responsible for maintaining the confidentiality of your account credentials and for all activity under your account. You must provide accurate registration information and promptly update it if it changes. We may suspend or terminate accounts that violate these Terms.
          </Section>

          <Section title="4. Subscription Plans and Billing">
            The Service is offered on subscription plans (Starter, Professional, Enterprise) billed monthly through our payment processor, Stripe. By subscribing, you authorize us to charge your payment method on a recurring basis until you cancel. Fees are non-refundable except as required by law or expressly stated otherwise. We may change our pricing with advance notice; continued use after a price change constitutes acceptance of the new pricing.
          </Section>

          <Section title="5. AI-Initiated Calls and Text Messages">
            The Service includes optional features (Voice AI, Communications Agent, Collections Agent) that can place automated phone calls and send SMS messages to tenants, leads, and other contacts you upload or connect to your account. <strong>You, not PropAgent AI, are solely responsible for obtaining any consent required by law — including the Telephone Consumer Protection Act (TCPA) and equivalent state and international laws — before enabling these features for any contact.</strong> You represent that you have a lawful basis and, where required, documented prior express consent to contact each individual by automated call or text through the Service. You agree to indemnify and hold the Company harmless from claims arising from your use of these features without proper consent.
          </Section>

          <Section title="6. Your Data">
            You retain ownership of the property, tenant, lease, financial, and document data you upload to the Service ("Customer Data"). You grant us a license to process Customer Data solely to provide and improve the Service. You are responsible for ensuring you have the right to upload tenant and third-party personal information and for complying with applicable privacy laws with respect to that data (see our <Link href="/privacy" style={{ color: '#FBC02D' }}>Privacy Policy</Link>).
          </Section>

          <Section title="7. Third-Party Services">
            The Service relies on third-party subprocessors to operate, including Stripe (payments), Twilio (voice and SMS), OpenAI (AI processing), and cloud infrastructure providers. Your use of the Service is also subject to the applicable terms of those providers where you interact with them directly (for example, entering payment details into Stripe's checkout).
          </Section>

          <Section title="8. Acceptable Use">
            You agree not to use the Service to: violate any law; harass, defraud, or deceive any person; send unsolicited communications in violation of applicable law; upload malicious code; or attempt to gain unauthorized access to the Service or other accounts.
          </Section>

          <Section title="9. Disclaimers">
            THE SERVICE, INCLUDING ALL AI-GENERATED CONTENT, RECOMMENDATIONS, AND DOCUMENT DRAFTS, IS PROVIDED "AS IS" WITHOUT WARRANTIES OF ANY KIND. AI OUTPUTS (INCLUDING GENERATED LEASE CLAUSES, PRICING RECOMMENDATIONS, AND COMPLIANCE ASSESSMENTS) MAY CONTAIN ERRORS AND DO NOT CONSTITUTE LEGAL, FINANCIAL, OR PROFESSIONAL ADVICE. YOU ARE RESPONSIBLE FOR REVIEWING ALL AI-GENERATED OUTPUT BEFORE RELYING ON IT.
          </Section>

          <Section title="10. Limitation of Liability">
            TO THE MAXIMUM EXTENT PERMITTED BY LAW, THE COMPANY'S TOTAL LIABILITY ARISING OUT OF THESE TERMS OR THE SERVICE SHALL NOT EXCEED THE AMOUNT YOU PAID US IN THE TWELVE (12) MONTHS PRECEDING THE CLAIM. THE COMPANY IS NOT LIABLE FOR INDIRECT, INCIDENTAL, OR CONSEQUENTIAL DAMAGES.
          </Section>

          <Section title="11. Termination">
            You may cancel your subscription at any time from Settings. We may suspend or terminate your access for breach of these Terms. Upon termination, your right to use the Service ends; we will retain Customer Data for a limited period as described in our Privacy Policy before deletion.
          </Section>

          <Section title="12. Governing Law">
            These Terms are governed by the laws of <Placeholder>[State/Country]</Placeholder>, without regard to conflict-of-law principles. Any dispute shall be resolved in the courts located in <Placeholder>[Jurisdiction]</Placeholder>.
          </Section>

          <Section title="13. Changes to These Terms">
            We may update these Terms from time to time. We will post the updated Terms with a new "Last updated" date and, for material changes, provide additional notice (such as an email or in-app notification).
          </Section>

          <Section title="14. Contact">
            Questions about these Terms can be sent to <Placeholder>[legal@yourdomain.com]</Placeholder>.
          </Section>
        </div>
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

function Placeholder({ children }: { children: React.ReactNode }) {
  return <span style={{ background: 'rgba(251,192,45,0.15)', color: '#FBC02D', padding: '1px 6px', borderRadius: 4, fontFamily: 'IBM Plex Mono', fontSize: 13 }}>{children}</span>;
}
