require('should');
const zapier = require('zapier-platform-core');
const App = require('../index');
const appTester = zapier.createAppTester(App);

describe('authentication', () => {
  it('fails gracefully with a bad api key', async () => {
    const bundle = { authData: { api_key: 'not-a-real-key' } };
    try {
      await appTester(App.authentication.test, bundle);
      throw new Error('should not reach here');
    } catch (e) {
      // Expected — an invalid key must not silently "pass" auth.
      e.message.should.match(/API key|401/i);
    }
  });
});
