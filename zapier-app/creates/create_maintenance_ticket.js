const { BASE_URL } = require('../config');

const createMaintenanceTicket = async (z, bundle) => {
  const response = await z.request({
    method: 'POST',
    url: `${BASE_URL}/maintenance`,
    body: {
      property_id: bundle.inputData.property_id,
      title: bundle.inputData.title,
      description: bundle.inputData.description,
      category: bundle.inputData.category || 'other',
      priority: bundle.inputData.priority || 'medium',
    },
  });
  return response.data;
};

module.exports = {
  key: 'create_maintenance_ticket',
  noun: 'Maintenance Ticket',
  display: {
    label: 'Create Maintenance Ticket',
    description: 'Creates a new maintenance ticket in PropAgent AI.',
  },
  operation: {
    inputFields: [
      {
        key: 'property_id',
        label: 'Property',
        required: true,
        type: 'string',
        dynamic: 'property_list.id.name',
        helpText: 'The property this maintenance issue is at.',
      },
      { key: 'title', label: 'Title', required: true, type: 'string' },
      { key: 'description', label: 'Description', required: true, type: 'text' },
      {
        key: 'category',
        label: 'Category',
        required: false,
        type: 'string',
        choices: ['plumbing', 'electrical', 'hvac', 'appliance', 'structural', 'pest_control', 'cleaning', 'landscaping', 'other'],
        default: 'other',
      },
      {
        key: 'priority',
        label: 'Priority',
        required: false,
        type: 'string',
        choices: ['low', 'medium', 'high', 'emergency'],
        default: 'medium',
      },
    ],
    perform: createMaintenanceTicket,
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
