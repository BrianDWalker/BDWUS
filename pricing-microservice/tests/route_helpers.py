def iter_effective_routes(routes):
    for route in routes:
        original_router = getattr(route, "original_router", None)
        if original_router is not None:
            yield from iter_effective_routes(getattr(original_router, "routes", []))
            continue

        nested_routes = getattr(route, "routes", None)
        if nested_routes:
            yield from iter_effective_routes(nested_routes)
            continue

        yield route
