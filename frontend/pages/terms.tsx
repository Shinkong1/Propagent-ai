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
              <strong style={{ color: '#FBC02D' }}>Draft placeholder — not legal advice, no attorney has reviewed this.</strong> This version adds commonly-used protective clauses (indemnification, arbitration/class-action waiver, liability limits, disclaimers) on top of the earlier draft, but "commonly used" is not the same as "enforceable for your business" — arbitration clauses in particular have jurisdiction-specific requirements to hold up, and consumer-protection carve-outs vary by state/country. Replace every bracketed placeholder with your real legal entity and jurisdiction, and get this reviewed by a licensed attorney before your first paying customer signs up. Operating without that review is a real, uninsured risk you're currently carrying.
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
            THE SERVICE IS PROVIDED "AS IS" AND "AS AVAILABLE," WITHOUT WARRANTIES OF ANY KIND, WHETHER EXPRESS, IMPLIED, OR STATUTORY, INCLUDING WITHOUT LIMITATION ANY IMPLIED WARRANTIES OF MERCHANTABILITY, FITNESS FOR A PARTICULAR PURPOSE, TITLE, OR NON-INFRINGEMENT. WE DO NOT WARRANT THAT THE SERVICE WILL BE UNINTERRUPTED, TIMELY, SECURE, OR ERROR-FREE, OR THAT ANY DEFECTS WILL BE CORRECTED.<br /><br />
            AI-GENERATED CONTENT (INCLUDING GENERATED LEASE CLAUSES, PRICING RECOMMENDATIONS, COMPLIANCE ASSESSMENTS, TRANSCRIPTS, AND VOICE/SMS RESPONSES) MAY CONTAIN ERRORS AND DOES NOT CONSTITUTE LEGAL, FINANCIAL, TAX, OR PROFESSIONAL ADVICE. YOU ARE SOLELY RESPONSIBLE FOR REVIEWING AND VERIFYING ALL AI-GENERATED OUTPUT BEFORE RELYING ON OR ACTING UPON IT, INCLUDING BEFORE SENDING IT TO A THIRD PARTY.<br /><br />
            YOU ARE SOLELY RESPONSIBLE FOR MAINTAINING YOUR OWN INDEPENDENT BACKUP OF ANY CUSTOMER DATA YOU CONSIDER CRITICAL. WE ARE NOT LIABLE FOR ANY LOSS, CORRUPTION, OR UNAUTHORIZED ACCESS TO CUSTOMER DATA EXCEPT TO THE EXTENT CAUSED BY OUR GROSS NEGLIGENCE OR WILLFUL MISCONDUCT.
          </Section>

          <Section title="10. Indemnification">
            You agree to defend, indemnify, and hold harmless the Company, its officers, directors, employees, and agents from and against any claims, liabilities, damages, losses, and expenses (including reasonable attorneys' fees) arising out of or in any way connected with: (a) your use or misuse of the Service; (b) Customer Data, including any tenant or third-party personal information you upload; (c) your violation of these Terms or of any law or regulation, including consent requirements for AI-initiated calls or texts under Section 5; or (d) your violation of any right of a tenant, lead, vendor, or other third party.
          </Section>

          <Section title="11. Limitation of Liability">
            TO THE MAXIMUM EXTENT PERMITTED BY LAW: (A) THE COMPANY SHALL NOT BE LIABLE FOR ANY INDIRECT, INCIDENTAL, SPECIAL, CONSEQUENTIAL, EXEMPLARY, OR PUNITIVE DAMAGES, OR ANY LOSS OF PROFITS, REVENUE, DATA, OR GOODWILL, ARISING OUT OF OR RELATED TO THESE TERMS OR THE SERVICE, REGARDLESS OF THE THEORY OF LIABILITY AND EVEN IF THE COMPANY HAS BEEN ADVISED OF THE POSSIBILITY OF SUCH DAMAGES; AND (B) THE COMPANY'S TOTAL AGGREGATE LIABILITY ARISING OUT OF OR RELATED TO THESE TERMS OR THE SERVICE SHALL NOT EXCEED THE GREATER OF (I) THE AMOUNT YOU PAID THE COMPANY IN THE TWELVE (12) MONTHS PRECEDING THE EVENT GIVING RISE TO THE CLAIM, OR (II) ONE HUNDRED U.S. DOLLARS ($100). THESE LIMITATIONS APPLY EVEN IF ANY REMEDY FAILS OF ITS ESSENTIAL PURPOSE. SOME JURISDICTIONS DO NOT ALLOW THE EXCLUSION OR LIMITATION OF CERTAIN DAMAGES, SO SOME OF THE ABOVE LIMITATIONS MAY NOT APPLY TO YOU.
          </Section>

          <Section title="12. Termination">
            You may cancel your subscription at any time from Settings. We may suspend or terminate your access immediately, without notice, for actual or suspected breach of these Terms, non-payment, or conduct we reasonably believe exposes the Company or other users to risk or liability. Upon termination, your right to use the Service ends immediately; we will retain Customer Data for a limited period as described in our Privacy Policy before deletion. Sections 6, 9, 10, 11, 13, and 15 survive termination.
          </Section>

          <Section title="13. Dispute Resolution; Binding Arbitration; Class Action Waiver">
            <strong>Please read this section carefully — it affects your legal rights.</strong> You and the Company agree that any dispute, claim, or controversy arising out of or relating to these Terms or the Service will be resolved by binding, individual arbitration administered by <Placeholder>[American Arbitration Association / JAMS]</Placeholder> under its rules then in effect, rather than in court, except that either party may bring an individual action in small-claims court.<br /><br />
            <strong>YOU AND THE COMPANY EACH WAIVE THE RIGHT TO A JURY TRIAL AND THE RIGHT TO PARTICIPATE IN A CLASS ACTION, CLASS ARBITRATION, OR REPRESENTATIVE PROCEEDING.</strong> Disputes will be resolved only on an individual basis, and claims of more than one customer cannot be arbitrated or litigated jointly or consolidated with those of any other customer. If this class-action waiver is found unenforceable as to a particular dispute, that dispute (and only that dispute) will proceed in court rather than in arbitration.<br /><br />
            You may opt out of this arbitration agreement within 30 days of first accepting these Terms by sending written notice to <Placeholder>[legal@yourdomain.com]</Placeholder> with your name, account email, and a clear statement that you wish to opt out of arbitration.
          </Section>

          <Section title="14. Force Majeure">
            Neither party is liable for any failure or delay in performance to the extent caused by circumstances beyond its reasonable control, including acts of God, natural disaster, war, terrorism, riot, labor disputes, internet or utility failures, or failures of third-party service providers (including Stripe, Twilio, OpenAI, or cloud infrastructure providers).
          </Section>

          <Section title="15. Governing Law">
            These Terms are governed by the laws of <Placeholder>[State/Country]</Placeholder>, without regard to conflict-of-law principles, except that the Federal Arbitration Act governs the interpretation and enforcement of the arbitration agreement in Section 13. Subject to Section 13, any dispute not subject to arbitration shall be resolved exclusively in the courts located in <Placeholder>[Jurisdiction]</Placeholder>, and you consent to personal jurisdiction there.
          </Section>

          <Section title="16. General Provisions">
            <strong>Entire Agreement.</strong> These Terms, together with our Privacy Policy, constitute the entire agreement between you and the Company regarding the Service and supersede any prior agreements.<br /><br />
            <strong>Severability.</strong> If any provision of these Terms is held unenforceable, that provision will be limited or eliminated to the minimum extent necessary, and the remaining provisions will remain in full force and effect.<br /><br />
            <strong>No Waiver.</strong> Our failure to enforce any right or provision of these Terms is not a waiver of that right or provision.<br /><br />
            <strong>Assignment.</strong> You may not assign these Terms without our prior written consent. We may assign these Terms without restriction, including in connection with a merger, acquisition, or sale of assets.<br /><br />
            <strong>Compliance with Laws.</strong> You agree to comply with all applicable laws, including export control and sanctions laws, in your use of the Service.
          </Section>

          <Section title="17. Changes to These Terms">
            We may update these Terms from time to time. We will post the updated Terms with a new "Last updated" date and, for material changes, provide additional notice (such as an email or in-app notification). Continued use of the Service after a material change constitutes acceptance of the updated Terms.
          </Section>

          <Section title="18. Contact">
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
