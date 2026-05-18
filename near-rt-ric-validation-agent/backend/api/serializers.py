from rest_framework import serializers

from .models import Instance, Job, Message, Persona, Session


class PersonaSerializer(serializers.ModelSerializer):
    class Meta:
        model = Persona
        fields = ["slug", "display_name", "description", "controls_overlay", "source_file", "synced_at"]


class MessageSerializer(serializers.ModelSerializer):
    class Meta:
        model = Message
        fields = ["id", "role", "content", "created_at"]


class SessionSerializer(serializers.ModelSerializer):
    message_count = serializers.SerializerMethodField()

    class Meta:
        model = Session
        fields = ["id", "title", "claude_session_id", "created_at", "updated_at", "message_count"]
        read_only_fields = ["claude_session_id"]

    def get_message_count(self, obj):
        return obj.messages.count()


class InstanceSerializer(serializers.ModelSerializer):
    class Meta:
        model = Instance
        fields = [
            "id", "session", "name", "persona", "controls",
            "output_path", "status", "created_at", "updated_at",
        ]


class JobSerializer(serializers.ModelSerializer):
    class Meta:
        model = Job
        fields = ["id", "instance", "session", "kind", "status", "log", "started_at", "ended_at"]
