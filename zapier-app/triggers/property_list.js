const { BASE_URL } = require('../config');

// Hidden trigger — not meant to be used as a Zap trigger on its own. It exists
// purely to power the dynamic "Property" dropdown on the Create Maintenance
// Ticket action, so users pick a property by name instead of pasting a UUID.
const listProperties = async (z, bundle) => {
  const response = await z.request({
    url: `${BASE_URL}/properties`,
  });
  return response.data;
};

module.exports = {
  key: 'property_list',
  noun: 'Property',
  display: {
    label: 'New Property (internal)',
    description: 'Used internally to power the Property dropdown in other actions.',
    hidden: true,
  },
  operation: {
    type: 'polling',
    perform: listProperties,
    sample: {
      id: '44444444-4444-4444-4444-444444444444',
      name: 'Sunrise Apartments',
      address: '123 Main St',
      city: 'Boston',
      state: 'MA',
      total_units: 24,
    },
  },
};
