import Head from 'next/head';
import Link from 'next/link';
import ArticleLayout, { h2, p, ul, li, a, Callout, CTABox } from '../../components/ArticleLayout';

const SITE_URL = 'https://propagent.app';
const PATH = '/resources/security-deposit-deductions';
const TITLE = "Security Deposit Deductions: What Landlords Can (and Can't) Charge For";
const DESC = 'The general rule behind security deposit deductions -- damage versus normal wear and tear -- plus why documentation is what actually wins or loses a dispute.';

export default function SecurityDepositDeductions() {
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
        eyebrow="Move-Out & Deposits"
        title={TITLE}
        dek="Most security deposit disputes don't come down to what the law technically allows -- they come down to whether anyone can prove what the unit actually looked like before the tenant moved in."
        readTime="7 min read"
      >
        <p style={p}>
          This is general background on how security deposit deductions typically work, not legal advice for your
          specific situation -- deposit limits, allowed deduction categories, itemization deadlines, and required
          notice all vary by state and sometimes by city, so check your local landlord-tenant law (or a local
          attorney) before making a specific deduction.
        </p>

        <h2 style={h2}>The general principle: damage versus normal wear and tear</h2>
        <p style={p}>
          Across most jurisdictions, the line that determines what&apos;s deductible is the same one: damage caused
          by the tenant&apos;s negligence or misuse is generally deductible, while normal wear and tear from ordinary
          use over time generally isn&apos;t. The distinction sounds simple and gets genuinely blurry in practice --
          a worn patch of carpet after five years of normal foot traffic is wear and tear; a carpet burned by a
          cigarette or soaked through by an unreported leak is damage.
        </p>

        <h2 style={h2}>Typically deductible</h2>
        <ul style={ul}>
          <li style={li}>Holes in walls beyond small nail holes (large holes, unrepaired holes from
            wall-mounted furniture, etc.)</li>
          <li style={li}>Stains, burns, or tears in carpet or flooring beyond what ordinary use would cause</li>
          <li style={li}>Broken fixtures, appliances, or windows not caused by normal aging or a manufacturer
            defect</li>
          <li style={li}>Excessive cleaning required beyond a normal move-out clean (heavy pet odor, significant
            trash left behind)</li>
          <li style={li}>Missing items that were provided with the unit (keys, remotes, fixtures removed
            by the tenant)</li>
        </ul>

        <h2 style={h2}>Typically not deductible</h2>
        <ul style={ul}>
          <li style={li}>Minor scuffs, small nail holes, or faded paint from ordinary sunlight exposure</li>
          <li style={li}>Carpet wear consistent with its age and normal foot traffic</li>
          <li style={li}>Minor scratches on flooring or countertops from ordinary use</li>
          <li style={li}>Appliances or fixtures that failed from age or normal use rather than misuse</li>
          <li style={li}>A standard move-out clean that a reasonable tenant already performed (versus a
            deep clean the landlord would have wanted regardless)</li>
        </ul>

        <h2 style={h2}>Documentation is what actually wins a dispute</h2>
        <p style={p}>
          In practice, most contested deductions aren&apos;t resolved by debating the legal category in the
          abstract -- they&apos;re resolved by whoever has proof of the unit&apos;s actual condition. A landlord with
          timestamped move-in photos showing an already-worn carpet has a much weaker case for deducting carpet
          replacement than one with move-in photos showing new carpet and move-out photos showing burns. Without a
          documented move-in baseline, it&apos;s the landlord&apos;s word against the tenant&apos;s about what
          condition the unit started in -- which is a genuinely weak position regardless of which side is actually
          right.
        </p>
        <Callout>
          The single highest-leverage habit here is doing a real move-in inspection with dated photos, not just a
          move-out one. Most landlords are diligent about documenting move-out condition and much less consistent
          about documenting move-in condition -- but it&apos;s the comparison between the two that actually
          establishes what changed.
        </Callout>

        <h2 style={h2}>Common disputes and how to avoid them</h2>
        <ul style={ul}>
          <li style={li}><strong>Missed the itemization deadline.</strong> Many jurisdictions require an itemized
            list of deductions within a specific number of days after move-out, and missing it can mean forfeiting
            the right to deduct anything at all, regardless of how legitimate the damage is. Know your deadline
            before the tenant moves out, not after.</li>
          <li style={li}><strong>No receipts or repair estimates.</strong> A deduction for &quot;carpet
            replacement, $800&quot; with no invoice or estimate behind it is far easier to successfully dispute than
            one backed by an actual receipt.</li>
          <li style={li}><strong>Charging for normal depreciation.</strong> Charging full replacement cost for a
            10-year-old carpet ignores that it had a limited remaining useful life regardless of the tenant --
            many jurisdictions expect deductions to account for the item&apos;s age and depreciation, not
            full replacement value.</li>
        </ul>

        <h2 style={h2}>How PropAgent AI handles this</h2>
        <p style={p}>
          The Inspection AI agent (Professional plan and up) is built specifically around the move-in/move-out
          comparison problem: each inspection is logged by type (move-in or move-out), with photos attached per room
          or area and an AI-assessed condition and confidence score recorded per photo. Because both inspections are
          timestamped and tied to the same unit, the move-in baseline is there automatically when a move-out dispute
          comes up, instead of depending on whether anyone remembered to take photos eight months earlier. A
          generated inspection report compiles the findings into a PDF for the owner&apos;s or tenant&apos;s records.
        </p>
        <Callout>
          Worth knowing: PropAgent&apos;s inspection agent documents condition -- it doesn&apos;t make the legal
          determination of what&apos;s deductible in your jurisdiction, and it isn&apos;t a substitute for knowing
          your local itemization deadline. That judgment call, like the collections escalation decisions covered in
          the{' '}
          <Link href="/resources/rent-collection-best-practices" style={a}>rent collection guide</Link>, stays with
          you.
        </Callout>
        <p style={p}>
          For the full feature list this is part of, see the{' '}
          <Link href="/resources/property-management-software-features" style={a}>software buying guide</Link>, or
          check <Link href="/pricing" style={a}>pricing</Link> for which plan includes the inspection agent.
        </p>

        <CTABox
          heading="Document every move-in and move-out automatically"
          body="Timestamped photos, AI-assessed condition, and a generated report -- so deposit disputes come down to evidence, not memory. Free for 14 days."
        />
      </ArticleLayout>
    </>
  );
}
