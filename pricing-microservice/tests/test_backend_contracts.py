from app.services import ops, ops_write, platform
from app.main import app


def test_platform_report_definitions_cover_expected_ids():
    ids = {item['id'] for item in platform.REPORT_DEFINITION_SEEDS}
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
        '/api/platform/knowledge/bootstrap',
        '/api/platform/knowledge/documents',
        '/api/platform/knowledge/topics',
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
    monkeypatch.setattr(platform, 'report_definitions', lambda: [
        {
            'id': 'executive-scorecard',
            'name': 'Executive scorecard',
            'area': 'Executive',
            'description': 'Pipeline and revenue.',
        }
    ])
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


def test_administration_summary_uses_sql_helpers(monkeypatch):
    monkeypatch.setattr(platform, 'sales_dashboard', lambda: {'PendingApprovalCount': 2, 'QuoteCount': 3, 'OpportunityCount': 4})
    monkeypatch.setattr(platform, 'admin_users', lambda: [{'UserNumber': 'USR-1'}])
    monkeypatch.setattr(platform, 'admin_roles', lambda: [{'RoleNumber': 'ROLE-1'}])
    monkeypatch.setattr(platform, 'admin_integrations', lambda: [{'IntegrationNumber': 'INT-1'}])
    payload = platform.administration_summary()
    assert payload['users'][0]['UserNumber'] == 'USR-1'
    assert payload['roles'][0]['RoleNumber'] == 'ROLE-1'
    assert payload['integrations'][0]['IntegrationNumber'] == 'INT-1'
    assert payload['controls']['pendingApprovals'] == 2
