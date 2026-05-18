import uuid

import django.db.models.deletion
from django.conf import settings
from django.db import migrations, models


class Migration(migrations.Migration):

    initial = True

    dependencies = [
        migrations.swappable_dependency(settings.AUTH_USER_MODEL),
    ]

    operations = [
        migrations.CreateModel(
            name="Document",
            fields=[
                ("id", models.UUIDField(default=uuid.uuid4, editable=False, primary_key=True, serialize=False)),
                ("name", models.CharField(max_length=300)),
                ("doc_type", models.CharField(choices=[
                    ("spec", "標準規範"),
                    ("internal", "內部文件"),
                    ("datasheet", "設備規格"),
                    ("customer", "客戶提供"),
                    ("other", "其他"),
                ], max_length=16)),
                ("version", models.CharField(blank=True, max_length=64)),
                ("source_url", models.URLField(blank=True, help_text="原始來源 URL（O-RAN 官網、客戶 share point 等）")),
                ("storage_key", models.CharField(max_length=500)),
                ("size_bytes", models.BigIntegerField(blank=True, null=True)),
                ("sha256", models.CharField(blank=True, max_length=64)),
                ("content_type", models.CharField(blank=True, max_length=128)),
                ("description", models.TextField(blank=True)),
                ("uploaded_at", models.DateTimeField(auto_now_add=True)),
                ("uploaded_by", models.ForeignKey(
                    blank=True, null=True,
                    on_delete=django.db.models.deletion.SET_NULL,
                    related_name="uploaded_documents",
                    to=settings.AUTH_USER_MODEL,
                )),
            ],
            options={
                "ordering": ("-uploaded_at",),
                "indexes": [models.Index(fields=["doc_type", "uploaded_at"], name="documents_d_doc_typ_idx")],
            },
        ),
    ]
