from django.db import transaction
from django.shortcuts import get_object_or_404
from rest_framework import status, viewsets
from rest_framework.decorators import action
from rest_framework.response import Response
from rest_framework.views import APIView

from .models import BaseStation, Camera, Site, TopologyLink
from .serializers import (
    BaseStationSerializer,
    CameraSerializer,
    SiteSerializer,
    TopologyLinkSerializer,
    TopologyPatchSerializer,
    TopologySerializer,
)


class CameraListView(APIView):
    """扁平列出所有攝影機(通用「環境影像」用,不綁特定 site)。

    電視牆的「即時環境影像」來源。攝影機是牆的通用能力,各 tester 共用,
    所以提供這個不綁 site 的清單端點。hls_url 由 serializer 依 ivt-mediamtx 產生。
    """

    def get(self, request):
        qs = Camera.objects.select_related("site").all()
        return Response(CameraSerializer(qs, many=True).data)


class SiteViewSet(viewsets.ModelViewSet):
    queryset = Site.objects.all()
    serializer_class = SiteSerializer
    filterset_fields = ("region", "environment")
    search_fields = ("name", "address")
    ordering_fields = ("name", "created_at")
    lookup_value_regex = "[0-9a-f-]{36}"

    @action(detail=True, methods=["get", "post"], url_path="stations")
    def stations(self, request, pk=None):
        site = self.get_object()
        if request.method == "GET":
            qs = site.stations.all()
            return Response(BaseStationSerializer(qs, many=True).data)
        data = {**request.data, "site": str(site.id)}
        serializer = BaseStationSerializer(data=data)
        serializer.is_valid(raise_exception=True)
        serializer.save()
        return Response(serializer.data, status=status.HTTP_201_CREATED)

    @action(
        detail=True,
        methods=["patch", "delete"],
        url_path=r"stations/(?P<code>[^/]+)",
    )
    def station_detail(self, request, pk=None, code=None):
        site = self.get_object()
        station = get_object_or_404(BaseStation, site=site, code=code)
        if request.method == "DELETE":
            station.delete()
            return Response(status=status.HTTP_204_NO_CONTENT)
        serializer = BaseStationSerializer(station, data=request.data, partial=True)
        serializer.is_valid(raise_exception=True)
        serializer.save()
        return Response(serializer.data)

    @action(detail=True, methods=["get", "post"], url_path="cameras")
    def cameras(self, request, pk=None):
        site = self.get_object()
        if request.method == "GET":
            return Response(CameraSerializer(site.cameras.all(), many=True).data)
        data = {**request.data, "site": str(site.id)}
        serializer = CameraSerializer(data=data)
        serializer.is_valid(raise_exception=True)
        serializer.save()
        return Response(serializer.data, status=status.HTTP_201_CREATED)

    @action(
        detail=True,
        methods=["patch", "delete"],
        url_path=r"cameras/(?P<cam_id>[0-9a-f-]{36})",
    )
    def camera_detail(self, request, pk=None, cam_id=None):
        site = self.get_object()
        camera = get_object_or_404(Camera, site=site, id=cam_id)
        if request.method == "DELETE":
            camera.delete()
            return Response(status=status.HTTP_204_NO_CONTENT)
        serializer = CameraSerializer(camera, data=request.data, partial=True)
        serializer.is_valid(raise_exception=True)
        serializer.save()
        return Response(serializer.data)

    @action(detail=True, methods=["get", "patch"], url_path="topology")
    def topology(self, request, pk=None):
        site = self.get_object()
        if request.method == "GET":
            stations = site.stations.all()
            links = TopologyLink.objects.filter(source__site=site)
            payload = TopologySerializer({"stations": stations, "links": links}).data
            return Response(payload)
        patch = TopologyPatchSerializer(data=request.data)
        patch.is_valid(raise_exception=True)
        station_ids = set(site.stations.values_list("id", flat=True))
        with transaction.atomic():
            TopologyLink.objects.filter(source__site=site).delete()
            for link in patch.validated_data["links"]:
                if link["source"] not in station_ids or link["target"] not in station_ids:
                    return Response(
                        {"error": {"code": "INVALID_LINK",
                                   "message": "source/target must belong to this site"}},
                        status=status.HTTP_400_BAD_REQUEST,
                    )
                TopologyLink.objects.create(
                    source_id=link["source"],
                    target_id=link["target"],
                    bandwidth=link.get("bandwidth", ""),
                    latency_ms=link.get("latency_ms"),
                    status=link.get("status", "normal"),
                )
        links = TopologyLink.objects.filter(source__site=site)
        return Response(TopologyLinkSerializer(links, many=True).data)
