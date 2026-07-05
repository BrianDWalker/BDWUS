#!/usr/bin/env python3
"""Run deterministic submit-style workflow smoke against a preview/staging API."""

from __future__ import annotations

import argparse
import os
import sys
import uuid

import httpx


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(description="Run submit workflow smoke against the fc-gpt preview API.")
    parser.add_argument("--base-url", default=os.getenv("STAGING_API_BASE_URL", "http://127.0.0.1:8000"))
    parser.add_argument("--namespace", default=f"ci-{uuid.uuid4().hex[:10]}")
    return parser.parse_args()


def request_json(client: httpx.Client, method: str, path: str, **kwargs):
    response = client.request(method, path, **kwargs)
    response.raise_for_status()
    return response.json()


def issue_admin_token(client: httpx.Client) -> str:
    payload = request_json(client, "POST", "/api/auth/demo-token", json={"role": "Admin"})
    return payload["token"]


def run_workflow_smoke(base_url: str, namespace: str) -> None:
    base_url = base_url.rstrip("/")
    with httpx.Client(base_url=base_url, timeout=30.0) as unauthenticated_client:
        token = issue_admin_token(unauthenticated_client)

    headers = {"Authorization": f"Bearer {token}"}
    with httpx.Client(base_url=base_url, timeout=30.0, headers=headers) as client:
        seed = request_json(client, "POST", f"/api/test-support/namespaces/{namespace}/workflow-seed")
        print(f"Seeded namespace {namespace}: {seed}")
        try:
            request_json(
                client,
                "POST",
                f"/api/sales/leads/{seed['leadId']}/convert",
                json={"opportunityName": f"{seed['namespace']} converted", "estimatedValue": 41000, "ownerName": "Admin"},
            )

            request_json(
                client,
                "POST",
                "/api/sales/quotes",
                json={
                    "opportunityId": seed["opportunityId"],
                    "quoteNumber": f"QNEW-{seed['namespace'][:8].upper()}",
                    "lineItems": [{"productName": "Fiber 1G", "quantity": 1, "mrc": 1800, "nrc": 250, "cost": 900, "billingCode": "MRC-FIBER"}],
                    "pricingInput": {"quoteNumber": f"QNEW-{seed['namespace'][:8].upper()}"},
                },
            )

            request_json(client, "POST", f"/api/sales/approvals/{seed['approvalId']}/request-changes", json={"requestedChanges": "Update margin justification."})
            request_json(client, "POST", f"/api/sales/approvals/{seed['approvalId']}/approve", json={"approvedBy": "Admin"})

            request_json(
                client,
                "POST",
                "/api/ops/orders",
                json={
                    "orderNumber": f"ORDNEW-{seed['namespace'][:8].upper()}",
                    "customerNumber": seed["customerNumber"],
                    "accountName": f"{seed['namespace']} order",
                    "serviceName": "Managed Router",
                },
            )
            request_json(
                client,
                "POST",
                "/api/ops/provisioning-jobs",
                json={"orderId": seed["orderId"], "jobNumber": f"JOB-{seed['namespace'][:8].upper()}", "jobType": "Activation", "status": "Queued"},
            )

            request_json(
                client,
                "POST",
                f"/api/billing-workflows/invoices/{seed['invoiceId']}/actions",
                json={"actionType": "Send reminder", "status": "Open", "requestedBy": "Admin", "notes": "Submit smoke action"},
            )
            request_json(
                client,
                "POST",
                "/api/billing-workflows/adjustments",
                json={
                    "invoiceId": seed["invoiceId"],
                    "adjustmentNumber": f"ADJ-{seed['namespace'][:8].upper()}",
                    "adjustmentType": "Credit",
                    "amount": -50,
                    "status": "Pending",
                    "reason": "Submit smoke adjustment",
                    "createdBy": "Admin",
                },
            )

            request_json(
                client,
                "POST",
                "/api/admin/users",
                json={"userNumber": seed["userNumber"], "userName": f"{seed['namespace']} User", "email": f"{seed['namespace']}@example.com", "roleName": "Operator"},
            )
            request_json(
                client,
                "POST",
                "/api/admin/roles",
                json={"roleNumber": seed["roleNumber"], "roleName": f"{seed['namespace']} Role", "permissions": ["dashboard"], "status": "Active"},
            )
            request_json(
                client,
                "POST",
                "/api/admin/integrations",
                json={"integrationNumber": seed["integrationNumber"], "integrationName": f"{seed['namespace']} Integration", "ownerName": "Platform", "status": "Pending"},
            )

            print(f"Submit workflow smoke passed for namespace {namespace}")
        finally:
            cleanup = request_json(client, "DELETE", f"/api/test-support/namespaces/{namespace}")
            print(f"Cleanup complete: {cleanup}")


def main() -> int:
    args = parse_args()
    run_workflow_smoke(args.base_url, args.namespace)
    return 0


if __name__ == "__main__":
    sys.exit(main())
