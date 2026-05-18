from django.db import migrations, models


class Migration(migrations.Migration):

    dependencies = [
        ("duts", "0008_dut_access_mode_and_notes"),
    ]

    operations = [
        migrations.AddField(model_name="dut", name="vendor",
            field=models.CharField(blank=True, max_length=100)),
        migrations.AddField(model_name="dut", name="model",
            field=models.CharField(blank=True, max_length=100)),
        migrations.AddField(model_name="dut", name="firmware_version",
            field=models.CharField(blank=True, max_length=64)),
        migrations.AddField(model_name="dut", name="serial_number",
            field=models.CharField(blank=True, max_length=120)),
        migrations.AddField(model_name="dut", name="deployed_at",
            field=models.DateField(blank=True, null=True)),
        migrations.AddField(model_name="dut", name="contact_email",
            field=models.EmailField(blank=True, max_length=254)),
        migrations.AddField(model_name="dut", name="config_snapshot",
            field=models.JSONField(blank=True, default=dict,
                help_text="當前配置摘要（自由 JSON），給驗測對齊基準")),
    ]
