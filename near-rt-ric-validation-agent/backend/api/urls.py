from django.urls import include, path
from rest_framework.routers import DefaultRouter

from . import (
    app_config as app_config_views,
    auth as auth_views,
    growth as growth_views,
    knowledge,
    uploads,
    views,
)
from .agent import chat_start, list_turns, turn_events
from .files_domain import (
    delete_generated,
    generated_archive,
    list_files,
    list_generated,
    read_file,
    tarball,
    workspace_file,
)

router = DefaultRouter()
router.register(r"personas", views.PersonaViewSet, basename="persona")
router.register(r"sessions", views.SessionViewSet, basename="session")
router.register(r"instances", views.InstanceViewSet, basename="instance")
router.register(r"jobs", views.JobViewSet, basename="job")

urlpatterns = [
    path("", include(router.urls)),
    path("healthz", views.healthz),
    path("auth/login", auth_views.login),
    path("auth/me", auth_views.me),
    path("auth/logout", auth_views.logout),
    path("app/config", app_config_views.app_config),
    path("agent/knowledge", knowledge.knowledge),
    path("agent/info", knowledge.info),
    path("agent/growth", growth_views.growth),
    path("sessions/<uuid:session_id>/messages/", views.session_messages),
    path("sessions/<uuid:session_id>/chat", chat_start, name="chat-start"),
    path("turns/", list_turns),
    path("turns/<uuid:turn_id>/events", turn_events, name="turn-events"),
    path("sessions/<uuid:session_id>/uploads/", uploads.session_uploads),
    path("instances/<uuid:instance_id>/files/", list_files),
    path("instances/<uuid:instance_id>/files/<path:relpath>", read_file),
    path("instances/<uuid:instance_id>/tarball", tarball),
    path("files/", workspace_file),
    path("generated/", list_generated),
    path("generated/<str:name>/archive", generated_archive),
    path("generated/<str:name>", delete_generated),
]
