from django.contrib import admin
from django.http import JsonResponse
from django.urls import include, path
from drf_spectacular.views import SpectacularAPIView, SpectacularSwaggerView
from rest_framework_simplejwt.views import TokenRefreshView


def health(_request):
    return JsonResponse({"ok": True})


api_patterns = [
    path("health/", health),
    path("auth/", include("apps.accounts.urls")),
    path("auth/refresh/", TokenRefreshView.as_view(), name="token_refresh"),
    path("overview/", include("apps.overview.urls")),
    path("", include("apps.sites.urls")),
    path("", include("apps.duts.urls")),
    path("", include("apps.platforms.urls")),
    path("", include("apps.applications.urls")),
    path("", include("apps.scenarios.urls")),
    path("", include("apps.validations.urls")),
    path("reports/", include("apps.reports.urls")),
    path("", include("apps.documents.urls")),
    path("", include("apps.agent_sessions.urls")),
    path("", include("apps.selection.urls")),
    path("schema/", SpectacularAPIView.as_view(), name="schema"),
    path("docs/", SpectacularSwaggerView.as_view(url_name="schema"), name="swagger-ui"),
]

urlpatterns = [
    path("admin/", admin.site.urls),
    path("api/", include(api_patterns)),
]
