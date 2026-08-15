import Head from 'next/head';
import Link from 'next/link';
import ArticleLayout, { h2, p, ul, li, a, Callout, CTABox } from '../../components/ArticleLayout';

const SITE_URL = 'https://propagent.app';
const PATH = '/resources/property-management-software-features';
const TITLE = 'Property Management Software Features to Look For (Buying Guide)';
const DESC = 'What to actually check before picking property management software -- the features that matter for a small-to-midsize portfolio, and the ones that are usually just marketing noise.';

export default function FeaturesBuyingGuide() {
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
        eyebrow="Buying Guide"
        title={TITLE}
        dek="Every property management platform's homepage looks the same: 'all-in-one,' 'streamline everything,' 'powered by AI.' Here's what to actually check under the hood before you sign a contract."
        readTime="10 min read"
      >
        <p style={p}>
          Picking property management software is a bigger commitment than it looks -- your tenant data, lease
          history, and financial records live in it, and switching later is genuinely painful. This guide skips the
          marketing copy and lists the specific things worth checking, organized by what actually affects your
          day-to-day work.
        </p>

        <h2 style={h2}>The core operational features (table stakes)</h2>
        <p style={p}>
          These should be non-negotiable in any platform you consider, regardless of price:
        </p>
        <ul style={ul}>
          <li style={li}><strong>Property and unit tracking</strong> -- properties, units, and their status (vacant,
            occupied, under renovation) in one place, not a spreadsheet next to the software.</li>
          <li style={li}><strong>Tenant and lease records</strong> -- lease terms, rent amount, move-in/move-out dates,
            and renewal tracking.</li>
          <li style={li}><strong>Maintenance ticket tracking</strong> -- tenants or staff can log an issue, it gets a
            status and priority, and it's assigned to someone (staff or a vendor) until it's closed.</li>
          <li style={li}><strong>Document storage and search</strong> -- leases, inspection reports, and vendor
            invoices need to be findable months later, not buried in an inbox.</li>
          <li style={li}><strong>Rental inquiry and prospect tracking</strong> -- a record of who inquired about a
            vacancy, what unit, and whether they converted to an applicant.</li>
        </ul>
        <p style={p}>
          If a platform doesn&apos;t cleanly do these five things, nothing else about it matters. Ask for a live demo
          of each, not a slide with a checkmark next to it.
        </p>

        <h2 style={h2}>Rent collection and accounting</h2>
        <p style={p}>
          Check specifically whether tenants can pay rent online (and through what processor -- this affects fees and
          how fast money actually lands in your account), whether the platform tracks late/overdue rent
          automatically, and whether it produces real financial reports (income, expenses, by property) rather than
          just a raw transaction list you have to export and rebuild in a spreadsheet.
        </p>

        <h2 style={h2}>Communication tools</h2>
        <p style={p}>
          Ask whether tenant communication (rent reminders, maintenance updates, lease renewal notices, emergency
          announcements) happens inside the platform with a record kept, or whether you&apos;re still expected to do
          it by personal email and text with no log of what was sent to whom. A searchable communication history
          matters more than it seems until you need it -- for a dispute, an eviction filing, or just remembering what
          you told someone last month.
        </p>

        <h2 style={h2}>Where "AI-powered" claims deserve scrutiny</h2>
        <p style={p}>
          A huge share of property management software now claims to be AI-powered. Before that swings your decision,
          ask specifically <em>what</em> the AI does, because the honest answer is usually one of a few narrow, real
          things -- not a general-purpose robot manager:
        </p>
        <ul style={ul}>
          <li style={li}><strong>Answering common tenant questions</strong> (maintenance status, lease details, rent
            due dates) via chat, so a human isn&apos;t typing the same answer for the fifth time this week.</li>
          <li style={li}><strong>Drafting documents</strong> -- lease renewal letters, late notices -- from a template
            and your actual data, for a human to review before sending.</li>
          <li style={li}><strong>Scoring or flagging</strong> -- tenant screening risk, overdue-rent escalation, photo
            damage detection during inspections -- narrow, specific tasks with a defined input and output.</li>
          <li style={li}><strong>Answering a phone call</strong> and routing it or logging the reason for the call.</li>
        </ul>
        <p style={p}>
          If a sales rep can&apos;t describe what their AI actually does in one of those concrete terms, be skeptical.
          We wrote a longer, non-hype breakdown of this in{' '}
          <Link href="/resources/ai-in-property-management" style={a}>AI in Property Management: What It Can and Can&apos;t Do</Link>.
        </p>

        <h2 style={h2}>Pricing model</h2>
        <p style={p}>
          Two common models: flat monthly tiers (a set price per plan, regardless of exact unit count within a range)
          and per-unit pricing (a price multiplied by every unit you manage, which scales up fast as your portfolio
          grows). Neither is inherently better, but you should know which one you&apos;re signing up for and do the
          math on your actual unit count -- per-unit pricing that looks cheap at 20 units can be considerably more
          expensive at 150.
        </p>

        <h2 style={h2}>Team access and permissions</h2>
        <p style={p}>
          If you work with any staff -- a leasing agent, a bookkeeper, an assistant property manager -- check how
          many team seats are included at each pricing tier and whether you can limit what each person can see or
          do. A platform that charges per seat, or caps team members tightly on its entry plan, is a real
          constraint worth knowing before you commit, not something to discover after your team has grown into it.
        </p>

        <h2 style={h2}>Onboarding and contract terms</h2>
        <p style={p}>
          Ask directly: is there a setup fee, what&apos;s the minimum contract length, and is there a free trial long
          enough to actually test the product with real data (a few days is rarely enough; two weeks is more
          realistic). Legacy enterprise-oriented platforms often involve longer contracts and a paid onboarding
          process; newer, self-serve platforms more often let you sign up and start immediately, for better or
          worse depending on how much hand-holding you want.
        </p>

        <h2 style={h2}>Integrations and API access</h2>
        <p style={p}>
          If you use other tools -- accounting software, a listing syndication service, a custom internal dashboard
          -- check whether the platform offers a real API you can build against, versus vague &quot;custom
          integrations&quot; language that really means &quot;talk to sales and we&apos;ll see.&quot; A documented
          REST API with an example request you can run in five minutes is a good sign the integration story is real.
        </p>

        <h2 style={h2}>What PropAgent AI actually offers</h2>
        <p style={p}>
          In the interest of being straightforward: PropAgent AI covers the core operational features above at every
          plan tier (properties/units, tenants and leases, maintenance ticket tracking with vendor assignment,
          document uploads and search, and rental inquiry tracking), plus AI chat support for tenant questions. On
          Professional and up, it adds a voice AI call center, an executive AI assistant, AI-drafted lease and notice
          generation, AI inspection photo damage detection, and automated collections/compliance/communications
          agents. Enterprise adds a portfolio dashboard across properties, investment analysis, pricing intelligence,
          predictive insights, no-code workflow automation, and API access. The full, current breakdown (including
          what&apos;s <em>not</em> included at each tier) is on our{' '}
          <Link href="/pricing" style={a}>pricing page</Link>, and a feature-by-feature comparison against
          traditional platforms and running things manually is on our{' '}
          <Link href="/compare" style={a}>comparison page</Link>.
        </p>
        <Callout>
          Whatever platform you evaluate -- including this one -- ask for a trial account and actually create a
          property, log a maintenance ticket, and run a tenant through screening before you commit. A demo video
          controlled by a salesperson tells you much less than ten minutes in the real product.
        </Callout>

        <CTABox
          heading="Try it yourself, not just the demo"
          body="14-day free trial, no setup fees. Create a property and a maintenance ticket and see how it actually works."
        />
      </ArticleLayout>
    </>
  );
}
