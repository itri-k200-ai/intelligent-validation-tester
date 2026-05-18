import uuid

import django.db.models.deletion
from django.db import migrations, models


class Migration(migrations.Migration):

    dependencies = [
        ("scenarios", "0005_testscenario_source_document_and_section"),
        ("documents", "0002_issuing_body_doc_number_pub_date_status"),
    ]

    operations = [
        migrations.CreateModel(
            name="TestCase",
            fields=[
                ("id", models.UUIDField(default=uuid.uuid4, editable=False, primary_key=True, serialize=False)),
                ("case_id", models.CharField(help_text="TC-01 / TC-A-3 等短碼", max_length=32)),
                ("name", models.CharField(max_length=200)),
                ("priority", models.CharField(choices=[
                    ("P0", "P0 (基礎門檻)"),
                    ("P1", "P1 (異常 / 恢復)"),
                    ("P2", "P2 (邊角)"),
                ], default="P1", max_length=4)),
                ("preconditions", models.TextField(blank=True)),
                ("test_steps", models.TextField(blank=True, help_text="條列步驟")),
                ("expected_result", models.TextField(blank=True)),
                ("pass_criteria", models.TextField(blank=True)),
                ("spec_sections", models.JSONField(blank=True, default=list,
                    help_text="引用章節清單，例：['E2AP §8.2.3', 'E2GAP §6']")),
                ("tags", models.JSONField(blank=True, default=list)),
                ("created_at", models.DateTimeField(auto_now_add=True)),
                ("updated_at", models.DateTimeField(auto_now=True)),
                ("scenario", models.ForeignKey(
                    on_delete=django.db.models.deletion.CASCADE,
                    related_name="test_cases", to="scenarios.testscenario")),
                ("spec_references", models.ManyToManyField(
                    blank=True, help_text="此 TC 引用的規格文件（M2M）",
                    related_name="referenced_by_test_cases", to="documents.document")),
            ],
            options={
                "ordering": ("scenario", "case_id"),
                "unique_together": {("scenario", "case_id")},
            },
        ),
    ]
