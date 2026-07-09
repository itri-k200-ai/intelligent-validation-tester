from django.db import migrations, models


class Migration(migrations.Migration):

    dependencies = [
        ("scenarios", "0006_testcase"),
    ]

    operations = [
        migrations.AddField(
            model_name="testcase",
            name="interface",
            field=models.CharField(
                blank=True, help_text="對應介面 E2 / A1 / O1（Near-RT RIC 用）", max_length=8
            ),
        ),
        migrations.AddField(
            model_name="testcase",
            name="oran_release",
            field=models.CharField(
                blank=True, help_text="O-RAN 版本，例 R003 / v03.00", max_length=32
            ),
        ),
        migrations.AddField(
            model_name="testcase",
            name="spec_url",
            field=models.URLField(blank=True, help_text="規格 PDF 連結"),
        ),
    ]
