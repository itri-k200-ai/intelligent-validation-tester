from django.contrib import admin

from .models import Document


@admin.register(Document)
class DocumentAdmin(admin.ModelAdmin):
    list_display = ("name", "doc_type", "version", "size_bytes", "uploaded_at", "uploaded_by")
    list_filter = ("doc_type",)
    search_fields = ("name", "version", "description")
    readonly_fields = ("storage_key", "size_bytes", "sha256", "content_type", "uploaded_at")
