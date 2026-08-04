# PropAgent AI — Zapier Integration

A Zapier CLI app so PropAgent AI customers can connect their account to
5,000+ other apps without touching code. It talks to the public REST API in
[`backend/routes/public_api.py`](../backend/routes/public_api.py), authenticated
per-organization with the API key generated at **Settings > API** in the
PropAgent AI dashboard.

## What it does

**Triggers** (poll PropAgent AI for new records, fire a Zap when found):
- New Lead
- New Tenant
- New Maintenance Ticket

**Actions** (create a record in PropAgent AI from another app):
- Create Tenant
- Create Maintenance Ticket
- Create Lead

## One-time setup (you need to do this — it requires your own Zapier login)

The code is already written; deploying it to Zapier requires the Zapier CLI
authenticated as *you*, since Zapier ties every integration to a developer
account. None of this can be done on your behalf — here's exactly what to run.

1. **Create a Zapier account** (if you don't have one) at
   [zapier.com/sign-up](https://zapier.com/sign-up), then become a Zapier
   Developer at [developer.zapier.com](https://developer.zapier.com) (free,
   just requires accepting their developer terms).

2. **Install the Zapier CLI** globally:
   ```bash
   npm install -g zapier-platform-cli
   ```

3. **Log in** from your terminal (this opens a browser to authenticate):
   ```bash
   zapier login
   ```

4. **Install dependencies** inside this folder:
   ```bash
   cd zapier-app
   npm install
   ```

5. **Register the app** with Zapier (creates it in your Zapier developer
   account — only needs to be done once, ever):
   ```bash
   zapier register "PropAgent AI"
   ```
   This links the app in this folder to a new Zapier app in your account and
   writes an `.zapierapprc` file here (already gitignored).

6. **Run the test suite** to make sure everything's wired correctly:
   ```bash
   npm test
   ```

7. **Push a version to Zapier**:
   ```bash
   zapier push
   ```

8. **Test it live**: go to [zapier.com/app/editor](https://zapier.com/app/editor),
   start a new Zap, search for "PropAgent AI" in the app picker — it'll show
   up as a **private** integration visible only to your Zapier account for
   now. Connect it using an API key from Settings > API in the dashboard, and
   try each trigger/action.

9. **Invite team members / beta testers** (optional, still private):
   ```bash
   zapier users:add teammate@example.com
   ```

10. **Publish publicly** (optional — makes it searchable by any Zapier user,
    not just invited ones). This requires Zapier's app review process:
    ```bash
    zapier promote 1.0.0
    ```
    Zapier will review the integration (usually a few business days) before
    it goes fully public. Until then, the private version from step 7-8 is
    fully functional for your own customers — you can just share the invite
    link from `zapier users:add` or `zapier team:invite`.

## Making changes later

After editing any file in this folder:
```bash
npm test        # make sure nothing broke
zapier push      # ship a new version
```
Zapier keeps old versions running for existing users until you deprecate
them (`zapier deprecate <version> <date>`), so pushing a new version never
breaks Zaps someone already built.

## Local structure

```
zapier-app/
  config.js                          — API base URL, single source of truth
  authentication.js                  — custom API key auth + test request
  index.js                           — wires everything together, adds the
                                        X-API-Key header to every request
  triggers/
    new_lead.js
    new_tenant.js
    new_maintenance_ticket.js
    property_list.js                 — hidden, powers the Property dropdown
  creates/
    create_tenant.js
    create_maintenance_ticket.js
    create_lead.js
  test/
    authentication.test.js
```
