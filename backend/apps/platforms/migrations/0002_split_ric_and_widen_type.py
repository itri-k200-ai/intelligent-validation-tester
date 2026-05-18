from django.db import migrations, models


def migrate_ric_to_near_rt(apps, schema_editor):
    """既有 Platform.type=RIC 預設視為 Near-RT RIC。"""
    Platform = apps.get_model("platforms", "Platform")
    Platform.objects.filter(type="RIC").update(type="Near-RT RIC")


def migrate_near_rt_back_to_ric(apps, schema_editor):
    Platform = apps.get_model("platforms", "Platform")
    Platform.objects.filter(type__in=["Near-RT RIC", "Non-RT RIC"]).update(type="RIC")


class Migration(migrations.Migration):

    dependencies = [
        ("platforms", "0001_initial"),
    ]

    operations = [
        # 先把 column 拓寬，否則 'Near-RT RIC' (11 chars) 塞不進 max_length=8。
        migrations.AlterField(
            model_name="platform",
            name="type",
            field=models.CharField(
                choices=[("SMO", "SMO"), ("RIC", "RIC")],
                max_length=16,
            ),
        ),
        migrations.RunPython(migrate_ric_to_near_rt, migrate_near_rt_back_to_ric),
        migrations.AlterField(
            model_name="platform",
            name="type",
            field=models.CharField(
                choices=[
                    ("SMO", "SMO"),
                    ("Near-RT RIC", "Near-RT RIC"),
                    ("Non-RT RIC", "Non-RT RIC"),
                ],
                max_length=16,
            ),
        ),
    ]
