import Head from 'next/head';
import Link from 'next/link';
import ArticleLayout, { h2, p, ul, li, a, Callout, CTABox } from '../../components/ArticleLayout';

const SITE_URL = 'https://propagent.app';
const PATH = '/resources/how-to-screen-tenants';
const TITLE = 'How to Screen Tenants: A Practical, Fair Process';
const DESC = 'A step-by-step tenant screening process for landlords and property managers -- what to check, in what order, and how to stay consistent from one applicant to the next.';

export default function HowToScreenTenants() {
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
        eyebrow="Tenant Screening"
        title={TITLE}
        dek="A bad tenant placement is expensive -- lost rent, eviction costs, and property damage. A good screening process is mostly about doing the same handful of checks, in the same order, for every applicant."
        readTime="9 min read"
      >
        <p style={p}>
          Tenant screening isn&apos;t complicated in theory: verify the person can afford the rent, verify they&apos;ve
          paid rent reliably before, and verify they are who they say they are. What actually causes screening to go
          wrong in practice is inconsistency -- checking three things for one applicant and five for another, making
          exceptions under time pressure, or deciding based on a gut feeling instead of documented criteria. This
          guide walks through a process that avoids that.
        </p>

        <h2 style={h2}>1. Set your criteria before you have an applicant</h2>
        <p style={p}>
          Decide your minimum bar in writing, before you&apos;re looking at a real person&apos;s application. Common
          criteria:
        </p>
        <ul style={ul}>
          <li style={li}><strong>Income-to-rent ratio.</strong> Most landlords require gross income of roughly 2.5–3x the
            monthly rent. Below 3x is a soft yellow flag; below 2.5x is usually a hard no unless there&apos;s a
            guarantor.</li>
          <li style={li}><strong>Credit score floor.</strong> Commonly somewhere around 600–650, though this varies a lot
            by market and rent level.</li>
          <li style={li}><strong>Employment status.</strong> Steady employment, self-employment with documented income, or
            a guarantor.</li>
          <li style={li}><strong>Rental history.</strong> No prior evictions, and positive references from at least one
            previous landlord.</li>
        </ul>
        <p style={p}>
          The reason to fix these numbers ahead of time is legal as much as practical: in most places you&apos;re
          required to apply the same screening standard to every applicant regardless of race, religion, national
          origin, sex, familial status, disability, or other protected characteristics under fair housing law. Written
          criteria, applied consistently, is your best evidence that a decision was made on the numbers -- not on the
          applicant. This article is general information, not legal advice; fair housing rules have state and local
          variations, so when in doubt, check your local landlord-tenant statutes or talk to a local attorney.
        </p>

        <h2 style={h2}>2. Get a complete application before you screen anything</h2>
        <p style={p}>
          Screening a partial application wastes everyone&apos;s time. A complete application should include: full
          legal name and date of birth, current and previous address, employer and income (with a recent pay stub or
          offer letter), at least one previous landlord reference, and signed consent for a credit and background
          check. Requiring consent up front, in writing, also keeps you compliant with the Fair Credit Reporting Act
          if you&apos;re pulling a credit report through a screening service.
        </p>

        <h2 style={h2}>3. Verify income and employment</h2>
        <p style={p}>
          Don&apos;t just read the number on the application -- verify it. A recent pay stub, an offer letter, or a
          quick call to the employer&apos;s HR line confirms the applicant is actually employed and actually earns
          what they claim. For self-employed applicants, ask for the last two years of tax returns or bank
          statements; income verification is harder here but shouldn&apos;t be skipped just because it&apos;s more
          work.
        </p>

        <h2 style={h2}>4. Run a credit and background check</h2>
        <p style={p}>
          Use a legitimate tenant screening service (not a general consumer credit-check site) so the report is
          FCRA-compliant and the applicant&apos;s consent is properly on file. Look at more than just the score: an
          800 credit score with $40,000 in collections tells a different story than a 620 score with a thin, clean
          file. Check for evictions specifically -- a low credit score from medical debt is a very different risk
          signal than a prior eviction filing.
        </p>

        <h2 style={h2}>5. Call the references</h2>
        <p style={p}>
          A previous landlord will usually tell you more in a two-minute phone call than any document will: did they
          pay on time, did they take care of the unit, would you rent to them again. Be skeptical of a reference
          that&apos;s actually a friend posing as a landlord -- cross-check the phone number against public property
          records if something feels off.
        </p>

        <h2 style={h2}>6. Score it the same way every time, and write down why</h2>
        <p style={p}>
          Whatever your criteria are, apply them the same way to every applicant and keep a short written record of
          why each applicant was approved or declined. This protects you if a decision is ever questioned, and it
          also just makes you a better, more consistent screener over time.
        </p>

        <h2 style={h2}>7. Tell the applicant the outcome, promptly</h2>
        <p style={p}>
          Whether it&apos;s a yes or a no, respond quickly -- applicants are usually looking at multiple units and
          will move on. If you decline based on information in a credit or background report, you&apos;re generally
          required to send an <em>adverse action notice</em> telling them so and naming the reporting agency, per the
          FCRA. Most tenant screening services generate this notice for you automatically.
        </p>

        <h2 style={h2}>Where AI screening tools fit in</h2>
        <p style={p}>
          PropAgent AI&apos;s screening tool doesn&apos;t replace steps 2–5 above -- it still needs a real credit
          score, real income figures, and real reference information as input. What it does is apply your criteria
          consistently and instantly: it takes an applicant&apos;s annual income, credit score, employment status,
          and references, checks the income-to-rent ratio against the unit&apos;s actual rent on their lease (not a
          guessed number), scores credit in bands, and flags employment risk -- then returns a 0–100 score, an
          approve/decline recommendation, and a plain-language report explaining exactly which factors drove the
          score. That report is what you&apos;d hand to a fair housing inquiry as evidence the decision was
          criteria-based, not personal.
        </p>
        <Callout>
          One honest limitation worth knowing: PropAgent&apos;s screening tool currently scores an applicant against
          the rent on their actual signed or active lease -- it&apos;s built for evaluating someone you&apos;re about
          to convert from applicant to tenant, not a cold walk-in with no unit assigned yet. For screening a rental
          inquiry before a lease exists, the inquiry-to-lease workflow captures the same income/credit/employment
          fields against the unit&apos;s listed rent instead.
        </Callout>
        <p style={p}>
          It&apos;s a decision-support tool, not a replacement for your judgment -- and it won&apos;t catch things a
          phone call with a previous landlord will, like &quot;paid on time but the unit smelled like a dozen cats.&quot;
          Treat the score as one consistent input alongside the reference calls, not the whole decision.
        </p>

        <p style={p}>
          If you&apos;re managing screening, leases, maintenance, and rent collection across a growing portfolio and
          it&apos;s all still living in spreadsheets and email, see how PropAgent AI&apos;s{' '}
          <Link href="/resources/property-management-software-features" style={a}>full feature set</Link> compares
          to what you&apos;re using today, or how it stacks up on our{' '}
          <Link href="/compare" style={a}>comparison page</Link>.
        </p>

        <CTABox
          heading="See tenant screening in PropAgent AI"
          body="Try the screening tool, lease workflow, and the rest of PropAgent AI free for 14 days -- no setup fees, cancel anytime."
        />
      </ArticleLayout>
    </>
  );
}
