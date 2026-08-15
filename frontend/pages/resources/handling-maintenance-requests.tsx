import Head from 'next/head';
import Link from 'next/link';
import ArticleLayout, { h2, p, ul, li, a, Callout, CTABox } from '../../components/ArticleLayout';

const SITE_URL = 'https://propagent.app';
const PATH = '/resources/handling-maintenance-requests';
const TITLE = 'How to Handle Maintenance Requests Efficiently';
const DESC = 'A practical system for triaging, assigning, and closing out tenant maintenance requests -- without a spreadsheet, a group text, or a whiteboard.';

export default function HandlingMaintenanceRequests() {
  return (
    <>
      <Head>
        <title>{TITLE} | PropAgent AI</title>
        <meta name="description" content={DESC} />
        <link rel="canonical" href={`${SITE_URL}${PATH}`} />
        <meta property="og:type" content="article" />
        <meta property="og:url" content={`${SITE_URL}${PATH}`} />
        <meta property="og:title" content={TITLE} />
        <meta property="og:description" content={DESC} />
      </Head>
      <ArticleLayout
        eyebrow="Maintenance"
        title={TITLE}
        dek="Maintenance is the single most frequent way tenants interact with a property manager. Handle it badly and it's the first thing they mention in a bad review; handle it well and most tenants barely think about it."
        readTime="8 min read"
      >
        <p style={p}>
          Most maintenance problems aren&apos;t about the repair itself -- they&apos;re about communication. A tenant
          who waits three days for a leaky faucet with zero updates is angrier than one who waits five days but got a
          status update on day two. Here&apos;s a system that keeps requests from falling through the cracks.
        </p>

        <h2 style={h2}>1. Give tenants one clear way to report an issue</h2>
        <p style={p}>
          If tenants can report maintenance issues by text, phone call, email, and a paper form taped to the mailbox,
          you will lose track of some of them -- guaranteed. Pick one primary channel (a tenant portal or a single
          phone number) and make sure every tenant knows it at move-in. A single intake point is the single biggest
          lever for not losing requests.
        </p>

        <h2 style={h2}>2. Triage by category and priority immediately</h2>
        <p style={p}>
          Not every request is equal. A reasonable triage split:
        </p>
        <ul style={ul}>
          <li style={li}><strong>Emergency</strong> (no heat in winter, active water leak, no working smoke detector,
            lockout with a safety concern) -- respond within hours, not days.</li>
          <li style={li}><strong>Urgent</strong> (broken appliance, minor leak, AC out in summer) -- respond within
            24–48 hours.</li>
          <li style={li}><strong>Routine</strong> (cosmetic issues, squeaky door, non-urgent repairs) -- scheduled
            within the week.</li>
        </ul>
        <p style={p}>
          Categorizing on intake (plumbing, electrical, HVAC, appliance, general) also helps you route to the right
          vendor immediately instead of figuring it out later.
        </p>

        <h2 style={h2}>3. Assign a vendor -- and keep a real vendor list</h2>
        <p style={p}>
          Have a maintained list of vendors by specialty (plumber, electrician, HVAC, general handyman) with contact
          info, hourly rate, and your own rating of past work, and mark your preferred ones. When a ticket comes in
          categorized as &quot;plumbing,&quot; you should be able to assign it to a qualified vendor in seconds, not
          scroll back through old text threads trying to remember who fixed the last leak.
        </p>

        <h2 style={h2}>4. Update the tenant before they have to ask</h2>
        <p style={p}>
          The single biggest driver of tenant frustration with maintenance isn&apos;t response time -- it&apos;s
          silence. A short status update (&quot;plumber scheduled for Thursday between 2–4pm&quot;) turns a three-day
          wait into a manageable one. If your system logs every status change, sending that update should take
          seconds, not require you to remember to do it.
        </p>

        <h2 style={h2}>5. Track cost and close the loop</h2>
        <p style={p}>
          Record the estimated and actual cost on every ticket. Over a year, this data tells you which vendors are
          worth keeping, which properties are eating an outsized share of your maintenance budget (often a sign of
          deferred capital repairs), and whether your maintenance reserve is realistic.
        </p>

        <h2 style={h2}>6. Do a periodic pattern check</h2>
        <p style={p}>
          If the same unit generates five HVAC tickets in six months, that&apos;s not five separate problems -- it&apos;s
          one underlying issue that keeps getting patched instead of fixed. Look at ticket history by unit
          periodically, not just ticket-by-ticket in isolation.
        </p>

        <h2 style={h2}>7. Set expectations at move-in, not after the first complaint</h2>
        <p style={p}>
          A lot of maintenance friction comes from mismatched expectations rather than the repair itself. At move-in,
          tell tenants exactly how to report an issue, what counts as an emergency versus routine, and roughly how
          long routine requests take. A tenant who knows &quot;non-emergency requests are usually handled within a
          week&quot; is far less frustrated on day four than one who had no idea what to expect.
        </p>

        <h2 style={h2}>Preventive maintenance still matters</h2>
        <p style={p}>
          A reactive-only maintenance process -- fix things only after a tenant reports them -- tends to be more
          expensive over time than one that also schedules basic preventive checks: HVAC filter changes, gutter
          cleaning, water heater inspection, smoke detector battery checks. These don&apos;t need to be elaborate,
          but a simple recurring schedule per property catches small problems before they become expensive
          emergency calls, and in some jurisdictions certain checks (smoke detectors, for example) are a legal
          requirement, not just a best practice.
        </p>

        <h2 style={h2}>How PropAgent AI handles this</h2>
        <p style={p}>
          PropAgent AI&apos;s maintenance module is built around exactly this workflow: tenants (or staff) log a
          ticket with a category and priority, and when a ticket is created, the system automatically tries to
          assign it to a matching vendor from your organization&apos;s vendor list -- preferring vendors you&apos;ve
          marked as preferred and matched by specialty to the ticket&apos;s category. Every ticket tracks status
          (open, in progress, completed) with a real completion date recorded automatically when it&apos;s marked
          done, so cost and turnaround data builds up without extra data entry.
        </p>
        <p style={p}>
          Tenants can also message an AI chat assistant about maintenance questions (status checks, general questions
          about a repair) -- available starting on the Starter plan with a monthly message allowance -- and if a
          tenant&apos;s message needs a human, the property manager gets notified. On Professional and up, an
          automated communications agent can also send maintenance status updates by SMS or email off a template, so
          &quot;update the tenant before they ask&quot; from step 4 above doesn&apos;t rely on someone remembering to
          do it manually.
        </p>
        <Callout>
          Worth knowing: vendor auto-assignment picks the best available match from your vendor list -- it doesn&apos;t
          create or find vendors for you. You still need to build out a real vendor list per specialty for
          auto-assignment to actually route tickets correctly.
        </Callout>

        <p style={p}>
          For the maintenance workflow specifically, plus everything else that comes with it, see the full{' '}
          <Link href="/resources/property-management-software-features" style={a}>feature buying guide</Link> or
          jump to <Link href="/pricing" style={a}>pricing</Link>.
        </p>

        <CTABox
          heading="Stop tracking maintenance in a group text"
          body="Log tickets, auto-assign vendors, and keep tenants updated automatically. Free for 14 days."
        />
      </ArticleLayout>
    </>
  );
}
