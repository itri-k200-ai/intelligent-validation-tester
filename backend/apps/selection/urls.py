from django.urls import path

from .views import CatalogView, CurrentSelectionView

urlpatterns = [
    path("selection/catalog/", CatalogView.as_view(), name="selection_catalog"),
    path("selection/current/", CurrentSelectionView.as_view(), name="selection_current"),
]
