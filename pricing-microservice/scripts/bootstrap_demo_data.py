#!/usr/bin/env python3
"""Explicitly seed demo/staging data into Azure SQL for fc-gpt environments."""

from __future__ import annotations

import argparse
import sys

from app.services.customer_service import ensure_customer_service_storage, seed_customer_service_data
from app.services.ops import ensure_ops_storage, seed_ops_data
from app.services.sales import ensure_sales_storage, seed_if_empty


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(description="Explicitly seed fc-gpt demo data into Azure SQL.")
    parser.add_argument("--sales", action="store_true", help="Seed sales/billing demo data only.")
    parser.add_argument("--ops", action="store_true", help="Seed ops/admin/billing workflow demo data only.")
    parser.add_argument("--care", action="store_true", help="Seed customer-service demo data only.")
    return parser.parse_args()


def main() -> int:
    args = parse_args()
    selected_any = args.sales or args.ops or args.care
    run_sales = args.sales or not selected_any
    run_ops = args.ops or not selected_any
    run_care = args.care or not selected_any

    if run_sales:
        ensure_sales_storage()
        seed_if_empty()
        print("Seeded sales/billing demo data where target tables were empty.")
    if run_ops:
        ensure_ops_storage()
        seed_ops_data()
        print("Seeded ops/admin/billing workflow demo data where target tables were empty.")
    if run_care:
        ensure_customer_service_storage()
        seed_customer_service_data()
        print("Seeded customer-service demo data where target tables were empty.")
    return 0


if __name__ == "__main__":
    sys.exit(main())
