import Head from 'next/head';
import Link from 'next/link';
import ArticleLayout, { h2, p, ul, li, a, Callout, CTABox } from '../../components/ArticleLayout';

const SITE_URL = 'https://propagent.app';
const PATH = '/resources/how-much-does-a-property-manager-cost';
const TITLE = 'How Much Does a Property Manager Cost?';
const DESC = 'A breakdown of typical property management fee structures -- monthly percentage fees, leasing fees, renewal fees -- and how the cost math changes with self-management or AI-assisted software.';

export default function PropertyManagerCost() {
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
        eyebrow="Costs & Fees"
        title={TITLE}
        dek="Traditional property management is usually priced as a percentage of rent collected, not a flat fee -- which means the cost scales with your portfolio in a way that's easy to underestimate until you add it up across a year."
        readTime="7 min read"
      >
        <p style={p}>
          &quot;How much does a property manager cost&quot; doesn&apos;t have one answer, because the industry mostly
          doesn&apos;t price this as a flat fee -- it prices it as a percentage of rent, plus a handful of
          per-transaction fees that aren&apos;t always mentioned up front. Here&apos;s what actually goes into that
          number.
        </p>

        <h2 style={h2}>The core fee: a percentage of monthly rent collected</h2>
        <p style={p}>
          Traditional full-service property management is most commonly priced as a percentage of the rent actually
          collected each month, typically somewhere in the high single digits to low double digits depending on the
          market and how much is included. A few things worth knowing about this structure specifically:
        </p>
        <ul style={ul}>
          <li style={li}><strong>It&apos;s usually based on collected rent, not owed rent</strong> -- so a vacant
            unit or a tenant who didn&apos;t pay that month typically doesn&apos;t generate a management fee, which
            sounds landlord-friendly until you notice it also means the manager has less direct financial incentive
            tied to keeping the unit occupied specifically (their fee is a percentage either way once it&apos;s
            filled).</li>
          <li style={li}><strong>The percentage alone doesn&apos;t tell you what&apos;s included</strong> -- some
            companies bundle tenant communication, maintenance coordination, and basic bookkeeping into that base
            percentage; others charge it separately for each.</li>
        </ul>

        <h2 style={h2}>The fees that aren&apos;t the monthly percentage</h2>
        <p style={p}>
          The line items that most often catch owners off guard aren&apos;t the ongoing monthly fee -- they&apos;re
          the per-event ones:
        </p>
        <ul style={ul}>
          <li style={li}><strong>Leasing / tenant placement fee</strong> -- often a flat fee or a percentage of one
            month&apos;s rent, charged each time a unit is leased to a new tenant. On a portfolio with normal
            turnover, this recurs more often than owners expect.</li>
          <li style={li}><strong>Lease renewal fee</strong> -- a smaller fee, sometimes charged even when an existing
            tenant simply renews and nothing about the unit changes.</li>
          <li style={li}><strong>Maintenance markup</strong> -- a percentage added on top of the actual repair cost
            for coordinating vendors, which is a real cost of the coordination work but compounds with the monthly
            percentage fee on the same portfolio.</li>
          <li style={li}><strong>Setup, inspection, and eviction-processing fees</strong> -- vary widely by company,
            and are worth asking about explicitly rather than assuming they&apos;re bundled.</li>
        </ul>
        <Callout>
          None of this is a criticism of traditional property management -- coordinating vendors, marketing
          vacancies, and handling tenant issues is real work that costs real money to do well. The point is just that
          the all-in cost is rarely the headline percentage alone, so it&apos;s worth asking for a full fee schedule,
          not just the monthly rate, before comparing options.
        </Callout>

        <h2 style={h2}>The alternative: self-managing</h2>
        <p style={p}>
          Self-managing skips the fees entirely, but the cost doesn&apos;t disappear -- it converts into your own
          time. Screening applicants, coordinating maintenance, chasing late rent, and being reachable for tenant
          issues (including outside business hours) is a real, ongoing time commitment that scales with how many
          units you manage and how hands-on your tenants need you to be. For a landlord with one or two units and
          some spare time, that trade can make sense. For a growing portfolio, the time cost usually starts to rival
          or exceed what a management fee would have cost.
        </p>

        <h2 style={h2}>Where AI-assisted software fits between the two</h2>
        <p style={p}>
          Property management software with real automation -- not just a spreadsheet with a nicer interface -- aims
          to take on the recurring, time-consuming parts of self-management (answering routine tenant questions,
          triaging maintenance requests, collecting rent, screening applicants) without the percentage-of-rent fee
          structure a full-service management company charges. It&apos;s not a substitute for a property manager who
          physically visits units or handles in-person showings, but for the communication- and coordination-heavy
          parts of the job, it can meaningfully reduce the time cost of self-managing without taking on a full
          management company&apos;s fee.
        </p>

        <h2 style={h2}>How PropAgent AI is priced</h2>
        <p style={p}>
          PropAgent AI is priced as a flat monthly subscription, not a percentage of rent collected -- Starter at
          $49/mo (up to 3 properties, 25 units), Professional at $149/mo (up to 15 properties, adds Voice AI, an
          inspection agent, and fraud detection), and Enterprise at $499/mo (unlimited properties, portfolio
          dashboard, investment analysis, workflow automation, and API access). There are no leasing fees, renewal
          fees, or maintenance markups added on top -- the subscription price is the price, every month, regardless
          of how many leases turn over. Every plan includes a 14-day free trial with no setup fee.
        </p>
        <p style={p}>
          For a deeper look at what&apos;s actually included at each tier, see the full{' '}
          <Link href="/pricing" style={a}>pricing page</Link>, or the{' '}
          <Link href="/resources/property-management-software-features" style={a}>feature buying guide</Link> for
          what to check regardless of which platform you choose.
        </p>

        <CTABox
          heading="See the flat-rate math for your portfolio"
          body="No percentage-of-rent fees, no leasing fees, no maintenance markups. Free for 14 days."
        />
      </ArticleLayout>
    </>
  );
}
