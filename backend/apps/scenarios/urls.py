from rest_framework.routers import DefaultRouter

from .views import TestCaseViewSet, TestScenarioViewSet

router = DefaultRouter()
router.register("scenarios", TestScenarioViewSet, basename="scenario")
router.register("test-cases", TestCaseViewSet, basename="test-case")
urlpatterns = router.urls
