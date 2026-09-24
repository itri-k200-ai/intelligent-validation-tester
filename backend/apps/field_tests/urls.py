from django.urls import path

from .views import (
    CameraSnapshotView,
    CameraStatusView,
    CameraStreamView,
    HistoryShowView,
    LiveView,
    MissionView,
    PlanListView,
    RecordListView,
    ReplayFrameView,
    ReplayView,
    RunAbortView,
    RunCreateView,
    SceneView,
    TargetsView,
)

# 智慧網路中牆(室外 UAV / 室內 AMR)的資料來源 —— 代理外部 Performance_tester。
urlpatterns = [
    path("field-tests/targets/", TargetsView.as_view(), name="field-test-targets"),
    path("field-tests/plans/", PlanListView.as_view(), name="field-test-plans"),
    # 驗測紀錄清單 —— 左螢幕挑「要顯示哪一次歷史」用
    path("field-tests/records/", RecordListView.as_view(), name="field-test-records"),
    path("field-tests/runs/", RunCreateView.as_view(), name="field-test-run-create"),
    path(
        "field-tests/runs/<str:run_id>/abort/", RunAbortView.as_view(), name="field-test-run-abort"
    ),
    path("field-tests/live/<str:scenario>/", LiveView.as_view(), name="field-test-live"),
    path("field-tests/scene/<str:scenario>/", SceneView.as_view(), name="field-test-scene"),
    # 歷史驗測的影像回放:索引 + 逐張畫面(前端連不到場域網段,都要經這裡代理)
    path("field-tests/replay/<str:scenario>/", ReplayView.as_view(), name="field-test-replay"),
    path(
        "field-tests/replay/<str:scenario>/<str:cam>/<int:index>.jpg",
        ReplayFrameView.as_view(),
        name="field-test-replay-frame",
    ),
    path("field-tests/missions/<str:scenario>/", MissionView.as_view(), name="field-test-mission"),
    # 平台(經 IM adapter 的 notifyHisShow)指定牆上要顯示哪一次歷史驗測
    path("field-tests/history/", HistoryShowView.as_view(), name="field-test-history"),
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
