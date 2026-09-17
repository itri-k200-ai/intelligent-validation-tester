from django.urls import path

from .views import (
    CameraSnapshotView,
    CameraStatusView,
    CameraStreamView,
    LiveView,
    MissionView,
    PlanListView,
    RunAbortView,
    RunCreateView,
    TargetsView,
)

# 智慧網路中牆(室外 UAV / 室內 AMR)的資料來源 —— 代理外部 Performance_tester。
urlpatterns = [
    path("field-tests/targets/", TargetsView.as_view(), name="field-test-targets"),
    path("field-tests/plans/", PlanListView.as_view(), name="field-test-plans"),
    path("field-tests/runs/", RunCreateView.as_view(), name="field-test-run-create"),
    path(
        "field-tests/runs/<str:run_id>/abort/", RunAbortView.as_view(), name="field-test-run-abort"
    ),
    path("field-tests/live/<str:scenario>/", LiveView.as_view(), name="field-test-live"),
    path("field-tests/missions/<str:scenario>/", MissionView.as_view(), name="field-test-mission"),
    path(
        "field-tests/camera/<str:scenario>/", CameraStatusView.as_view(), name="field-test-camera"
    ),
    # 影像這兩支同時收有 / 無尾斜線:正式 nginx 照原樣轉,但 Next dev 的 rewrite
    # 會替 /api/* 補一個尾斜線(配合 Django APPEND_SLASH),少一條就會 404。
    path(
        "field-tests/camera/<str:scenario>/stream",
        CameraStreamView.as_view(),
        name="field-test-camera-stream",
    ),
    path("field-tests/camera/<str:scenario>/stream/", CameraStreamView.as_view()),
    path(
        "field-tests/camera/<str:scenario>/snapshot",
        CameraSnapshotView.as_view(),
        name="field-test-camera-snapshot",
    ),
    path("field-tests/camera/<str:scenario>/snapshot/", CameraSnapshotView.as_view()),
]
