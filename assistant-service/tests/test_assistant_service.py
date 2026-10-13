from fastapi.testclient import TestClient

from app.main import app


def test_health_endpoint():
    client = TestClient(app)
    response = client.get('/health')
    assert response.status_code == 200
    payload = response.json()
    assert payload['status'] == 'healthy'
    assert 'allowedRepositories' in payload
    assert 'model' in payload


def test_ui_overrides_endpoint():
    client = TestClient(app)
    response = client.get('/api/assistant/ui-overrides?scope=knowledge')
    assert response.status_code == 200
    assert isinstance(response.json(), list)


def test_chat_endpoint_returns_conversation_and_message():
    client = TestClient(app)
    response = client.post('/api/assistant/chat', json={
        'mode': 'knowledge',
        'message': "What is today's date?",
        'context': {'pageTitle': 'Product & Pricing'}
    })
    assert response.status_code in (200, 502, 503)
    if response.status_code == 200:
        payload = response.json()
        assert payload['conversationId']
        assert payload['assistantMessage']
        assert 'proposals' in payload
    else:
        assert 'detail' in response.json()
