const { BASE_URL } = require('../config');

const listLeads = async (z, bundle) => {
  // z.cursor persists a small string between polling runs -- we use it to
  // remember the newest created_at we've already seen, so a poll after a
  // burst of >25 new leads doesn't silently skip the older ones in that
  // burst (plain "last 25, dedupe by id" would miss them). Best-effort only:
  // confirmed in testing that Zapier's RPC/cursor storage can be unreachable
  // ("RPC request failed after 3 attempts") even in production, so a cursor
  // failure must never take down the whole trigger -- fall back to a plain
  // "last 25" poll instead.
  let since;
  try {
    since = await z.cursor.get();
  } catch (e) {
    since = null;
  }
  const response = await z.request({
    url: `${BASE_URL}/leads`,
    params: { limit: 25, ...(since ? { since } : {}) },
  });
  const leads = response.data;
  if (leads.length > 0) {
    // Backend returns newest-first, so the first item is the new high-water mark.
    try {
      await z.cursor.set(leads[0].created_at);
    } catch (e) {
      // best-effort -- ignore, next poll just falls back to "last 25" again
    }
  }
  return leads;
};

module.exports = {
  key: 'new_lead',
  noun: 'Lead',
  display: {
    label: 'New Lead',
    description: 'Triggers when a new lead is added in PropAgent AI (from lead scraping, the website, or manual entry).',
  },
  operation: {
    type: 'polling',
    perform: listLeads,
    sample: {
      id: '11111111-1111-1111-1111-111111111111',
      first_name: 'Jane',
      last_name: 'Doe',
      company: null,
      email: 'jane@example.com',
      phone: '+15551234567',
      source: 'website',
      status: 'new',
      score: 42,
      created_at: '2026-08-01T12:00:00Z',
    },
  },
};
