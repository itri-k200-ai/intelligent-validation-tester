import uuid

import django.db.models.deletion
from django.conf import settings
from django.db import migrations, models


class Migration(migrations.Migration):

    initial = True

    dependencies = [
        ("duts", "0008_dut_access_mode_and_notes"),
        ("scenarios", "0005_testscenario_source_document_and_section"),
        ("documents", "0002_issuing_body_doc_number_pub_date_status"),
        migrations.swappable_dependency(settings.AUTH_USER_MODEL),
    ]

    operations = [
        migrations.CreateModel(
            name="AgentSession",
            fields=[
                ("id", models.UUIDField(default=uuid.uuid4, editable=False, primary_key=True, serialize=False)),
                ("agent_session_id", models.CharField(blank=True, db_index=True, max_length=64)),
                ("title", models.CharField(max_length=300)),
                ("mode", models.CharField(blank=True, choices=[
                    ("functional", "功能"), ("conformance", "一致性"),
                    ("iot", "互通性"), ("performance", "效能"),
                    ("resilience", "韌性"), ("explore", "探索 / 雜談"),
                ], max_length=16)),
                ("status", models.CharField(choices=[
                    ("in_progress", "進行中"), ("completed", "完成"),
                    ("failed", "失敗"), ("abandoned", "中止"),
                ], default="in_progress", max_length=16)),
                ("summary", models.TextField(blank=True, help_text="最終結論 / pass-fail 摘要")),
                ("started_at", models.DateTimeField(auto_now_add=True)),
                ("ended_at", models.DateTimeField(blank=True, null=True)),
                ("dut", models.ForeignKey(blank=True, null=True,
                    on_delete=django.db.models.deletion.SET_NULL,
                    related_name="agent_sessions", to="duts.dut")),
                ("scenario", models.ForeignKey(blank=True, null=True,
                    on_delete=django.db.models.deletion.SET_NULL,
                    related_name="agent_sessions", to="scenarios.testscenario")),
                ("started_by", models.ForeignKey(blank=True, null=True,
                    on_delete=django.db.models.deletion.SET_NULL,
                    related_name="agent_sessions", to=settings.AUTH_USER_MODEL)),
                ("cited_documents", models.ManyToManyField(blank=True,
                    related_name="agent_sessions", to="documents.document")),
            ],
            options={
                "ordering": ("-started_at",),
                "indexes": [
                    models.Index(fields=["mode", "status"], name="agent_sess_mode_idx"),
                    models.Index(fields=["dut", "started_at"], name="agent_sess_dut_idx"),
                ],
            },
        ),
        migrations.CreateModel(
            name="AgentStep",
            fields=[
                ("id", models.UUIDField(default=uuid.uuid4, editable=False, primary_key=True, serialize=False)),
                ("seq", models.IntegerField()),
                ("role", models.CharField(choices=[("user", "使用者"), ("assistant", "Agent")], max_length=16)),
                ("text", models.TextField()),
                ("created_at", models.DateTimeField(auto_now_add=True)),
                ("session", models.ForeignKey(on_delete=django.db.models.deletion.CASCADE,
                    related_name="steps", to="agent_sessions.agentsession")),
            ],
            options={
                "ordering": ("session", "seq"),
                "unique_together": {("session", "seq")},
            },
        ),
        migrations.CreateModel(
            name="AgentCommand",
            fields=[
                ("id", models.UUIDField(default=uuid.uuid4, editable=False, primary_key=True, serialize=False)),
                ("command", models.TextField()),
                ("stdout", models.TextField(blank=True)),
                ("stderr", models.TextField(blank=True)),
                ("exit_code", models.IntegerField(blank=True, null=True)),
                ("duration_ms", models.IntegerField(blank=True, null=True)),
                ("created_at", models.DateTimeField(auto_now_add=True)),
                ("step", models.ForeignKey(on_delete=django.db.models.deletion.CASCADE,
                    related_name="commands", to="agent_sessions.agentstep")),
            ],
            options={"ordering": ("step", "created_at")},
        ),
        migrations.CreateModel(
            name="AgentArtifact",
            fields=[
                ("id", models.UUIDField(default=uuid.uuid4, editable=False, primary_key=True, serialize=False)),
                ("relpath", models.CharField(max_length=500)),
                ("text_content", models.TextField(blank=True)),
                ("storage_key", models.CharField(blank=True, max_length=500)),
                ("content_type", models.CharField(blank=True, max_length=128)),
                ("size_bytes", models.BigIntegerField(blank=True, null=True)),
                ("sha256", models.CharField(blank=True, max_length=64)),
                ("description", models.TextField(blank=True)),
                ("created_at", models.DateTimeField(auto_now_add=True)),
                ("session", models.ForeignKey(on_delete=django.db.models.deletion.CASCADE,
                    related_name="artifacts", to="agent_sessions.agentsession")),
            ],
            options={"ordering": ("session", "created_at")},
        ),
    ]
