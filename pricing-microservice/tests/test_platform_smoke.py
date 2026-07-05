from app.services import platform


def test_report_definitions_exist():
    assert len(platform.REPORT_DEFINITIONS) >= 3
    ids = {item['id'] for item in platform.REPORT_DEFINITIONS}
    assert 'executive-scorecard' in ids
    assert 'pricing-approval-queue' in ids
    assert 'customer-revenue' in ids


def test_sales_dashboard_fallback(monkeypatch):
    monkeypatch.setattr(platform, 'ensure_sales_storage', lambda: None)
    monkeypatch.setattr(platform, 'fetch_one', lambda *args, **kwargs: None)
    result = platform.sales_dashboard()
    assert result['LeadCount'] == 0
    assert result['QuoteCount'] == 0
