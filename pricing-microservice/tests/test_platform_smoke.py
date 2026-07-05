from app.services import platform


def test_report_definitions_exist():
    ids = {item['id'] for item in platform.REPORT_DEFINITION_SEEDS}
    assert 'executive-scorecard' in ids
    assert 'pricing-approval-queue' in ids
    assert 'customer-revenue' in ids


def test_sales_dashboard_fallback(monkeypatch):
    monkeypatch.setattr(platform, 'ensure_sales_storage', lambda: None)
    monkeypatch.setattr(platform, 'fetch_one', lambda *args, **kwargs: None)
    result = platform.sales_dashboard()
    assert result['LeadCount'] == 0
    assert result['QuoteCount'] == 0


def test_knowledge_bootstrap_shape(monkeypatch):
    monkeypatch.setattr(platform, 'knowledge_documents', lambda: [
        {'id': 'doc-1', 'status': 'Active'},
        {'id': 'doc-2', 'status': 'Review'},
    ])
    monkeypatch.setattr(platform, 'knowledge_topics', lambda: [{'id': 'topic-1'}])
    result = platform.knowledge_bootstrap()
    assert result['summary']['documentCount'] == 2
    assert result['summary']['topicCount'] == 1
    assert result['summary']['currentCount'] == 1
    assert result['summary']['reviewCount'] == 1
