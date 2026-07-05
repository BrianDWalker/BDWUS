from app.main import app
from app.services import customer_service


def test_customer_service_router_registered():
    routes = {(getattr(route, "path", None), tuple(sorted(getattr(route, "methods", [])))) for route in app.routes}
    assert any(path == "/api/platform/customer-service/overview" and "GET" in methods for path, methods in routes)


def test_customer_service_summary_counts():
    tickets = [
        {"Category": "Network", "Status": "Open", "AgeHours": 10},
        {"Category": "Billing", "Status": "In Progress", "AgeHours": 20},
        {"Category": "Care", "Status": "Closed", "AgeHours": 30},
    ]
    summary = customer_service._summary(tickets)
    assert summary["openTicketCount"] == 2
    assert summary["networkTicketCount"] == 1
    assert summary["billingTicketCount"] == 1
    assert summary["averageAgeHours"] == 20
