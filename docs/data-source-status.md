# Data source status

The current repository has no mockData.js or src/data directory. Customers, catalog services/rate plans, quotes and opportunities already use sales/billing APIs; invoices and adjustments use billing-workflows SQL APIs. Customer 360, operations, knowledge and reports also use APIs. The old migration map in fc-gpt docs describes an earlier revision.

This change makes API defaults same-origin (hosting PR), exposes paginated SQL view reads for subscriptions, payments and usage, and adds tabs with loading, empty, error and retry states. Existing Billing errors were held in state without being displayed; that is fixed. These new tabs show an explicit unavailable error until approved SQL views exist. They never fall back to demo billing rows.

The review-only billing_facts_proposal.sql lists proposed missing tables and views. It is not in the manifest and must be reconciled with real prod metadata before execution. No new procedures are needed for these read pages. Existing ms.vPricingContext is synthetic and needs a separate owner-reviewed real-data definition after the original schema is available. Do not claim end-to-end production billing integration has been verified.

billing-demo no longer exists. The current bootstrap_demo_data.py seeds SQL directly through the shared managed-identity connection and now refuses prod. No Blob upload path exists. No replacement CSV/Blob pipeline is introduced because the current repo has no consumer. SQL data and grants remain unapplied pending approval.
