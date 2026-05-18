from django.apps import AppConfig


class ApiConfig(AppConfig):
    default_auto_field = "django.db.models.BigAutoField"
    name = "api"

    def ready(self):
        from django.db.backends.signals import connection_created
        from . import personas

        def _sync_once(sender, connection, **kwargs):
            try:
                personas.sync_from_disk()
            except Exception:
                pass
            try:
                self._mark_orphan_turns()
            except Exception:
                pass
            connection_created.disconnect(_sync_once)

        connection_created.connect(_sync_once)

    def _mark_orphan_turns(self):
        """On startup, any Turn(status=running) is by definition orphaned —
        the worker thread died with the previous process. Flip them to
        `interrupted` so the UI doesn't spin forever."""
        from django.utils import timezone
        from .models import Turn
        orphans = Turn.objects.filter(status="running")
        for t in orphans:
            t.status = "interrupted"
            t.error_text = "backend restarted while turn was running"
            t.ended_at = timezone.now()
            t.save(update_fields=["status", "error_text", "ended_at"])
