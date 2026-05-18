"""Document = IVT 作為 system of record 時、各種驗測案例 / DUT / 報告
背後的「原始文件」。Spec PDF、客戶提供的測試需求、設備 datasheet 等
都當 Document 處理：DB 存元資料 + MinIO 存實體檔案。"""

import uuid

from django.db import models


class Document(models.Model):
    class DocType(models.TextChoices):
        SPEC = "spec", "標準規範"          # O-RAN / 3GPP 公開規格
        INTERNAL = "internal", "內部文件"   # 自訂測試準則 / SOP
        DATASHEET = "datasheet", "設備規格"  # 廠商 datasheet / release notes
        CUSTOMER = "customer", "客戶提供"   # 客戶丟過來的需求 / 測試要求
        OTHER = "other", "其他"

    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    name = models.CharField(max_length=300)
    doc_type = models.CharField(max_length=16, choices=DocType.choices)
    version = models.CharField(max_length=64, blank=True)  # 例：v03.00、Rel-17
    source_url = models.URLField(
        blank=True,
        help_text="原始來源 URL（O-RAN 官網、客戶 share point 等）",
    )

    # 實體檔案存 MinIO；DB 只放 key + 元資料。
    storage_key = models.CharField(max_length=500)
    size_bytes = models.BigIntegerField(null=True, blank=True)
    sha256 = models.CharField(max_length=64, blank=True)
    content_type = models.CharField(max_length=128, blank=True)

    description = models.TextField(blank=True)
    uploaded_by = models.ForeignKey(
        "accounts.User",
        on_delete=models.SET_NULL,
        null=True, blank=True,
        related_name="uploaded_documents",
    )
    uploaded_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering = ("-uploaded_at",)
        indexes = [
            models.Index(fields=["doc_type", "uploaded_at"]),
        ]

    def __str__(self) -> str:
        v = f" {self.version}" if self.version else ""
        return f"[{self.get_doc_type_display()}] {self.name}{v}"
