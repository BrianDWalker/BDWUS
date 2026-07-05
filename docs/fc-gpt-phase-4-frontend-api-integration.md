# fc-gpt Phase 4 Frontend API Integration

Phase 4 goal: move production UI workflows off local mock data and onto API-backed loading paths.

## Completed

- Moved shell navigation constants from `web-ui/src/data/mockData.js` to `web-ui/src/navigationConfig.js`.
- Updated `Shell.jsx` and route ownership tests to use `navigationConfig.js`.
- Removed the production `LegacyPortal` fallback from `App.jsx`.
- Added an API-backed unknown-route state instead of rendering the fixture-backed legacy portal.
- Kept active extracted modules on API clients:
  - Dashboard: platform, care, and ops APIs
  - Sales: sales API via `SalesDatabaseCRM`
  - Knowledge: platform Knowledge API
  - Reports: platform reports API
  - Administration: platform/admin APIs
  - Product & Pricing: platform product/pricing API
  - Customer 360: platform and billing APIs
  - Customer Service: platform customer-service API
  - Billing: billing workflow and billing customer APIs
  - Orders, network, provisioning, carrier settlement: ops APIs
  - Detail pages: platform, sales, billing workflow, customer-service, and ops APIs

## Validation

Passed:

- `npm run build`
- `npx playwright test route-ownership.spec.js`
- Current emitted JS bundle check:

```bash
latest_js=$(ls -t web-ui/dist/assets/index-*.js | head -1)
rg -n "data/mockData|LegacyPortal|Apex Health master services agreement|Fiber provisioning playbook|Store continuity bundle" "$latest_js" -S || true
```

Result:

- No matches in the current emitted JavaScript bundle.
- Current production JS bundle size is about `429 kB`, down from the prior `610 kB` build that included the legacy surface.

## Blockers / Follow-Up

- `web-ui/src/LegacyPortal.jsx` and `web-ui/src/components/SalesCRM.jsx` still exist as retired source files and still import `web-ui/src/data/mockData.js`.
- Those retired files are no longer imported by the production route graph and are not present in the current emitted bundle.
- Fully deleting or relocating those retired files is a separate cleanup decision because they are large legacy reference surfaces and may still be useful for historical comparison.
- Old ignored assets in `web-ui/dist/assets` may still contain prior bundle strings until the directory is cleaned before build; the current emitted bundle does not contain those strings.

## Remaining Ownership

- Phase 5 should enforce backend roles for protected API mutations.
- Phase 7 should document whether retired legacy source files should be deleted, archived outside `src`, or kept as explicit local-only reference material.
