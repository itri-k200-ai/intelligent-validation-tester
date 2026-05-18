"""Stamp `duration_ms` onto historical assistant Message rows.

The field was added in a later commit; messages produced before then
lack it, leaving the chat UI without a per-turn duration label. This
backfill pairs each completed Turn with the assistant Message it
produced (matched by session + created-time falling inside the Turn's
[started_at, ended_at + grace] window) and writes the duration in.

Idempotent: messages that already carry `duration_ms` are skipped.
Messages with no matching Turn (i.e. predating the Turn-architecture
rollout) are left alone — we do not invent data.

Run with:
    python manage.py backfill_message_durations          # apply
    python manage.py backfill_message_durations --dry-run
"""

from datetime import timedelta

from django.core.management.base import BaseCommand
from django.db import transaction

from api.models import Message, Turn


# Assistant message is created during _finalize, immediately before
# turn.ended_at is stamped. A small grace handles clock skew and the
# microsecond gap between Message.objects.create() and turn.save().
GRACE = timedelta(seconds=5)


class Command(BaseCommand):
    help = "Backfill duration_ms onto historical assistant messages."

    def add_arguments(self, parser):
        parser.add_argument(
            "--dry-run",
            action="store_true",
            help="Report what would change without writing.",
        )

    def handle(self, *args, dry_run: bool = False, **opts):
        completed = Turn.objects.filter(
            status="done",
            started_at__isnull=False,
            ended_at__isnull=False,
        ).select_related("session")

        considered = matched = updated = skipped_already = skipped_no_match = 0

        with transaction.atomic():
            for turn in completed:
                considered += 1
                duration_ms = int(
                    (turn.ended_at - turn.started_at).total_seconds() * 1000
                )
                msg = (
                    Message.objects.filter(
                        session_id=turn.session_id,
                        role="assistant",
                        created_at__gte=turn.started_at,
                        created_at__lte=turn.ended_at + GRACE,
                    )
                    .order_by("created_at")
                    .first()
                )
                if not msg:
                    skipped_no_match += 1
                    continue
                matched += 1
                if isinstance(msg.content, dict) and "duration_ms" in msg.content:
                    skipped_already += 1
                    continue
                if not isinstance(msg.content, dict):
                    self.stderr.write(
                        f"  skip msg {msg.id}: content is {type(msg.content).__name__}"
                    )
                    continue
                msg.content = {**msg.content, "duration_ms": duration_ms}
                if not dry_run:
                    msg.save(update_fields=["content"])
                updated += 1

            if dry_run:
                # Roll back the (no-op) transaction so atomic exits cleanly.
                transaction.set_rollback(True)

        legacy = (
            Message.objects.filter(role="assistant")
            .exclude(content__has_key="duration_ms")
            .count()
        )

        verb = "would update" if dry_run else "updated"
        self.stdout.write(self.style.SUCCESS(f"\nturns considered:        {considered}"))
        self.stdout.write(f"  matched to a message:  {matched}")
        self.stdout.write(f"  no message in window:  {skipped_no_match}")
        self.stdout.write(f"  already had duration:  {skipped_already}")
        self.stdout.write(self.style.SUCCESS(f"  {verb}:                {updated}"))
        self.stdout.write(
            f"\nremaining assistant messages without duration_ms: {legacy}"
        )
        if legacy:
            self.stdout.write(
                "  (these predate the Turn architecture — no Turn row to derive from)"
            )
