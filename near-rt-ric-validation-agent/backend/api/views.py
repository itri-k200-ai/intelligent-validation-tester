from rest_framework import viewsets
from rest_framework.decorators import api_view
from rest_framework.response import Response

from .models import Instance, Job, Message, Persona, Session
from .serializers import (
    InstanceSerializer,
    JobSerializer,
    MessageSerializer,
    PersonaSerializer,
    SessionSerializer,
)


class PersonaViewSet(viewsets.ReadOnlyModelViewSet):
    queryset = Persona.objects.all().order_by("slug")
    serializer_class = PersonaSerializer
    lookup_field = "slug"


class SessionViewSet(viewsets.ModelViewSet):
    queryset = Session.objects.all()
    serializer_class = SessionSerializer


class InstanceViewSet(viewsets.ModelViewSet):
    queryset = Instance.objects.all()
    serializer_class = InstanceSerializer


class JobViewSet(viewsets.ReadOnlyModelViewSet):
    queryset = Job.objects.all().order_by("-started_at")
    serializer_class = JobSerializer


@api_view(["GET"])
def session_messages(request, session_id):
    msgs = Message.objects.filter(session_id=session_id).order_by("id")
    return Response(MessageSerializer(msgs, many=True).data)


@api_view(["GET"])
def healthz(request):
    return Response({"ok": True})
