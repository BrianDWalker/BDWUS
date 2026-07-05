from app import main


def test_ready_smoke_includes_care_storage(monkeypatch):
    monkeypatch.setattr(main, "smoke_mode_enabled", lambda: True)
    response = main.ready()
    assert response["status"] == "healthy"
    assert response["checks"]["careStorage"] is True
