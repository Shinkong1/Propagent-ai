import Head from 'next/head';
import Link from 'next/link';
import ArticleLayout, { h2, p, ul, li, a, Callout, CTABox } from '../../components/ArticleLayout';

const SITE_URL = 'https://propagent.app';
const PATH = '/resources/ai-in-property-management';
const TITLE = "AI in Property Management: What It Can (and Can't) Do Well";
const DESC = 'A plain, non-hype explanation of what AI actually does in modern property management software -- tenant chat, screening, inspections, voice calls -- and where it still needs a human.';

export default function AIInPropertyManagement() {
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
        eyebrow="AI & Automation"
        title={TITLE}
        dek="Every property management vendor says 'AI-powered' now, including us. This is an attempt to explain, specifically and honestly, what that means in practice -- the genuinely useful parts and the parts that are still marketing."
        readTime="9 min read"
      >
        <p style={p}>
          &quot;AI-powered property management&quot; can mean almost anything, from a genuinely useful automated
          workflow to a chatbot bolted onto an old product for the press release. Rather than make a general claim
          either way, here&apos;s a breakdown of the specific things AI is actually doing in tools like this one
          today, and where it falls short.
        </p>

        <h2 style={h2}>What AI is genuinely good at here</h2>

        <p style={p}><strong>Answering repetitive tenant questions.</strong> &quot;What&apos;s the status of my
          maintenance ticket,&quot; &quot;when is rent due,&quot; &quot;what&apos;s the office number&quot; -- these
          are the same handful of questions asked constantly, with answers that live in structured data (a ticket
          status, a lease record). A language model connected to that data can answer instantly and correctly,
          around the clock, which is a real win for both the tenant (no waiting for office hours) and the property
          manager (fewer interruptions for routine questions).</p>

        <p style={p}><strong>Drafting documents from templates and real data.</strong> A lease renewal letter or a
          late notice follows a predictable structure with a few variables (tenant name, dates, amounts) filled in
          from your actual records. AI is reliable at this because it&apos;s closer to templated document generation
          than open-ended writing -- and a human still reviews it before it goes out.</p>

        <p style={p}><strong>Consistent, structured scoring.</strong> Tenant screening is a good example: income,
          credit score, and employment status run through the same rules every time, which is exactly what software
          is better at than a tired human at 6pm on a Friday. The value of AI/software here isn&apos;t judgment --
          it&apos;s consistency and speed.</p>

        <p style={p}><strong>First-pass image analysis.</strong> A vision model looking at an inspection photo can
          flag &quot;this looks like water damage&quot; or &quot;this looks like a crack in the drywall&quot; and
          estimate severity, which is useful as a first pass on a big batch of move-out photos. It is not a
          replacement for a human inspector&apos;s final judgment, and a reasonable implementation should say so
          when it&apos;s not confident -- rather than guess.</p>

        <p style={p}><strong>Answering and routing phone calls.</strong> A voice AI system can answer an incoming
          call, understand what the caller needs (maintenance, a question about a listing, an emergency), and either
          handle it or route/log it -- useful for after-hours calls or high call volume, where the alternative is
          voicemail nobody checks.</p>

        <p style={p}><strong>Spotting patterns across a portfolio.</strong> A duplicate application submitted under
          two slightly different names, an income figure that doesn&apos;t match the applicant&apos;s stated
          employer, a payment pattern that looks unusual for that tenant -- these are the kind of anomalies that are
          tedious for a person to notice across dozens or hundreds of records, but straightforward for software to
          flag automatically for a human to look into.</p>

        <h2 style={h2}>Where AI is more limited than the marketing suggests</h2>

        <ul style={ul}>
          <li style={li}><strong>Judgment calls with legal exposure.</strong> Whether to approve a borderline
            applicant, how to handle a habitability dispute, whether a lease violation justifies eviction -- these
            need a human who understands the specific situation and local law. A score or a draft is an input to
            that decision, not the decision itself.</li>
          <li style={li}><strong>Anything the underlying data doesn't have.</strong> An AI assistant can only answer
            correctly about what's actually in your system. If a maintenance ticket was updated by a phone call that
            never got logged, the AI will confidently tell a tenant outdated information -- not because it's
            "hallucinating" but because its source of truth is stale. Garbage in, garbage out still applies.</li>
          <li style={li}><strong>Reading a room.</strong> A frustrated, upset tenant on a difficult call often needs a
            person who can adapt tone and make a judgment call about when to escalate -- not a script, however
            well-tuned. Good voice AI implementations should recognize this and hand off, rather than push through.</li>
          <li style={li}><strong>Photo analysis without a real photo.</strong> Vision-based damage detection is only
            as good as the photo -- bad lighting, a blurry shot, or an angle that doesn&apos;t show the actual issue
            will produce a low-confidence or wrong result. This is a real, current limitation, not a hypothetical
            one.</li>
        </ul>

        <Callout>
          A useful test when evaluating any &quot;AI-powered&quot; claim: ask what happens when the AI isn&apos;t
          confident. A system that always gives a definitive answer regardless of certainty is worse than one that
          says &quot;needs manual review&quot; when it should. PropAgent&apos;s inspection photo analysis, for
          example, explicitly returns a &quot;needs manual review&quot; state rather than forcing a guess when it
          can&apos;t assess a photo confidently.
        </Callout>

        <h2 style={h2}>What this looks like in PropAgent AI specifically</h2>
        <p style={p}>
          To be concrete rather than abstract: PropAgent AI&apos;s AI features are a tenant chat assistant that
          answers maintenance and lease questions from your real data (available from the Starter plan, with a
          monthly message allowance), an executive AI assistant for portfolio-level questions, AI-drafted lease and
          notice generation, AI inspection photo analysis, a voice AI call center that answers and routes calls, and
          a fraud/risk detection agent that flags anomalies like duplicate applications or unusual payment patterns
          for a human to review (the last four are Professional plan and up). None of these make final decisions
          autonomously -- they draft, flag, score, and answer questions, and a person stays in the loop for anything
          consequential. That&apos;s a deliberate choice, not a current limitation we&apos;re apologizing for.
        </p>
        <p style={p}>
          For the exact feature list and which plan each one is available on, see{' '}
          <Link href="/pricing" style={a}>pricing</Link>, or read how these features compare to traditional property
          management software on our <Link href="/compare" style={a}>comparison page</Link>.
        </p>

        <CTABox
          heading="See the AI features in action"
          body="Try the tenant chat assistant, screening tool, and maintenance workflow yourself -- free for 14 days."
        />
      </ArticleLayout>
    </>
  );
}
