from django.db import migrations, models


class Migration(migrations.Migration):

    dependencies = [
        ("duts", "0007_split_ric_into_near_rt_and_non_rt"),
    ]

    operations = [
        migrations.AddField(
            model_name="dut",
            name="access_mode",
            field=models.CharField(
                choices=[
                    ("on_site", "本地實驗室自接"),
                    ("remote_vpn", "遠端 VPN"),
                    ("remote_public", "公網 IP + jump host"),
                    ("shipped", "對方寄機器來"),
                    ("simulator_local", "本機模擬器"),
                    ("sandbox_only", "純沙箱 / 紙上"),
                    ("unknown", "未指定"),
                ],
                default="unknown",
                max_length=20,
            ),
        ),
        migrations.AddField(
            model_name="dut",
            name="access_notes",
            field=models.TextField(
                blank=True,
                help_text="跳板機 / VPN 設定 / 機器寄送單號 / 啟動 script 路徑等",
            ),
        ),
    ]
