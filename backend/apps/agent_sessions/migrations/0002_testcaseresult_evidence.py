import uuid

import django.db.models.deletion
from django.db import migrations, models


class Migration(migrations.Migration):

    dependencies = [
        ("agent_sessions", "0001_initial"),
        ("scenarios", "0006_testcase"),
    ]

    operations = [
        migrations.CreateModel(
            name="TestCaseResult",
            fields=[
                ("id", models.UUIDField(default=uuid.uuid4, editable=False, primary_key=True, serialize=False)),
                ("case_id_raw", models.CharField(blank=True, help_text="未連 TestCase 時的 TC-XX 標籤", max_length=32)),
                ("case_name", models.CharField(blank=True, max_length=200)),
                ("status", models.CharField(choices=[
                    ("pass", "PASS"), ("fail", "FAIL"), ("blocked", "BLOCKED"),
                    ("skipped", "SKIPPED"), ("error", "ERROR"),
                    ("in_progress", "進行中"),
                ], max_length=16)),
                ("observed", models.TextField(blank=True, help_text="實際觀察")),
                ("notes", models.TextField(blank=True)),
                ("executed_at", models.DateTimeField(auto_now_add=True)),
                ("session", models.ForeignKey(
                    on_delete=django.db.models.deletion.CASCADE,
                    related_name="case_results", to="agent_sessions.agentsession")),
                ("test_case", models.ForeignKey(blank=True, null=True,
                    on_delete=django.db.models.deletion.SET_NULL,
                    related_name="results", to="scenarios.testcase")),
            ],
            options={
                "ordering": ("session", "case_id_raw", "executed_at"),
                "indexes": [
                    models.Index(fields=["status"], name="case_result_status_idx"),
                    models.Index(fields=["test_case", "status"], name="case_result_tc_idx"),
                ],
            },
        ),
        migrations.CreateModel(
            name="Evidence",
            fields=[
                ("id", models.UUIDField(default=uuid.uuid4, editable=False, primary_key=True, serialize=False)),
                ("kind", models.CharField(choices=[
                    ("pcap", "封包擷取"), ("log", "Log"),
                    ("screenshot", "截圖"), ("config", "配置檔"),
                    ("other", "其他"),
                ], max_length=16)),
                ("name", models.CharField(max_length=300)),
                ("text_content", models.TextField(blank=True)),
                ("storage_key", models.CharField(blank=True, max_length=500)),
                ("content_type", models.CharField(blank=True, max_length=128)),
                ("size_bytes", models.BigIntegerField(blank=True, null=True)),
                ("sha256", models.CharField(blank=True, max_length=64)),
                ("captured_with", models.CharField(blank=True, max_length=64,
                    help_text="工具：tshark / journalctl / kubectl logs / 自寫 script")),
                ("captured_at", models.DateTimeField(blank=True, null=True)),
                ("description", models.TextField(blank=True)),
                ("created_at", models.DateTimeField(auto_now_add=True)),
                ("session", models.ForeignKey(
                    on_delete=django.db.models.deletion.CASCADE,
                    related_name="evidence", to="agent_sessions.agentsession")),
                ("result", models.ForeignKey(blank=True, null=True,
                    on_delete=django.db.models.deletion.SET_NULL,
                    related_name="evidence", to="agent_sessions.testcaseresult")),
            ],
            options={"ordering": ("session", "created_at")},
        ),
    ]
