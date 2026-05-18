from django.db import migrations, models


def migrate_ric_to_near_rt(apps, schema_editor):
    """既有 RIC 預設視為 Near-RT RIC（IVT 主要驗測對象）。
    如果之後出現 Non-RT RIC 設備，需 admin 手動切。"""
    Dut = apps.get_model("duts", "Dut")
    Dut.objects.filter(type="RIC").update(type="Near-RT RIC")


def migrate_near_rt_back_to_ric(apps, schema_editor):
    """Reverse: 把 Near-RT RIC + Non-RT RIC 收回 RIC（資訊有損）。"""
    Dut = apps.get_model("duts", "Dut")
    Dut.objects.filter(type__in=["Near-RT RIC", "Non-RT RIC"]).update(type="RIC")


class Migration(migrations.Migration):

    dependencies = [
        ("duts", "0006_remove_dataqualitybaseline_required_fields_and_more"),
    ]

    operations = [
        migrations.RunPython(migrate_ric_to_near_rt, migrate_near_rt_back_to_ric),
        migrations.AlterField(
            model_name="dut",
            name="type",
            field=models.CharField(
                choices=[
                    ("SMO", "SMO"),
                    ("Near-RT RIC", "Near-RT RIC"),
                    ("Non-RT RIC", "Non-RT RIC"),
                    ("xApp", "xApp"),
                    ("rApp", "rApp"),
                ],
                max_length=16,
            ),
        ),
        migrations.AlterField(
            model_name="dataqualitybaseline",
            name="dut",
            field=models.OneToOneField(
                limit_choices_to={
                    "type__in": ["SMO", "Near-RT RIC", "Non-RT RIC"]
                },
                on_delete=models.CASCADE,
                related_name="data_quality_baseline",
                to="duts.dut",
            ),
        ),
    ]
