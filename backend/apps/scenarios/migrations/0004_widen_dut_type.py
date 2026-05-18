from django.db import migrations, models


class Migration(migrations.Migration):

    dependencies = [
        ("scenarios", "0003_delete_camera"),
    ]

    operations = [
        # 配合 duts.0007 把 RIC 拆成 "Near-RT RIC" / "Non-RT RIC"（11 chars）。
        migrations.AlterField(
            model_name="testscenario",
            name="dut_type",
            field=models.CharField(blank=True, max_length=16),
        ),
    ]
