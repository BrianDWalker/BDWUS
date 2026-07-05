from app.main import app


def first_matching_endpoint_name(path, method):
    for route in app.routes:
        methods = getattr(route, "methods", set())
        if getattr(route, "path", None) == path and method in methods:
            return route.endpoint.__name__
    return None


def test_sales_compat_registration_order():
    assert first_matching_endpoint_name("/api/sales/opportunities", "POST") == "create_opportunity_compat"
    assert first_matching_endpoint_name("/api/sales/leads/{lead_id}/convert", "POST") == "convert_lead_compat"
    assert first_matching_endpoint_name("/api/sales/opportunities/{opportunity_id}/notes", "POST") == "create_opportunity_note_compat"
