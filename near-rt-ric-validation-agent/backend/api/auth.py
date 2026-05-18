"""Single-password auth for a single-user deployment.

If env `APP_PASSWORD` is unset/empty, auth is disabled (dev mode).
Otherwise: clients POST /api/auth/login with {password}; backend sets a
signed HttpOnly cookie. Subsequent requests get checked by the middleware
in app/auth_middleware.py.
"""

import hashlib
import hmac
import json
import os
import time

from django.conf import settings
from django.http import JsonResponse
from django.views.decorators.csrf import csrf_exempt
from django.views.decorators.http import require_http_methods

COOKIE_NAME = "agent_auth"
COOKIE_MAX_AGE = 30 * 86400  # 30 days


def _password() -> str:
    return os.environ.get("APP_PASSWORD", "").strip()


def _secret() -> bytes:
    return (settings.SECRET_KEY or "fallback-secret").encode("utf-8")


def _sign(payload: str) -> str:
    return hmac.new(_secret(), payload.encode("utf-8"), hashlib.sha256).hexdigest()


def make_token() -> str:
    issued = str(int(time.time()))
    return f"{issued}.{_sign(issued)}"


def check_token(token: str) -> bool:
    if not token:
        return False
    try:
        issued, sig = token.split(".", 1)
    except ValueError:
        return False
    if not hmac.compare_digest(sig, _sign(issued)):
        return False
    try:
        age = time.time() - int(issued)
    except ValueError:
        return False
    return 0 <= age < COOKIE_MAX_AGE


def auth_enabled() -> bool:
    return bool(_password())


@csrf_exempt
@require_http_methods(["POST"])
def login(request):
    if not auth_enabled():
        return JsonResponse({"ok": True, "auth": "disabled"})
    try:
        body = json.loads(request.body.decode("utf-8") or "{}")
    except json.JSONDecodeError:
        return JsonResponse({"error": "bad json"}, status=400)
    if not hmac.compare_digest(str(body.get("password", "")), _password()):
        return JsonResponse({"error": "wrong password"}, status=401)
    response = JsonResponse({"ok": True})
    response.set_cookie(
        COOKIE_NAME,
        make_token(),
        max_age=COOKIE_MAX_AGE,
        httponly=True,
        samesite="Lax",
        secure=False,  # tunnel terminates TLS; backend traffic is HTTP
    )
    return response


@require_http_methods(["GET"])
def me(request):
    if not auth_enabled():
        return JsonResponse({"ok": True, "auth": "disabled"})
    token = request.COOKIES.get(COOKIE_NAME, "")
    if check_token(token):
        return JsonResponse({"ok": True, "auth": "ok"})
    return JsonResponse({"ok": False, "auth": "unauthorized"}, status=401)


@csrf_exempt
@require_http_methods(["POST"])
def logout(request):
    response = JsonResponse({"ok": True})
    response.delete_cookie(COOKIE_NAME)
    return response
