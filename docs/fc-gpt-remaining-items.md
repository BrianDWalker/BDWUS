# fc-gpt Remaining Items

This file is a consolidated remainder list pulled from the phase notes, release checklists, and UI review docs.

## Mobile / tablet pass completed locally

- Manual browser visual QA was completed at desktop, tablet, and mobile widths.
- Mobile drawer route behavior was verified.
- Tablet and mobile layout stacking were verified.
- Responsive route screenshots were captured during the local validation pass.
- Top navigation, global search, utility menus, tables, empty states, and error states were checked at narrower widths.

## Broader QA completed locally

- Desktop, tablet, and mobile browser QA was completed across the Product & Pricing and core portal route surfaces.
- Additional responsive smoke coverage was added for tablet and mobile viewport checks in the deployed route suite.
- Mobile navigation and narrower viewport behaviors were rechecked after the test expansion.

## Unrelated remaining items

- Confirm the latest GitHub Actions results.
- Confirm Azure deployment proof.
- Confirm live Azure SQL behavior.
- Confirm live API proof from the deployed environment.
- Confirm staging payload shape proof.
- Confirm server-side authorization.
- Confirm API-backed Knowledge documents.
- Confirm formal quote-to-order audit lineage.
- Confirm production monitoring and rollback notes.
- Decide whether any remaining LegacyPortal surfaces should be migrated, accepted, or removed.
- Complete any remaining workflow validation for lead-to-cash, billing, and service operations that is still only covered by smoke or partial validation.

## Notes

- The broader mobile/tablet redesign is still considered out of scope for the current completion window.
- Responsive handling for module actions, tables, panels, field grids, and detail layouts has already been added in prior phases.
