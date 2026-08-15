"""Claude-powered marketing copy generator for PropAgent AI's OWN marketing
(social posts, outreach-email variants, ad copy, blog/content ideas) --
distinct from services/executive_agent.py and inspection_agent.py, which use
OpenAI for in-app, subscriber-facing AI features. This one is purely for the
platform owner's external marketing, triggered on demand from Owner Admin's
Marketing Hub.

Uses the Anthropic Claude API directly (claude-opus-5) rather than OpenAI --
a deliberate choice for this one feature, not a platform-wide model switch.
Empty ANTHROPIC_API_KEY hides the feature entirely rather than faking output.
"""
import logging

from config import settings

logger = logging.getLogger(__name__)

# Real, current facts about the product -- grounds every generation so Claude
# never invents a feature, price, or stat that isn't actually true. Kept in
# one place so it can be updated as the product changes, rather than
# duplicated across prompts. Mirrors what pricing.tsx / security.tsx actually
# claim (audited elsewhere in this codebase to match reality).
PRODUCT_FACTS = """PropAgent AI is a property management SaaS platform. Real facts to draw from -- never invent numbers, features, or claims beyond these:
- Plans: Starter $49/mo (3 properties, 25 units, 3 team members), Professional $149/mo (15 properties, 150 units, Voice AI call center, Executive AI Assistant, Inspection AI, Fraud detection), Enterprise $499/mo (unlimited, Portfolio Dashboard, Investment Analysis, workflow automation, API access)
- Real features: AI tenant chat (24/7), maintenance auto-ticketing + vendor dispatch, AI leasing/tour booking for prospective tenants, automated screening recommendations, online rent payments via Stripe, e-signature leases, Voice AI phone answering
- 14-day free trial, no setup fees, cancel anytime
- Business: PropAgent, 9169 W State St #3241, Garden City, ID 83714
- Website: propagent.app
Do not claim specific customer counts, revenue figures, or testimonials -- none of those exist yet as verifiable numbers. Do not claim SOC 2/HIPAA/PCI compliance -- not certified."""

COPY_TYPES = {
    "social_post": (
        "Write 3 distinct social media post variants (LinkedIn/Facebook style, 2-4 sentences each) "
        "promoting PropAgent AI. Each should lead with a real pain point a property manager has, "
        "not a generic feature list. No hashtag spam, no more than one emoji per post if any. "
        "End each with a soft call to action (free trial, propagent.app)."
    ),
    "outreach_variant": (
        "Write 2 alternate opening lines (1-2 sentences each) for a cold B2B outreach email to a "
        "property management company, pitching PropAgent AI. Must NOT sound like a mass blast -- "
        "specific, direct, no corporate buzzwords ('synergy', 'leverage', 'revolutionize'). "
        "Each should hook on a different real pain point (after-hours tenant calls, maintenance "
        "coordination chaos, manual screening)."
    ),
    "ad_copy": (
        "Write 3 short ad copy variants (headline + 1-sentence body, suitable for a Google/LinkedIn "
        "ad) for PropAgent AI. Headlines under 8 words. No superlatives that can't be backed up "
        "('best', '#1', 'revolutionary')."
    ),
    "blog_ideas": (
        "Suggest 5 blog/content article title ideas that would genuinely help a property manager "
        "(not just PropAgent AI marketing) and would plausibly rank for real search terms they'd "
        "type into Google. For each, give the title and a one-sentence description of what the "
        "article would actually cover."
    ),
}


class MarketingCopyError(Exception):
    """Raised when generation fails -- caller surfaces this as a clean error,
    never a fabricated fallback."""


async def generate_marketing_copy(copy_type: str, extra_context: str = "") -> str:
    """Generate marketing copy of the given type via Claude. Returns the raw
    text response. Raises MarketingCopyError on any failure (missing key,
    API error) -- callers must not silently swallow this into empty output."""
    if not settings.ANTHROPIC_API_KEY:
        raise MarketingCopyError("ANTHROPIC_API_KEY is not configured")

    instruction = COPY_TYPES.get(copy_type)
    if not instruction:
        raise MarketingCopyError(f"Unknown copy_type: {copy_type!r}")

    user_content = instruction
    if extra_context.strip():
        # Free-text steer from the admin, e.g. "focus on multi-family
        # landlords" or "tie this to the new Voice AI number addon" --
        # appended, never allowed to override the grounding facts above.
        user_content += f"\n\nAdditional direction from the marketer: {extra_context.strip()[:500]}"

    try:
        from anthropic import AsyncAnthropic
        # timeout=60: fail fast and clean rather than risk a long hang on a
        # single-worker server -- the SDK default is 10 minutes, far too
        # long for a request a human is waiting on in the dashboard.
        client = AsyncAnthropic(api_key=settings.ANTHROPIC_API_KEY, timeout=60.0)
        response = await client.messages.create(
            model="claude-opus-5",
            max_tokens=1500,
            # Claude Opus 5 runs adaptive thinking by default (unlike prior
            # Opus versions, where omitting `thinking` meant none) -- and
            # max_tokens caps thinking + text together. For quick, shallow
            # copywriting like this, thinking adds latency and eats into
            # the budget for no real quality gain, and was risking the
            # visible text getting truncated or empty. Disabled explicitly
            # (allowed at the default effort level of "high" or below).
            thinking={"type": "disabled"},
            system=PRODUCT_FACTS,
            messages=[{"role": "user", "content": user_content}],
        )
        text = "".join(block.text for block in response.content if block.type == "text").strip()
        if not text:
            raise MarketingCopyError(f"Claude returned an empty response (stop_reason={response.stop_reason})")
        return text
    except MarketingCopyError:
        raise
    except Exception as e:
        logger.error(f"Claude marketing copy generation failed (type={copy_type}): {e}")
        raise MarketingCopyError(str(e)) from e
