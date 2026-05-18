import uuid

from django.db import models


class TestScenario(models.Model):
    class ValidationType(models.TextChoices):
        DATA = "data-validation", "資料基礎驗證"
        INTELLIGENCE = "intelligence-validation", "智慧程度驗證"
        INTERFACE = "interface-validation", "連接介面驗證"

    class Category(models.TextChoices):
        UNDERGROUND = "underground", "地下樓層"
        GROUND_FLOOR = "ground-floor", "地面樓層"
        HIGH_FLOOR = "high-floor", "高樓層"

    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    name = models.CharField(max_length=200)
    site = models.ForeignKey(
        "sites.Site", on_delete=models.CASCADE, related_name="test_scenarios",
        null=True, blank=True,
    )
    source_dut = models.ForeignKey(
        "duts.Dut", on_delete=models.SET_NULL, related_name="test_scenarios",
        null=True, blank=True,
    )
    validation_type = models.CharField(max_length=32, choices=ValidationType.choices)
    dut_type = models.CharField(max_length=16, blank=True)  # 16 chars 才放得下 "Near-RT RIC"
    ai_case = models.CharField(max_length=64, blank=True)
    category = models.CharField(max_length=32, choices=Category.choices)
    collected_at = models.DateTimeField(null=True, blank=True)
    row_count = models.IntegerField(null=True, blank=True)
    description = models.TextField(blank=True)
    parameters = models.JSONField(default=dict)

    # Provenance — 這個 case 從哪份文件來。可空（內部自訂 case 可能沒有）。
    source_document = models.ForeignKey(
        "documents.Document",
        on_delete=models.SET_NULL,
        null=True, blank=True,
        related_name="test_scenarios",
    )
    source_section = models.CharField(
        max_length=120, blank=True,
        help_text="文件章節，例如 'O-RAN.WG3.E2AP-v03.00 §8.2.3'",
    )

    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        indexes = [
            models.Index(fields=["validation_type", "category"]),
            models.Index(fields=["site", "collected_at"]),
        ]
        ordering = ("-collected_at", "-created_at")

    def __str__(self) -> str:
        return self.name
