"""Gate all /api/* requests behind the cookie set by api.auth.login.
Skips check if APP_PASSWORD is unset, or for auth endpoints / healthz."""

from django.http import JsonResponse

from api.auth import COOKIE_NAME, auth_enabled, check_token

OPEN_PATHS = {
    "/api/healthz",
    "/api/auth/login",
    "/api/auth/me",
    "/api/auth/logout",
}


class SinglePasswordAuthMiddleware:
    def __init__(self, get_response):
        self.get_response = get_response

    def __call__(self, request):
        if not auth_enabled():
            return self.get_response(request)
        path = request.path.rstrip("/")  # normalize for OPEN_PATHS match
        normalized_open = {p.rstrip("/") for p in OPEN_PATHS}
        if not request.path.startswith("/api/"):
            return self.get_response(request)
        if path in normalized_open:
            return self.get_response(request)
        token = request.COOKIES.get(COOKIE_NAME, "")
        if not check_token(token):
            return JsonResponse({"error": "unauthorized"}, status=401)
        return self.get_response(request)
