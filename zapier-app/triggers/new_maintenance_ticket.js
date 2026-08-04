const { BASE_URL } = require('../config');

const listMaintenanceTickets = async (z, bundle) => {
  const response = await z.request({
    url: `${BASE_URL}/maintenance`,
    params: { limit: 25 },
  });
  return response.data;
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
