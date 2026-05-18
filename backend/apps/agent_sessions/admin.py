from django.contrib import admin

from .models import AgentArtifact, AgentCommand, AgentSession, AgentStep


class StepInline(admin.TabularInline):
    model = AgentStep
    extra = 0
    readonly_fields = ("seq", "role", "created_at")
    fields = ("seq", "role", "text", "created_at")


class CommandInline(admin.TabularInline):
    model = AgentCommand
    extra = 0
    readonly_fields = ("command", "exit_code", "duration_ms", "created_at")
    fields = ("command", "exit_code", "duration_ms", "stdout", "stderr", "created_at")


class ArtifactInline(admin.TabularInline):
    model = AgentArtifact
    extra = 0
    readonly_fields = ("relpath", "size_bytes", "sha256", "created_at")


@admin.register(AgentSession)
class AgentSessionAdmin(admin.ModelAdmin):
    list_display = ("title", "mode", "dut", "status", "started_at", "ended_at")
    list_filter = ("status", "mode")
    search_fields = ("title", "summary", "agent_session_id")
    inlines = [StepInline, ArtifactInline]


@admin.register(AgentStep)
class AgentStepAdmin(admin.ModelAdmin):
    list_display = ("session", "seq", "role", "created_at")
    inlines = [CommandInline]


@admin.register(AgentCommand)
class AgentCommandAdmin(admin.ModelAdmin):
    list_display = ("step", "command", "exit_code", "duration_ms", "created_at")


@admin.register(AgentArtifact)
class AgentArtifactAdmin(admin.ModelAdmin):
    list_display = ("session", "relpath", "size_bytes", "created_at")
