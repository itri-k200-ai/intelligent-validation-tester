from django.db import migrations, models


class Migration(migrations.Migration):

    dependencies = [
        ("documents", "0001_initial"),
    ]

    operations = [
        migrations.AddField(
            model_name="document",
            name="issuing_body",
            field=models.CharField(
                blank=True,
                choices=[
                    ("IETF", "IETF"),
                    ("3GPP", "3GPP"),
                    ("ITU-T", "ITU-T"),
                    ("IEEE", "IEEE"),
                    ("O-RAN", "O-RAN Alliance"),
                    ("ETSI", "ETSI"),
                    ("OTHER", "其他"),
                ],
                help_text="standards body / SDO。spec 強烈建議填。",
                max_length=8,
            ),
        ),
        migrations.AddField(
            model_name="document",
            name="doc_number",
            field=models.CharField(
                blank=True,
                help_text="正式編號，例：RFC 4960、TS 38.300、Y.3172、O-RAN.WG3.E2AP",
                max_length=64,
            ),
        ),
        migrations.AddField(
            model_name="document",
            name="publication_date",
            field=models.DateField(blank=True, null=True),
        ),
        migrations.AddField(
            model_name="document",
            name="status",
            field=models.CharField(
                blank=True,
                choices=[
                    ("draft", "草案"),
                    ("active", "現行"),
                    ("superseded", "已被取代"),
                    ("obsolete", "廢止"),
                    ("withdrawn", "撤回"),
                ],
                default="active",
                max_length=16,
            ),
        ),
        migrations.AddIndex(
            model_name="document",
            index=models.Index(
                fields=["issuing_body", "doc_number"],
                name="documents_d_issuing_idx",
            ),
        ),
        migrations.AddIndex(
            model_name="document",
            index=models.Index(
                fields=["status"],
                name="documents_d_status_idx",
            ),
        ),
    ]
