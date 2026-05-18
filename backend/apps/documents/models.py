"""Document = IVT 作為 system of record 時、各種驗測案例 / DUT / 報告
背後的「原始文件」。Spec PDF、客戶提供的測試需求、設備 datasheet 等
都當 Document 處理：DB 存元資料 + MinIO 存實體檔案。"""

import uuid

from django.db import models


class Document(models.Model):
    class DocType(models.TextChoices):
        SPEC = "spec", "標準規範"          # O-RAN / 3GPP / IETF / ITU-T 公開規格
        INTERNAL = "internal", "內部文件"   # 自訂測試準則 / SOP
        DATASHEET = "datasheet", "設備規格"  # 廠商 datasheet / release notes
        CUSTOMER = "customer", "客戶提供"   # 客戶丟過來的需求 / 測試要求
        OTHER = "other", "其他"

    class IssuingBody(models.TextChoices):
        """發行的標準制定組織。spec 必填；其他 doc_type 可空。"""
        IETF = "IETF", "IETF"
        TGPP = "3GPP", "3GPP"
        ITU_T = "ITU-T", "ITU-T"
        IEEE = "IEEE", "IEEE"
        ORAN = "O-RAN", "O-RAN Alliance"
        ETSI = "ETSI", "ETSI"
        OTHER = "OTHER", "其他"

    class Status(models.TextChoices):
        """規格的生命週期狀態 —— sign-off 報告不能引 obsolete 的。"""
        DRAFT = "draft", "草案"
        ACTIVE = "active", "現行"
        SUPERSEDED = "superseded", "已被取代"
        OBSOLETE = "obsolete", "廢止"
        WITHDRAWN = "withdrawn", "撤回"

    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)

    # 文件識別
    name = models.CharField(max_length=300)
    doc_type = models.CharField(max_length=16, choices=DocType.choices)
    issuing_body = models.CharField(
        max_length=8, choices=IssuingBody.choices, blank=True,
        help_text="standards body / SDO。spec 強烈建議填。",
    )
    doc_number = models.CharField(
        max_length=64, blank=True,
        help_text="正式編號，例：RFC 4960、TS 38.300、Y.3172、O-RAN.WG3.E2AP",
    )
    version = models.CharField(max_length=64, blank=True)  # 例：v03.00、Rel-17、v16.4.0
    publication_date = models.DateField(null=True, blank=True)
    status = models.CharField(
        max_length=16, choices=Status.choices,
        default=Status.ACTIVE, blank=True,
    )
    source_url = models.URLField(
        blank=True,
        help_text="原始來源 URL（IETF rfc-editor、ETSI deliver、客戶 share point 等）",
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
            models.Index(fields=["issuing_body", "doc_number"]),
            models.Index(fields=["status"]),
        ]

    def __str__(self) -> str:
        parts = []
        if self.issuing_body:
            parts.append(f"[{self.issuing_body}]")
        if self.doc_number:
            parts.append(self.doc_number)
        parts.append(self.name)
        if self.version:
            parts.append(f"({self.version})")
        return " ".join(parts)
