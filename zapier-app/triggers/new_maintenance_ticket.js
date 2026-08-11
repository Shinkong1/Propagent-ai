const { BASE_URL } = require('../config');

const listMaintenanceTickets = async (z, bundle) => {
  // z.cursor persists a small string between polling runs -- we use it to
  // remember the newest created_at we've already seen, so a poll after a
  // burst of >25 new tickets doesn't silently skip the older ones in that
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
    url: `${BASE_URL}/maintenance`,
    params: { limit: 25, ...(since ? { since } : {}) },
  });
  const tickets = response.data;
  if (tickets.length > 0) {
    // Backend returns newest-first, so the first item is the new high-water mark.
    try {
      await z.cursor.set(tickets[0].created_at);
    } catch (e) {
      // best-effort -- ignore, next poll just falls back to "last 25" again
    }
  }
  return tickets;
};

module.exports = {
  key: 'new_maintenance_ticket',
  noun: 'Maintenance Ticket',
  display: {
    label: 'New Maintenance Ticket',
    description: 'Triggers when a new maintenance ticket is created in PropAgent AI (including ones filed by the AI voice/chat agents).',
  },
  operation: {
    type: 'polling',
    perform: listMaintenanceTickets,
    sample: {
      id: '33333333-3333-3333-3333-333333333333',
      property_id: '44444444-4444-4444-4444-444444444444',
      title: 'Leaking kitchen faucet',
      description: 'Tenant reports a steady drip under the kitchen sink.',
      category: 'plumbing',
      priority: 'medium',
      status: 'open',
      created_at: '2026-08-01T12:00:00Z',
    },
  },
};
