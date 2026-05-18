import django.db.models.deletion
from django.db import migrations, models


class Migration(migrations.Migration):

    dependencies = [
        ("scenarios", "0004_widen_dut_type"),
        ("documents", "0001_initial"),
    ]

    operations = [
        migrations.AddField(
            model_name="testscenario",
            name="source_document",
            field=models.ForeignKey(
                blank=True, null=True,
                on_delete=django.db.models.deletion.SET_NULL,
                related_name="test_scenarios",
                to="documents.document",
            ),
        ),
        migrations.AddField(
            model_name="testscenario",
            name="source_section",
            field=models.CharField(
                blank=True,
                help_text="文件章節，例如 'O-RAN.WG3.E2AP-v03.00 §8.2.3'",
                max_length=120,
            ),
        ),
    ]
