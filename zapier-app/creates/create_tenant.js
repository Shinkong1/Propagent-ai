const { BASE_URL } = require('../config');

const createTenant = async (z, bundle) => {
  const response = await z.request({
    method: 'POST',
    url: `${BASE_URL}/tenants`,
    body: {
      first_name: bundle.inputData.first_name,
      last_name: bundle.inputData.last_name,
      email: bundle.inputData.email,
      phone: bundle.inputData.phone,
    },
  });
  return response.data;
};

module.exports = {
  key: 'create_tenant',
  noun: 'Tenant',
  display: {
    label: 'Create Tenant',
    description: 'Creates a new tenant in PropAgent AI.',
  },
  operation: {
    inputFields: [
      { key: 'first_name', label: 'First Name', required: true, type: 'string' },
      { key: 'last_name', label: 'Last Name', required: true, type: 'string' },
      { key: 'email', label: 'Email', required: false, type: 'string' },
      { key: 'phone', label: 'Phone', required: false, type: 'string' },
    ],
    perform: createTenant,
    sample: {
      id: '22222222-2222-2222-2222-222222222222',
      first_name: 'John',
      last_name: 'Smith',
      email: 'john@example.com',
      phone: '+15559876543',
      is_active: true,
      created_at: '2026-08-01T12:00:00Z',
    },
  },
};
