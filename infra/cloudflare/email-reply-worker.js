/**
 * Cloudflare Email Worker — Lead CRM automated inbound-reply detection.
 *
 * PropAgent AI's Lead CRM sends outreach emails to prospective SaaS
 * subscribers with a per-lead Reply-To address of the form
 * reply+<lead_id>@propagent.app (see backend/services/lead_service.py's
 * process_outreach_queue). Previously, a reply to one of those emails just
 * landed in a real inbox and a human had to notice it and click "mark
 * replied" in the dashboard by hand — this Worker automates that.
 *
 * What it does, for every piece of mail Cloudflare Email Routing hands it:
 *   1. Always forwards the message to the real inbox first (FORWARD_TO),
 *      so a human can still read it — this Worker must never cause mail
 *      to silently disappear, only add automation on top.
 *   2. If the recipient address matches reply+<uuid>@<domain>, extracts
 *      the lead id and calls the backend's inbound-reply webhook so the
 *      lead gets marked "replied" and the step-2 follow-up (pointing them
 *      at the live demo) gets queued automatically.
 *   3. Any other address (owner@, hello@, catch-all, etc.) just gets
 *      forwarded — no webhook call, since there's no lead id to extract.
 *
 * A failure calling the backend NEVER blocks or reverts the forward —
 * the human-readable copy of the email always gets through regardless of
 * whether the automation succeeded.
 *
 * ---- One-time setup in the Cloudflare dashboard ----
 * 1. Workers & Pages -> Create -> Create Worker. Paste this file's
 *    contents in as the Worker's code (or deploy via `wrangler deploy`
 *    if you have Wrangler set up).
 * 2. Worker -> Settings -> Variables -> add these (mark BACKEND_SECRET
 *    as an encrypted/secret variable, not plain text):
 *      - BACKEND_URL      = https://propagent-api.onrender.com
 *      - BACKEND_SECRET   = <same value you set for EMAIL_WORKER_SECRET
 *                            in Render's environment variables — generate
 *                            a long random string once, use it in both
 *                            places>
 *      - FORWARD_TO       = propagentapp@gmail.com   (or whichever real
 *                            inbox the catch-all currently forwards to)
 * 3. Email Routing -> Routing rules -> edit the Catch-all address rule ->
 *    change its Action from "Send to an email" to "Send to a Worker" ->
 *    select this Worker. (This replaces the direct forward you set up
 *    earlier — the Worker now does that forwarding itself, in step 1
 *    above, so mail delivery keeps working exactly the same either way.)
 * 4. Send a real test reply to a reply+<some-lead-id>@propagent.app
 *    address and confirm both: (a) it still arrives in the real inbox,
 *    and (b) the lead's status flips in the dashboard / you get the
 *    step-2 follow-up queued.
 */

export default {
  async email(message, env, ctx) {
    // Step 1: always forward first. Whatever happens below must never
    // stop this from happening.
    try {
      await message.forward(env.FORWARD_TO);
    } catch (err) {
      console.error(`Failed to forward email to ${env.FORWARD_TO}:`, err);
      // Don't return here -- still attempt the reply-detection logic
      // below in case forwarding failed for an unrelated reason.
    }

    // Step 2: does the recipient match reply+<uuid>@<domain>?
    const to = message.to || "";
    const match = to.match(/^reply\+([0-9a-fA-F-]{36})@/);
    if (!match) {
      return; // Not a tracked reply address -- nothing more to do.
    }
    const leadId = match[1];

    if (!env.BACKEND_URL || !env.BACKEND_SECRET) {
      console.error("BACKEND_URL / BACKEND_SECRET not configured on this Worker -- skipping inbound-reply webhook.");
      return;
    }

    // Step 3: tell the backend a reply came in for this lead.
    try {
      const resp = await fetch(`${env.BACKEND_URL}/internal/email/inbound-reply`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "X-Email-Worker-Secret": env.BACKEND_SECRET,
        },
        body: JSON.stringify({
          lead_id: leadId,
          from: message.from,
        }),
      });
      if (!resp.ok) {
        console.error(`inbound-reply webhook returned ${resp.status}: ${await resp.text()}`);
      }
    } catch (err) {
      console.error("Failed to call inbound-reply webhook:", err);
      // Swallow the error -- the email itself was already forwarded above,
      // so a backend hiccup just means this one reply doesn't
      // auto-update the CRM; it can still be marked replied by hand.
    }
  },
};
