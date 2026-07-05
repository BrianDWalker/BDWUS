from app.services import ops, ops_write, platform
from app.main import app


def test_platform_report_definitions_cover_expected_ids():
    ids = {item['id'] for item in platform.REPORT_DEFINITIONS}
    assert 'executive-scorecard' in ids
    assert 'pricing-approval-queue' in ids
    assert 'customer-revenue' in ids


def test_ops_router_prefixes_exist():
    assert ops.ops_router.prefix == '/api/ops'
    assert ops.admin_router.prefix == '/api/admin'
    assert ops.billing_workflow_router.prefix == '/api/billing-workflows'


def test_ops_write_router_prefixes_exist():
    assert ops_write.ops_write_router.prefix == '/api/ops'
    assert ops_write.admin_write_router.prefix == '/api/admin'
    assert ops_write.billing_write_router.prefix == '/api/billing-workflows'


def test_platform_and_ops_routes_are_registered():
    route_paths = set(app.openapi()['paths'])
    expected_paths = {
        '/health',
        '/health/ready',
        '/api/platform/bootstrap',
        '/api/platform/reports/definitions',
        '/api/platform/reports/{report_id}',
        '/api/platform/administration/summary',
        '/api/platform/customer-360/{customer_number}',
        '/api/platform/product-pricing/overview',
        '/api/ops/bootstrap',
        '/api/ops/orders',
        '/api/ops/network-events',
        '/api/ops/provisioning-jobs',
        '/api/ops/carrier-settlement',
        '/api/admin/users',
        '/api/admin/roles',
        '/api/admin/integrations',
        '/api/billing-workflows/invoices',
        '/api/billing-workflows/invoices/{invoice_id}',
        '/api/billing-workflows/invoices/{invoice_id}/actions',
        '/api/billing-workflows/adjustments',
    }
    assert expected_paths.issubset(route_paths)


def test_report_payload_shape_without_database(monkeypatch):
    monkeypatch.setattr(platform, 'ensure_sales_storage', lambda: None)
    monkeypatch.setattr(platform, 'fetch_all', lambda *args, **kwargs: [
        {
            'account': 'Test Account',
            'region': 'Midwest',
            'segment': 'Enterprise',
            'service': 'Fiber',
            'amount': 1000,
            'metric': '42',
            'status': 'Open',
        }
    ])
    payload = platform.platform_report('executive-scorecard')
    assert payload['definition']['id'] == 'executive-scorecard'
    assert payload['rowCount'] == 1
    assert payload['totalAmount'] == 1000
    assert payload['rows'][0]['reportId'] == 'executive-scorecard'
