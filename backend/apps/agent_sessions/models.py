"""把 Near-RT RIC Validation Agent 每場對話收進 IVT，當系統記錄 +
audit trail。設計重點：

  AgentSession  — 一場驗測（DUT、模式、起訖、最終結論）
   └ AgentStep      —— 對話每一輪（user / assistant 文字）
       ├ AgentCommand  —— 該輪內跑的 Bash 指令（含 stdout/stderr/exit）
       └ AgentArtifact —— 該輪存出的檔案（plan.md / yaml / report ...）

回朔場景：「上週給 OSC RIC J-release 做的 E2 Setup conformance 是
什麼結論？跑了哪些 case？實際送了哪些 PDU？引了哪份 spec？」直接
往 session 裡翻就有。
"""

import uuid

from django.db import models


class AgentSession(models.Model):
    class Mode(models.TextChoices):
        FUNCTIONAL = "functional", "功能"
        CONFORMANCE = "conformance", "一致性"
        IOT = "iot", "互通性"
        PERFORMANCE = "performance", "效能"
        RESILIENCE = "resilience", "韌性"
        EXPLORE = "explore", "探索 / 雜談"

    class Status(models.TextChoices):
        IN_PROGRESS = "in_progress", "進行中"
        COMPLETED = "completed", "完成"
        FAILED = "failed", "失敗"
        ABANDONED = "abandoned", "中止"

    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    # agent backend 自己的 session id，做 cross-reference 用
    agent_session_id = models.CharField(max_length=64, blank=True, db_index=True)

    title = models.CharField(max_length=300)
    mode = models.CharField(max_length=16, choices=Mode.choices, blank=True)
    dut = models.ForeignKey(
        "duts.Dut", on_delete=models.SET_NULL,
        null=True, blank=True, related_name="agent_sessions",
    )
    scenario = models.ForeignKey(
        "scenarios.TestScenario", on_delete=models.SET_NULL,
        null=True, blank=True, related_name="agent_sessions",
    )

    status = models.CharField(
        max_length=16, choices=Status.choices, default=Status.IN_PROGRESS,
    )
    summary = models.TextField(blank=True, help_text="最終結論 / pass-fail 摘要")
    # 引到哪些 spec / 規格文件
    cited_documents = models.ManyToManyField(
        "documents.Document", blank=True, related_name="agent_sessions",
    )

    started_at = models.DateTimeField(auto_now_add=True)
    ended_at = models.DateTimeField(null=True, blank=True)
    started_by = models.ForeignKey(
        "accounts.User", on_delete=models.SET_NULL,
        null=True, blank=True, related_name="agent_sessions",
    )

    class Meta:
        ordering = ("-started_at",)
        indexes = [
            models.Index(fields=["mode", "status"]),
            models.Index(fields=["dut", "started_at"]),
        ]

    def __str__(self) -> str:
        return f"[{self.mode or '?'}] {self.title}"


class AgentStep(models.Model):
    class Role(models.TextChoices):
        USER = "user", "使用者"
        ASSISTANT = "assistant", "Agent"

    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    session = models.ForeignKey(
        AgentSession, on_delete=models.CASCADE, related_name="steps",
    )
    seq = models.IntegerField()
    role = models.CharField(max_length=16, choices=Role.choices)
    text = models.TextField()
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering = ("session", "seq")
        unique_together = (("session", "seq"),)


class AgentCommand(models.Model):
    """Agent 跑的 shell 指令 —— 給 IVT 做 audit / 回朔，看實際打了哪些。"""

    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    step = models.ForeignKey(
        AgentStep, on_delete=models.CASCADE, related_name="commands",
    )
    command = models.TextField()
    stdout = models.TextField(blank=True)
    stderr = models.TextField(blank=True)
    exit_code = models.IntegerField(null=True, blank=True)
    duration_ms = models.IntegerField(null=True, blank=True)
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering = ("step", "created_at")


class AgentArtifact(models.Model):
    """Agent 產出的檔案 —— plan.md / test_cases.yaml / setup.sh 等。
    實體檔案可選存 MinIO（複用 documents 的 storage）或內嵌 text。"""

    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    session = models.ForeignKey(
        AgentSession, on_delete=models.CASCADE, related_name="artifacts",
    )
    # agent 端的相對路徑（generated/<slug>/plan.md）
    relpath = models.CharField(max_length=500)
    # 兩種儲存：小檔直接內嵌 text；大檔走 MinIO storage_key（複用 core.storage）
    text_content = models.TextField(blank=True)
    storage_key = models.CharField(max_length=500, blank=True)
    content_type = models.CharField(max_length=128, blank=True)
    size_bytes = models.BigIntegerField(null=True, blank=True)
    sha256 = models.CharField(max_length=64, blank=True)
    description = models.TextField(blank=True)
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering = ("session", "created_at")
