import Head from 'next/head';
import Link from 'next/link';
import ArticleLayout, { h2, p, ul, li, a, Callout, CTABox } from '../../components/ArticleLayout';

const SITE_URL = 'https://propagent.app';
const PATH = '/resources/rent-collection-best-practices';
const TITLE = 'Rent Collection Best Practices: A Guide for Landlords';
const DESC = 'How to set up a rent collection process that gets paid on time more often -- online payments, late fee policy, and a consistent escalation process for when rent is late.';

export default function RentCollectionBestPractices() {
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
        eyebrow="Rent Collection"
        title={TITLE}
        dek="Most late rent isn't a tenant trying to get away with something -- it's a mix of forgetting, a friction-filled payment process, and no consistent follow-up. Fix the process and a lot of the late payments fix themselves."
        readTime="8 min read"
      >
        <p style={p}>
          Chasing down late rent is one of the least enjoyable parts of managing property, and it&apos;s also one of
          the most fixable with the right process. This isn&apos;t about being harsher with tenants -- it&apos;s about
          removing friction from paying on time and being predictable and consistent when they don&apos;t.
        </p>

        <h2 style={h2}>Make paying on time the path of least resistance</h2>
        <p style={p}>
          If paying rent means writing a check, finding an envelope, finding a stamp, and remembering to mail it
          three days early, you&apos;ve built friction into the one transaction you most want to be frictionless.
          Online rent payment removes almost all of that: a tenant pays from their phone in under a minute, and the
          payment is timestamped automatically, so there&apos;s no dispute about when it was sent versus when it was
          received. If you&apos;re not offering an online payment option yet, it&apos;s usually the single highest-
          leverage change you can make to on-time payment rates.
        </p>

        <h2 style={h2}>Set a clear, written late fee policy -- and apply it consistently</h2>
        <p style={p}>
          Your lease should spell out exactly when rent is due, the grace period (if any), and the exact late fee
          (flat dollar amount or percentage) once that grace period passes. Then apply it the same way every time.
          Inconsistent enforcement -- waiving it for one tenant, charging it for another -- creates both resentment
          and, in some jurisdictions, legal risk. Check your local landlord-tenant law for any caps on late fee
          amounts before you set the number; some states and cities regulate this.
        </p>

        <h2 style={h2}>Use a staged escalation process, not an all-or-nothing one</h2>
        <p style={p}>
          Jumping straight from &quot;rent is late&quot; to &quot;eviction notice&quot; is both harsh and usually
          unnecessary -- most late payments get resolved with a nudge. A reasonable staged approach:
        </p>
        <ul style={ul}>
          <li style={li}><strong>A day or two after due date:</strong> a friendly reminder -- most people just forgot.</li>
          <li style={li}><strong>Once the grace period passes:</strong> apply the late fee per your lease, and notify
            the tenant it&apos;s been applied.</li>
          <li style={li}><strong>A week or so later:</strong> offer a payment plan if it&apos;s a tenant with an
            otherwise good history -- this often resolves things faster than continued escalation.</li>
          <li style={li}><strong>Beyond that:</strong> notify whoever manages the property (owner, manager) so it&apos;s
            not silently sitting unresolved, and begin preparing the legal process required in your jurisdiction if
            it isn&apos;t resolved.</li>
        </ul>
        <p style={p}>
          The exact day thresholds are yours to set, but having <em>any</em> defined staging -- instead of deciding
          case-by-case when to act -- means tenants are treated consistently and nothing sits forgotten for a month.
        </p>

        <h2 style={h2}>Keep a record of every collection action</h2>
        <p style={p}>
          If a late-payment situation ever escalates to a legal process, a documented timeline (reminder sent on X,
          late fee applied on Y, payment plan offered on Z) is exactly what you&apos;ll need. Don&apos;t rely on
          memory or a scattered text thread -- log every action against the specific payment it relates to.
        </p>

        <h2 style={h2}>Make rent due dates and amounts unambiguous</h2>
        <p style={p}>
          A surprising amount of "late" rent is actually a confusion problem, not a payment problem: a tenant unsure
          whether rent was due on the 1st or the 5th, or unsure whether a partial payment from last month changed
          this month&apos;s amount due. State the due date, the exact amount, and any outstanding balance clearly and
          consistently every month, ideally somewhere the tenant can check themselves rather than needing to ask.
        </p>

        <h2 style={h2}>Consider partial payments carefully</h2>
        <p style={p}>
          Deciding in advance whether you&apos;ll accept partial rent payments -- and if so, how that affects late
          fees and any pending legal process -- avoids an awkward case-by-case negotiation in the moment. In some
          jurisdictions, accepting a partial payment can affect your legal standing in an eviction proceeding, so
          this is worth understanding for your specific location before you're in the middle of a late-rent
          situation, not during it.
        </p>

        <h2 style={h2}>How PropAgent AI handles this</h2>
        <p style={p}>
          Tenants can pay rent directly from their tenant portal via Stripe -- card details go straight to
          Stripe&apos;s hosted checkout, never through PropAgent&apos;s own servers, and the payment is recorded
          automatically the moment it clears. On the collections side (Professional plan and up), PropAgent&apos;s
          collections agent computes an overdue-rent queue automatically: it checks how many days overdue each unpaid
          payment is against day-thresholds you set (reminder, late fee, payment plan offer, manager notification,
          legal prep) and tells you exactly which stage each overdue payment has hit and why, including the suggested
          late fee amount calculated from your configured percentage. Every action you take against a payment --
          reminder sent, late fee applied, plan offered -- gets logged to that payment&apos;s history automatically,
          which is the documented timeline referenced above without extra paperwork.
        </p>
        <Callout>
          Worth knowing: the collections agent surfaces recommendations and computes the queue -- it doesn&apos;t
          auto-send legal notices or take irreversible action on its own. Applying a late fee, offering a plan, or
          moving to legal prep is still a step you take, which is deliberate, since these actions can have real legal
          consequences and thresholds vary by jurisdiction.
        </Callout>
        <p style={p}>
          Online rent payment and automated collections tracking are just part of the picture -- see the{' '}
          <Link href="/resources/property-management-software-features" style={a}>full feature buying guide</Link>{' '}
          for what else to look for, or check <Link href="/pricing" style={a}>pricing</Link> for exactly which plan
          includes collections automation.
        </p>

        <CTABox
          heading="Get paid on time, more often"
          body="Online rent payments and automated collections tracking, built in. Free for 14 days."
        />
      </ArticleLayout>
    </>
  );
}
