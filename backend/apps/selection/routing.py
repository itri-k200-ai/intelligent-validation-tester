from django.urls import path

from .consumers import WallSelectionConsumer

websocket_urlpatterns = [
    path("ws/selection/", WallSelectionConsumer.as_asgi()),
]
