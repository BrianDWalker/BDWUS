from app.services import ops, ops_write, platform


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
