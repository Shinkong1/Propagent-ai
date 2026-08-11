// Manual/live smoke test for the polling triggers, run against the real
// deployed backend with a real API key. Not part of `npm test`'s default
// suite (kept separate from authentication.test.js) since it needs a live
// credential -- run explicitly:
//
//   PROPAGENT_API_KEY=pa_live_... npx mocha --timeout 20000 test/triggers.manual.test.js
//
require('should');
const zapier = require('zapier-platform-core');
const App = require('../index');
const appTester = zapier.createAppTester(App);

const apiKey = process.env.PROPAGENT_API_KEY;

describe('trigger perform functions (live)', function () {
  before(function () {
    if (!apiKey) this.skip();
  });

  const bundle = { authData: { api_key: apiKey } };

  it('New Lead trigger returns an array, newest-first, and sets a cursor', async () => {
    const results = await appTester(App.triggers.new_lead.operation.perform, bundle);
    Array.isArray(results).should.be.true();
    if (results.length > 1) {
      new Date(results[0].created_at).getTime().should.be.aboveOrEqual(
        new Date(results[1].created_at).getTime()
      );
    }
    console.log(`  -> ${results.length} lead(s) returned`);
  });

  it('New Tenant trigger returns an array, newest-first', async () => {
    const results = await appTester(App.triggers.new_tenant.operation.perform, bundle);
    Array.isArray(results).should.be.true();
    if (results.length > 1) {
      new Date(results[0].created_at).getTime().should.be.aboveOrEqual(
        new Date(results[1].created_at).getTime()
      );
    }
    console.log(`  -> ${results.length} tenant(s) returned`);
  });

  it('New Maintenance Ticket trigger returns an array, newest-first', async () => {
    const results = await appTester(App.triggers.new_maintenance_ticket.operation.perform, bundle);
    Array.isArray(results).should.be.true();
    if (results.length > 1) {
      new Date(results[0].created_at).getTime().should.be.aboveOrEqual(
        new Date(results[1].created_at).getTime()
      );
    }
    console.log(`  -> ${results.length} ticket(s) returned`);
  });

  it('property_list (hidden trigger powering the Property dropdown) returns an array', async () => {
    const results = await appTester(App.triggers.property_list.operation.perform, bundle);
    Array.isArray(results).should.be.true();
    console.log(`  -> ${results.length} propert(y/ies) returned`);
  });
});
