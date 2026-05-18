import uuid

from django.db import models


class Platform(models.Model):
    class Type(models.TextChoices):
        SMO = "SMO", "SMO"
        NEAR_RT_RIC = "Near-RT RIC", "Near-RT RIC"
        NON_RT_RIC = "Non-RT RIC", "Non-RT RIC"

    class Status(models.TextChoices):
        PENDING = "pending", "待驗證"
        RUNNING = "running", "驗證中"
        PASSED = "passed", "通過"
        FAILED = "failed", "未通過"

    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    name = models.CharField(max_length=200)
    type = models.CharField(max_length=16, choices=Type.choices)
    vendor = models.CharField(max_length=200)
    version = models.CharField(max_length=64)
    category = models.CharField(max_length=32, blank=True)
    ai_cases = models.JSONField(default=list)
    endpoint = models.URLField()
    submitted_by = models.ForeignKey("accounts.User", on_delete=models.PROTECT,
                                      related_name="platforms")
    submit_date = models.DateTimeField(auto_now_add=True)
    status = models.CharField(max_length=16, choices=Status.choices, default=Status.PENDING)

    class Meta:
        indexes = [models.Index(fields=["type", "status"])]
        ordering = ("-submit_date",)

    def __str__(self) -> str:
        return f"{self.type}:{self.name}"
