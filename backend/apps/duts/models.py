import uuid

from django.db import models


class Dut(models.Model):
    class Type(models.TextChoices):
        SMO = "SMO", "SMO"
        NEAR_RT_RIC = "Near-RT RIC", "Near-RT RIC"
        NON_RT_RIC = "Non-RT RIC", "Non-RT RIC"
        XAPP = "xApp", "xApp"
        RAPP = "rApp", "rApp"

    class Status(models.TextChoices):
        ONLINE = "online", "Online"
        OFFLINE = "offline", "Offline"
        ERROR = "error", "Error"

    class AccessMode(models.TextChoices):
        """怎麼接到這台 DUT —— 決定哪些 case 跑得起來、結果怎麼回流。"""
        ON_SITE = "on_site", "本地實驗室自接"
        REMOTE_VPN = "remote_vpn", "遠端 VPN"
        REMOTE_PUBLIC = "remote_public", "公網 IP + jump host"
        SHIPPED = "shipped", "對方寄機器來"
        SIMULATOR_LOCAL = "simulator_local", "本機模擬器"
        SANDBOX_ONLY = "sandbox_only", "純沙箱 / 紙上"
        UNKNOWN = "unknown", "未指定"

    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    site = models.ForeignKey(
        "sites.Site", on_delete=models.CASCADE, related_name="duts"
    )
    name = models.CharField(max_length=200)
    type = models.CharField(max_length=16, choices=Type.choices)
    endpoint = models.CharField(max_length=500)
    interfaces = models.JSONField(default=list)
    status = models.CharField(max_length=16, choices=Status.choices, default=Status.OFFLINE)
    response_time_ms = models.IntegerField(null=True, blank=True)
    data_format = models.CharField(max_length=32, blank=True)
    last_check = models.DateTimeField(null=True, blank=True)
    created_at = models.DateTimeField(auto_now_add=True)

    access_mode = models.CharField(
        max_length=20, choices=AccessMode.choices,
        default=AccessMode.UNKNOWN,
    )
    access_notes = models.TextField(
        blank=True,
        help_text="跳板機 / VPN 設定 / 機器寄送單號 / 啟動 script 路徑等",
    )

    # 設備身份 / sign-off 報告需要
    vendor = models.CharField(max_length=100, blank=True)
    model = models.CharField(max_length=100, blank=True)
    firmware_version = models.CharField(max_length=64, blank=True)
    serial_number = models.CharField(max_length=120, blank=True)
    deployed_at = models.DateField(null=True, blank=True)
    contact_email = models.EmailField(blank=True)
    config_snapshot = models.JSONField(
        default=dict, blank=True,
        help_text="當前配置摘要（自由 JSON），給驗測對齊基準",
    )

    # ── 對齊 RICtester 的 DUT 欄位（現階段主要給 Near-RT RIC 用）─────────
    # ③ 產品身分:RICtester 有 product / version / description。
    description = models.TextField(blank=True, help_text="受測設備描述")
    product = models.CharField(max_length=200, blank=True, help_text="產品名稱（ex: Acme Near-RT RIC）")
    version = models.CharField(max_length=64, blank=True, help_text="產品版本（ex: v2.1.0）")

    # ① E2 身分:驗 E2 時探針冒充一顆 gNB 連 RIC,這四欄是那顆假 gNB 的識別碼。
    # 只驗 A1 / O1 可全留空。Near-RT RIC 專用。
    e2_mcc = models.CharField(max_length=8, blank=True, help_text="E2 身分 — MCC 行動國碼（ex: 455）")
    e2_mnc = models.CharField(max_length=8, blank=True, help_text="E2 身分 — MNC 行動網路碼（ex: 637）")
    e2_gnb_id = models.CharField(max_length=32, blank=True, help_text="E2 身分 — gNB ID（ex: 201507）")
    e2_cell_id = models.CharField(max_length=32, blank=True, help_text="E2 身分 — Cell ID（ex: 0）")

    # ② 每介面連線位址（加欄位版,取代單一 endpoint 對每個介面共用）。
    # 位址格式:E2=SCTP IP:port、A1=A1-P URL、O1=NETCONF IP:port(+ 帳密)。
    e2_address = models.CharField(max_length=255, blank=True, help_text="E2 SCTP 位址:埠（ex: 10.3.0.71:32222）")
    a1_address = models.CharField(max_length=255, blank=True, help_text="A1-P URL（ex: http://10.3.0.71:30183）")
    o1_address = models.CharField(max_length=255, blank=True, help_text="O1 NETCONF 位址:埠（ex: 10.3.0.71:30830）")
    o1_username = models.CharField(max_length=120, blank=True, help_text="O1 NETCONF 帳號")
    o1_password = models.CharField(max_length=255, blank=True, help_text="O1 NETCONF 密碼")

    class Meta:
        indexes = [models.Index(fields=["type", "status"])]
        ordering = ("-created_at",)

    def __str__(self) -> str:
        return f"{self.type}:{self.name}"


class DataQualityBaseline(models.Model):
    class TestCategory(models.TextChoices):
        UNDERGROUND = "underground", "地下樓層"
        GROUND_FLOOR = "ground-floor", "地面樓層"
        HIGH_FLOOR = "high-floor", "高樓層"

    dut = models.OneToOneField(
        Dut,
        on_delete=models.CASCADE,
        related_name="data_quality_baseline",
        limit_choices_to={"type__in": [
            Dut.Type.SMO, Dut.Type.NEAR_RT_RIC, Dut.Type.NON_RT_RIC,
        ]},
    )
    test_category = models.CharField(
        max_length=32, choices=TestCategory.choices, blank=True,
    )
    supported_ai_cases = models.JSONField(default=list)
    test_scenarios = models.ManyToManyField(
        "scenarios.TestScenario",
        blank=True,
        related_name="data_quality_baselines",
    )
    timeliness_max_lag_sec = models.IntegerField(default=60)
    min_completeness = models.FloatField(default=90.0)
    min_accuracy = models.FloatField(default=85.0)
    notes = models.TextField(blank=True)
    updated_at = models.DateTimeField(auto_now=True)

    def __str__(self) -> str:
        return f"Baseline<{self.dut.name}>"
