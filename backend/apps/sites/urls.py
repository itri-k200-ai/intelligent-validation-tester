from django.urls import path
from rest_framework.routers import DefaultRouter

from .views import CameraListView, SiteViewSet

router = DefaultRouter()
router.register("sites", SiteViewSet, basename="site")
urlpatterns = [
    path("cameras/", CameraListView.as_view(), name="camera-list"),
    *router.urls,
]
