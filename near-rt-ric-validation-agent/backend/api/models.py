import uuid

from django.db import models


class Persona(models.Model):
    slug = models.CharField(max_length=64, primary_key=True)
    display_name = models.CharField(max_length=128)
    description = models.TextField(blank=True, default="")
    controls_overlay = models.JSONField(default=dict)
    source_file = models.CharField(max_length=512, blank=True, default="")
    synced_at = models.DateTimeField(auto_now=True)

    def __str__(self):
        return self.slug


class Session(models.Model):
    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    title = models.CharField(max_length=256, blank=True, default="")
    claude_session_id = models.CharField(max_length=128, blank=True, default="")
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        ordering = ["-updated_at"]


class Message(models.Model):
    ROLE_CHOICES = [
        ("user", "user"),
        ("assistant", "assistant"),
        ("tool", "tool"),
        ("system", "system"),
    ]
    id = models.BigAutoField(primary_key=True)
    session = models.ForeignKey(Session, related_name="messages", on_delete=models.CASCADE)
    role = models.CharField(max_length=16, choices=ROLE_CHOICES)
    content = models.JSONField()
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering = ["id"]


class Instance(models.Model):
    STATUS_CHOICES = [
        ("draft", "draft"),
        ("generated", "generated"),
        ("error", "error"),
    ]
    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    session = models.ForeignKey(
        Session, related_name="instances", on_delete=models.SET_NULL, null=True, blank=True
    )
    name = models.CharField(max_length=128, unique=True)
    persona = models.CharField(max_length=64, blank=True, default="")
    controls = models.JSONField(default=dict)
    output_path = models.CharField(max_length=512, blank=True, default="")
    status = models.CharField(max_length=16, choices=STATUS_CHOICES, default="draft")
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        ordering = ["-updated_at"]


class Turn(models.Model):
    """One user → assistant exchange. Worker subprocess writes append-only
    events to TurnEvent while running; the final assistant text becomes a
    Message at the end. Lives independently of the HTTP connection that
    started it (browser disconnect does NOT kill the worker).
    """
    STATUS_CHOICES = [
        ("running", "running"),
        ("done", "done"),
        ("error", "error"),
        ("interrupted", "interrupted"),
    ]
    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    session = models.ForeignKey(
        Session, related_name="turns", on_delete=models.CASCADE
    )
    status = models.CharField(max_length=16, choices=STATUS_CHOICES, default="running")
    user_message_text = models.TextField(blank=True, default="")
    attachments = models.JSONField(default=list, blank=True)
    claude_session_id_in = models.CharField(max_length=128, blank=True, default="")
    claude_session_id_out = models.CharField(max_length=128, blank=True, default="")
    error_text = models.TextField(blank=True, default="")
    started_at = models.DateTimeField(auto_now_add=True)
    ended_at = models.DateTimeField(null=True, blank=True)

    class Meta:
        ordering = ["-started_at"]


class TurnEvent(models.Model):
    """Append-only log of everything the agent does during one turn:
    text deltas, thinking deltas, tool_use, tool_result, system init,
    result summary. Frontend SSE tail-follower reads this table.
    """
    TYPE_CHOICES = [
        ("system", "system"),
        ("text", "text"),                # accumulated text snapshot
        ("text_delta", "text_delta"),    # incremental chunk
        ("thinking_delta", "thinking_delta"),
        ("tool_use", "tool_use"),
        ("tool_result", "tool_result"),
        ("result", "result"),
        ("error", "error"),
        ("done", "done"),
    ]
    id = models.BigAutoField(primary_key=True)
    turn = models.ForeignKey(Turn, related_name="events", on_delete=models.CASCADE)
    seq = models.PositiveIntegerField()
    type = models.CharField(max_length=24, choices=TYPE_CHOICES)
    data = models.JSONField()
    ts = models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering = ["seq"]
        constraints = [
            models.UniqueConstraint(fields=["turn", "seq"], name="turnevent_seq_uniq"),
        ]


class Job(models.Model):
    KIND_CHOICES = [
        ("chat", "chat"),
        ("wizard", "wizard"),
        ("subagent", "subagent"),
        ("tarball", "tarball"),
    ]
    STATUS_CHOICES = [
        ("running", "running"),
        ("ok", "ok"),
        ("error", "error"),
    ]
    id = models.BigAutoField(primary_key=True)
    instance = models.ForeignKey(
        Instance, related_name="jobs", on_delete=models.CASCADE, null=True, blank=True
    )
    session = models.ForeignKey(
        Session, related_name="jobs", on_delete=models.SET_NULL, null=True, blank=True
    )
    kind = models.CharField(max_length=16, choices=KIND_CHOICES)
    status = models.CharField(max_length=16, choices=STATUS_CHOICES, default="running")
    log = models.TextField(blank=True, default="")
    started_at = models.DateTimeField(auto_now_add=True)
    ended_at = models.DateTimeField(null=True, blank=True)
