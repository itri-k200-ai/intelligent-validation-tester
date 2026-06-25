from django.conf import settings
from django.contrib.auth.hashers import make_password
from django.db import migrations


def seed_admin(apps, schema_editor):
    User = apps.get_model("accounts", "User")
    if User.objects.filter(email="admin@ivt.local").exists():
        return
    User.objects.create(
        email="admin@ivt.local",
        username="admin",
        password=make_password("admin"),
        role="admin",
        is_staff=True,
        is_superuser=True,
        is_active=True,
        must_change_password=True,
    )


def unseed_admin(apps, schema_editor):
    User = apps.get_model("accounts", "User")
    User.objects.filter(email="admin@ivt.local").delete()


class Migration(migrations.Migration):
    dependencies = [("accounts", "0001_initial")]
    operations = [migrations.RunPython(seed_admin, unseed_admin)]
