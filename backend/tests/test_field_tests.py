"""場域測試(智慧網路中牆)代理層的行為。

外部 Performance_tester 不在測試環境裡,所以把 client.get 換掉 —— 這裡要驗的是
「我們有沒有正確轉換與正確處理失敗」,不是對方活著沒。
"""

import math

import pytest
from django.test import override_settings
from rest_framework.test import APIClient

from apps.field_tests import client as perf_client
from apps.field_tests import transform, views


@pytest.fixture(autouse=True)
def _clear_caches():
    """views 的快取是模組層級的,測試之間要清掉,不然前一個測試的 run 會帶到下一個。"""
    views._plan_env_cache.clear()
    views._process_cache.clear()
    views._scene_cache.clear()
    yield


TARGETS = {
    "indoor": {"cid": "c1", "ref": "amr-01", "plan_id": "p1"},
    "outdoor": {"cid": "c2", "ref": "uav-01", "plan_id": "p2"},
}


def test_link_keeps_kbps_and_omits_missing_fields():
    link = transform.link(
        {
            "sinr": 21.3,
            "rsrp": -74.8,
            "rsrq": -8.6,
            "rtt_ms": 18.4,
            "thp_dl_kbps": 268000,
            "thp_ul_kbps": 52500,
            "pci": 132,
            "cell_id": 2146306,
            "band": "n79",
            "nr_mode": "NR5G_SA",
        }
    )
    assert link["dlKbps"] == 268000
    assert link["ulKbps"] == 52500
    assert link["sinrDb"] == 21.3
    assert link["rttMs"] == 18.4
    assert link["band"] == "n79"
    # 上游沒有 SNR / RSSI / 丟包,不要無中生有
    assert "snrDb" not in link and "rssiDbm" not in link and "packetLossPct" not in link


def test_link_none_when_no_ue():
    assert transform.link(None) is None


def test_vehicle_indoor_reads_robot_and_localization():
    v = transform.vehicle(
        "indoor",
        {"yaw": math.pi / 2},
        {"speed": {"vx": 0.6, "vy": 0.0}, "power": {"batteryPercentage": 88, "isCharging": False}},
        {"quality": 74},
    )
    assert v["speedMps"] == 0.6
    assert v["batteryPct"] == 88
    assert v["localizationPct"] == 74
    # yaw = π/2(朝 +y,也就是地圖上的「上」)→ 顯示 90°,箭頭旋轉 0°
    assert v["yawDeg"] == 90.0
    assert v["headingDeg"] == 0.0


@pytest.mark.parametrize(
    ("yaw_rad", "expected_yaw", "expected_heading"),
    [
        (0.0, 0.0, 90.0),  # 朝右(+x)→ 箭頭指右
        (math.pi / 2, 90.0, 0.0),  # 朝上(+y)→ 箭頭指上
        (math.pi, -180.0, 270.0),  # 朝左(規範到 -180~180,所以是 -180)
        (-0.06, -3.4, 93.4),  # 實機常見值:略偏右下
    ],
)
def test_yaw_follows_upstream_convention(yaw_rad, expected_yaw, expected_heading):
    """SLAM yaw 是 0 = 朝右、逆時針為正;我們的箭頭 0 = 朝上、順時針。"""
    v = transform.vehicle("indoor", {"yaw": yaw_rad}, None, None)
    assert v["yawDeg"] == expected_yaw
    assert v["headingDeg"] == expected_heading


def test_vehicle_outdoor_uses_live_only():
    v = transform.vehicle("outdoor", {"heading": 315, "alt_rel": 30.2}, None, None)
    assert v == {"headingDeg": 315.0, "altitudeM": 30.2}


def test_vehicle_outdoor_reads_speeds_and_battery():
    """地速 / 垂直來自 /live 的 gspeed、vspeed;電量來自 /targets。"""
    live = {"heading": 90, "alt_rel": 30.2, "gspeed": 6.1, "vspeed": -0.2}
    targets = {"targets": [{"sysid": 1, "online": True, "battery": 78}]}
    v = transform.vehicle("outdoor", live, None, None, targets)
    assert v == {
        "headingDeg": 90.0,
        "altitudeM": 30.2,
        "speedMps": 6.1,
        "verticalSpeedMps": -0.2,
        "batteryPct": 78.0,
    }


@pytest.mark.parametrize(
    "targets",
    [
        None,
        {"targets": []},
        # 實測:離線時 /targets 沒有 battery 這欄
        {"targets": [{"sysid": 1, "online": False, "age_s": 1738.9, "reason": "心跳沒更新"}]},
    ],
)
def test_vehicle_outdoor_battery_missing_is_left_blank(targets):
    """拿不到電量就不給 —— 給 0 會讓牆上看起來「沒電了」。"""
    v = transform.vehicle("outdoor", {"alt_rel": 30.2}, None, None, targets)
    assert "batteryPct" not in v


def test_uav_sample_keeps_gps_and_drops_bogus_fixes():
    """UAV 的軌跡用 GPS;還沒定位時常見的 0,0 與超出範圍的值不能畫上去。"""
    good = transform.sample({"t": 2, "ue": {"lat": 24.7736, "lon": 121.0453, "sinr": 20}}, 10)
    assert good["lat"] == 24.7736 and good["lon"] == 121.0453
    assert "x" not in good
    for lat, lon in ((0, 0), (91, 121), (24.7, 181)):
        bad = transform.sample({"ue": {"lat": lat, "lon": lon}}, 0)
        assert "lat" not in bad or "lon" not in bad


def test_live_geo_needs_both_coordinates():
    assert transform.geo({"lat": 24.7736, "lon": 121.0453}) == {"lat": 24.7736, "lon": 121.0453}
    assert transform.geo({"lat": 24.7736}) is None
    assert transform.geo({"lat": 0, "lon": 0}) is None


def test_battery_tolerates_object_form():
    targets = {"targets": [{"battery": {"remaining": 64, "voltage": 15.2}}]}
    assert transform.vehicle("outdoor", {}, None, None, targets)["batteryPct"] == 64.0


def test_position_indoor_prefers_pose():
    pos = transform.position("indoor", {"x": 9, "y": 9}, {"pose": {"x": 1.5, "y": -2.5}})
    assert pos == {"x": 1.5, "y": -2.5}
    # UAV 是 GPS,不在這裡處理
    assert transform.position("outdoor", {"lat": 24, "lon": 121}, None) is None


def _samples(n_before: int, n_after: int):
    out = []
    for i in range(n_before):
        out.append(
            {"seq": i, "t": i * 2, "phase": "部署前", "ue": {"sinr": 10 + i, "thp_dl_kbps": 100000}}
        )
    for i in range(n_after):
        out.append(
            {
                "seq": 100 + i,
                "t": i * 2,
                "phase": "部署後",
                "ue": {"sinr": 20 + i, "thp_dl_kbps": 150000},
            }
        )
    return out


def test_build_runs_splits_phases_and_estimates_progress():
    runs = transform.build_runs({"status": "running", "phase": "部署後"}, _samples(5, 3))
    before, after = runs
    assert before["phase"] == "before" and after["phase"] == "after"
    assert before["status"] == "finished" and before["progress"] == 100
    assert before["samples"][0]["progress"] == 0
    # 跑完那趟的最後一筆當這趟的鏈路值
    assert before["link"]["sinrDb"] == 14
    # 還在跑的那趟:分母用較多筆數那趟,所以還沒到 100
    assert after["status"] == "running"
    assert after["progress"] < 100
    assert after["samples"][-1]["dlKbps"] == 150000


def test_build_runs_marks_pending_when_second_pass_has_no_data():
    runs = transform.build_runs({"status": "running", "phase": "部署前"}, _samples(3, 0))
    assert runs[0]["status"] == "running"
    assert runs[1]["status"] == "pending"
    assert runs[1]["samples"] == []
    assert runs[1]["link"] is None


def test_phase_names_fall_back_to_order():
    """上游改了階段用詞也不能整個壞掉 —— 按出現順序分配。"""
    samples = [{"phase": "第一趟", "ue": {"sinr": 1}}, {"phase": "第二趟", "ue": {"sinr": 2}}]
    runs = transform.build_runs({"status": "done", "phase": "第二趟"}, samples)
    assert [r["phase"] for r in runs] == ["before", "after"]
    assert all(r["samples"] for r in runs)


def _fake_ctrl_get(extra=None):
    payloads = {
        "/live": {
            "live": {
                "sinr": 20,
                "thp_dl_kbps": 1000,
                "thp_ul_kbps": 500,
                "yaw": 0,
                "x": 1.5,
                "y": -2.5,
            },
        },
        "/robot": {
            "speed": {"vx": 0.5, "vy": 0.0},
            "power": {"batteryPercentage": 80},
            "localization": {"quality": 66},
        },
        "/targets": {"targets": [{"sysid": 1, "online": True, "battery": 71}]},
        # 方案的環境 ID:紀錄沒有 plan_id 時靠它分辨室內 / 室外
        "/pipeline-plans/p1": {"id": "p1", "spec": {"env_id": "env-indoor"}},
        "/pipeline-plans/p2": {"id": "p2", "spec": {"env_id": "env-outdoor"}},
    }
    payloads.update(extra or {})

    def fake_get(path, params=None):
        for suffix, body in payloads.items():
            if path.endswith(suffix):
                return body
        # 流程進度的兩個來源是附帶的,測試沒特別給就當作平台上查不到
        if path.startswith(("/pipelines/", "/validation-runs/")):
            raise perf_client.PerfTesterError("Not Found", status=404)
        raise AssertionError(f"沒預期到的上游呼叫:{path}")

    return fake_get


@override_settings(FIELD_TEST_TARGETS=TARGETS)
def test_live_endpoint_is_open_to_the_wall(monkeypatch):
    monkeypatch.setattr(perf_client, "get", _fake_ctrl_get())
    res = APIClient().get("/api/field-tests/live/indoor/")
    # 中牆沒人登入,唯讀端點要開放
    assert res.status_code == 200
    body = res.json()
    assert body["link"]["sinrDb"] == 20
    assert body["link"]["dlKbps"] == 1000
    # 位置與 yaw 都取自 /live(不再多打 /pose),定位品質取自 /robot
    assert body["position"] == {"x": 1.5, "y": -2.5}
    assert body["vehicle"]["localizationPct"] == 66


@override_settings(FIELD_TEST_TARGETS=TARGETS)
def test_live_still_reports_signal_when_robot_is_slow(monkeypatch):
    """/robot 實測會慢到 5 秒 —— 它失敗時訊號與位置照樣要出來。"""

    def flaky(path, params=None):
        if path.endswith("/robot"):
            raise perf_client.PerfTesterError("timed out", status=503)
        return _fake_ctrl_get()(path, params)

    monkeypatch.setattr(perf_client, "get", flaky)
    res = APIClient().get("/api/field-tests/live/indoor/")
    assert res.status_code == 200
    body = res.json()
    assert body["link"]["sinrDb"] == 20
    assert body["position"] == {"x": 1.5, "y": -2.5}
    # 速度 / 電量 / 定位品質來自 /robot,拿不到就空著
    assert "speedMps" not in body["vehicle"]


@override_settings(FIELD_TEST_TARGETS=TARGETS)
def test_outdoor_live_adds_battery_from_targets(monkeypatch):
    live = {"live": {"sinr": 24, "heading": 315, "alt_rel": 30.2, "gspeed": 6.0, "vspeed": 0.1}}
    monkeypatch.setattr(perf_client, "get", _fake_ctrl_get({"/live": live}))
    body = APIClient().get("/api/field-tests/live/outdoor/").json()
    assert body["link"]["sinrDb"] == 24
    # 這筆 /live 沒有 GPS → geo 為空;室外的 position(公尺座標)一律是空的
    assert body["geo"] is None and body["position"] is None
    assert body["vehicle"] == {
        "headingDeg": 315.0,
        "altitudeM": 30.2,
        "speedMps": 6.0,
        "verticalSpeedMps": 0.1,
        "batteryPct": 71.0,
    }


@override_settings(FIELD_TEST_TARGETS=TARGETS)
def test_outdoor_live_still_works_when_targets_fails(monkeypatch):
    """/targets 只提供電量 —— 它掛掉時訊號與姿態照樣要出來。"""
    live = {"live": {"sinr": 24, "alt_rel": 30.2}}

    def flaky(path, params=None):
        if path.endswith("/targets"):
            raise perf_client.PerfTesterError("timed out", status=503)
        return _fake_ctrl_get({"/live": live})(path, params)

    monkeypatch.setattr(perf_client, "get", flaky)
    res = APIClient().get("/api/field-tests/live/outdoor/")
    assert res.status_code == 200
    assert res.json()["vehicle"] == {"altitudeM": 30.2}


@override_settings(FIELD_TEST_TARGETS=TARGETS)
def test_mission_endpoint_returns_two_passes(monkeypatch):
    extra = {
        "/ext/validations": {
            "validations": [{"run_id": "r1", "plan_id": "p1", "status": "running"}]
        },
        "/ext/validations/r1": {
            "status": "running",
            "phase": "部署後",
            "phases": {"部署前": 5, "部署後": 3},
        },
        "/ext/validations/r1/samples": {"next_seq": 108, "samples": _samples(5, 3)},
    }
    monkeypatch.setattr(perf_client, "get", _fake_ctrl_get(extra))
    res = APIClient().get("/api/field-tests/missions/indoor/")
    assert res.status_code == 200
    body = res.json()
    assert body["runId"] == "r1"
    assert body["nextSeq"] == 108
    assert body["currentRun"] == 1
    assert [r["phase"] for r in body["runs"]] == ["before", "after"]
    # 執行中那趟才標位置
    assert body["runs"][1]["position"] == {"x": 1.5, "y": -2.5}
    assert body["runs"][0]["position"] is None


@override_settings(FIELD_TEST_TARGETS=TARGETS)
def test_mission_skips_a_newest_run_with_no_samples(monkeypatch):
    """平台上會留下「開起來就失敗、一筆樣本都沒收到」的紀錄。

    抓到那筆整面牆會變成「—」,所以要退到最近一次真的有樣本的。
    """
    extra = {
        "/ext/validations": {
            "validations": [
                {
                    "run_id": "old",
                    "meta": {"environment_id": "env-indoor"},
                    "status": "done",
                    "created": 100,
                    "n_samples": 8,
                    "phases": {"優化前": 5, "優化後": 3},
                },
                {
                    "run_id": "empty",
                    "meta": {"environment_id": "env-indoor"},
                    "status": "error",
                    "created": 200,
                    "n_samples": 0,
                    "phases": {},
                },
            ]
        },
        "/ext/validations/old": {"status": "done", "phases": {"優化前": 5, "優化後": 3}},
        "/ext/validations/old/samples": {"next_seq": 8, "samples": _samples(5, 3)},
    }
    monkeypatch.setattr(perf_client, "get", _fake_ctrl_get(extra))
    body = APIClient().get("/api/field-tests/missions/indoor/").json()
    assert body["runId"] == "old"
    assert [len(r["samples"]) for r in body["runs"]] == [5, 3]


@override_settings(FIELD_TEST_TARGETS=TARGETS)
def test_mission_prefers_a_finished_run_that_has_both_passes(monkeypatch):
    """只跑完第一趟的紀錄對「啟用前後」這張卡沒用 —— 已結束的優先挑兩趟都有的。"""
    extra = {
        "/ext/validations": {
            "validations": [
                {
                    "run_id": "both",
                    "meta": {"environment_id": "env-indoor"},
                    "status": "done",
                    "created": 100,
                    "n_samples": 8,
                    "phases": {"優化前": 5, "優化後": 3},
                },
                {
                    "run_id": "half",
                    "meta": {"environment_id": "env-indoor"},
                    "status": "error",
                    "created": 200,
                    "n_samples": 5,
                    "phases": {"優化前": 5},
                },
                # 第二趟剛起步就斷掉(實測有 62 / 1 這種),一筆樣本畫不成對照
                {
                    "run_id": "barely",
                    "meta": {"environment_id": "env-indoor"},
                    "status": "error",
                    "created": 300,
                    "n_samples": 63,
                    "phases": {"優化前": 62, "優化後": 1},
                },
            ]
        },
        "/ext/validations/both": {"status": "done", "phases": {"優化前": 5, "優化後": 3}},
        "/ext/validations/both/samples": {"next_seq": 8, "samples": _samples(5, 3)},
    }
    monkeypatch.setattr(perf_client, "get", _fake_ctrl_get(extra))
    assert APIClient().get("/api/field-tests/missions/indoor/").json()["runId"] == "both"


@override_settings(FIELD_TEST_TARGETS=TARGETS)
def test_mission_keeps_a_running_run_even_before_its_first_sample(monkeypatch):
    """反過來:正在跑的那筆就算還沒收到樣本,也要顯示它(等一下就有了)。"""
    extra = {
        "/ext/validations": {
            "validations": [
                {
                    "run_id": "old",
                    "meta": {"environment_id": "env-indoor"},
                    "status": "done",
                    "created": 100,
                    "n_samples": 8,
                },
                {
                    "run_id": "fresh",
                    "meta": {"environment_id": "env-indoor"},
                    "status": "running",
                    "created": 200,
                    "n_samples": 0,
                },
            ]
        },
        "/ext/validations/fresh": {"status": "running", "phases": {}},
        "/ext/validations/fresh/samples": {"next_seq": 0, "samples": []},
    }
    monkeypatch.setattr(perf_client, "get", _fake_ctrl_get(extra))
    body = APIClient().get("/api/field-tests/missions/indoor/").json()
    assert body["runId"] == "fresh"


@override_settings(FIELD_TEST_TARGETS=TARGETS)
def test_outdoor_never_shows_an_indoor_run(monkeypatch):
    """紀錄沒有 plan_id,只能靠方案的 env_id 分辨。對不到就不顯示,不能拿別的情境頂替。"""
    views._plan_env_cache.clear()
    extra = {
        "/ext/validations": {
            "validations": [
                {
                    "run_id": "indoor-run",
                    "status": "done",
                    "created": 200,
                    "n_samples": 8,
                    "phases": {"優化前": 5, "優化後": 3},
                    "meta": {"environment_id": "env-indoor"},
                }
            ]
        },
    }
    monkeypatch.setattr(perf_client, "get", _fake_ctrl_get(extra))
    res = APIClient().get("/api/field-tests/missions/outdoor/")
    assert res.status_code == 404


@override_settings(FIELD_TEST_TARGETS=TARGETS)
def test_runs_are_matched_to_the_plan_by_environment(monkeypatch):
    views._plan_env_cache.clear()
    both = {"優化前": 5, "優化後": 3}
    extra = {
        "/ext/validations": {
            "validations": [
                {
                    "run_id": "in",
                    "status": "done",
                    "created": 300,
                    "n_samples": 8,
                    "phases": both,
                    "meta": {"environment_id": "env-indoor"},
                },
                {
                    "run_id": "out",
                    "status": "done",
                    "created": 100,
                    "n_samples": 8,
                    "phases": both,
                    "meta": {"environment_id": "env-outdoor"},
                },
            ]
        },
        "/ext/validations/out": {"status": "done", "phases": both},
        "/ext/validations/out/samples": {"next_seq": 8, "samples": _samples(5, 3)},
        "/live": {"live": {}},
    }
    monkeypatch.setattr(perf_client, "get", _fake_ctrl_get(extra))
    # 室內那筆比較新,但室外牆只能拿到自己的
    assert APIClient().get("/api/field-tests/missions/outdoor/").json()["runId"] == "out"


@override_settings(FIELD_TEST_TARGETS=TARGETS)
def test_open_endpoint_ignores_a_stale_token(monkeypatch):
    """牆面可能帶著過期 JWT(token 一小時就過期),唯讀端點不該因此變 401。"""
    monkeypatch.setattr(perf_client, "get", _fake_ctrl_get())
    client = APIClient()
    client.credentials(HTTP_AUTHORIZATION="Bearer not-a-real-token")
    res = client.get("/api/field-tests/live/indoor/")
    assert res.status_code == 200


@override_settings(FIELD_TEST_TARGETS={"indoor": {"cid": "", "ref": ""}, "outdoor": {}})
def test_missing_target_setting_says_so():
    res = APIClient().get("/api/field-tests/live/indoor/")
    assert res.status_code == 503
    assert "FIELD_TEST_TARGETS" in res.json()["detail"]


def test_unknown_scenario_is_404():
    res = APIClient().get("/api/field-tests/live/rooftop/")
    assert res.status_code == 404


@override_settings(FIELD_TEST_TARGETS=TARGETS)
def test_upstream_failure_is_reported_not_swallowed(monkeypatch):
    def boom(path, params=None):
        raise perf_client.PerfTesterError("連不上場域測試平台", status=503)

    monkeypatch.setattr(perf_client, "get", boom)
    res = APIClient().get("/api/field-tests/live/indoor/")
    assert res.status_code == 503
    assert res.json()["detail"] == "連不上場域測試平台"


@override_settings(FIELD_TEST_TARGETS=TARGETS)
def test_failed_controller_is_not_hammered_again(monkeypatch):
    """壞掉的載具(relay 不通,上游要 12 秒才回)不能拖慢其他畫面 ——
    失敗過就先擋住,不要每次輪詢都去等它。"""
    calls = []

    def slow_fail(method, path, **kwargs):
        calls.append(path)
        raise perf_client.PerfTesterError("timed out", status=503)

    monkeypatch.setattr(perf_client, "_request", slow_fail)
    perf_client._failed_at.clear()
    client = APIClient()
    first = client.get("/api/field-tests/live/outdoor/")
    second = client.get("/api/field-tests/live/outdoor/")
    assert first.status_code == 503 and second.status_code == 503
    # 第二次不該再敲上游
    assert len(calls) == 1
    assert "再試" in second.json()["detail"]
    perf_client._failed_at.clear()


def test_triggering_a_run_requires_login():
    res = APIClient().post("/api/field-tests/runs/", {"plan_id": "p1"}, format="json")
    assert res.status_code in (401, 403)


@pytest.mark.parametrize(
    ("raw", "expected"),
    [(268000, 268000.0), (44, 44.0), (0, 0.0), (None, None)],
)
def test_rate_kbps_keeps_raw_value(raw, expected):
    assert transform.rate_kbps(raw) == expected


GEOMETRY = {
    "bounds_m": {"xmin": -100, "xmax": 100, "ymin": -50, "ymax": 50},
    "buildings": [
        {"footprint": [[0, 0], [10, 0], [10, 10]], "height": 36.0, "material": "concrete"}
    ],
    "roads": [{"line": [[-50, 0], [50, 0]], "type": "residential"}],
    "greens": [{"footprint": [[0, 0], [5, 0], [5, 5]], "type": "park"}],
    "center_lonlat": [121.0465, 24.7736],
}


@override_settings(FIELD_TEST_TARGETS=TARGETS)
def test_scene_is_found_by_the_vehicle_connection(monkeypatch):
    """沒指定 scene_id:找綁在這台載具連線(cid)下的場景。"""
    views._scene_cache.clear()
    extra = {
        "/scenes": {
            "scenes": [
                {"id": "indoor-scene", "ctrl_conn_id": "c1"},
                {"id": "lawn", "ctrl_conn_id": "c2"},
            ]
        },
        "/scenes/lawn/geometry": GEOMETRY,
    }
    monkeypatch.setattr(perf_client, "get", _fake_ctrl_get(extra))
    body = APIClient().get("/api/field-tests/scene/outdoor/").json()
    assert body["sceneId"] == "lawn"
    # [lon, lat] → 具名欄位,前端不必記順序
    assert body["center"] == {"lon": 121.0465, "lat": 24.7736}
    assert body["buildings"] == [{"footprint": [[0, 0], [10, 0], [10, 10]], "height": 36.0}]
    assert body["roads"] == [[[-50, 0], [50, 0]]]
    assert len(body["greens"]) == 1


@override_settings(
    FIELD_TEST_TARGETS={**TARGETS, "outdoor": {**TARGETS["outdoor"], "scene_id": "pinned"}}
)
def test_scene_id_in_settings_wins(monkeypatch):
    views._scene_cache.clear()
    monkeypatch.setattr(perf_client, "get", _fake_ctrl_get({"/scenes/pinned/geometry": GEOMETRY}))
    assert APIClient().get("/api/field-tests/scene/outdoor/").json()["sceneId"] == "pinned"


@override_settings(FIELD_TEST_TARGETS=TARGETS)
def test_no_scene_for_the_vehicle_is_404(monkeypatch):
    views._scene_cache.clear()
    extra = {"/scenes": {"scenes": [{"id": "other", "ctrl_conn_id": "zzz"}]}}
    monkeypatch.setattr(perf_client, "get", _fake_ctrl_get(extra))
    assert APIClient().get("/api/field-tests/scene/outdoor/").status_code == 404


INDOOR_STEPS = [
    {"type": "phase", "name": "優化前"},
    {"type": "ue_control", "collect": False, "script": "start_point"},
    {"type": "ue_control", "script": "IM_App_Validation_Route"},
    {"type": "xapp_action", "action": "install"},
    {"type": "wait", "seconds": 20},
    {"type": "phase", "name": "優化後"},
    {"type": "ue_control", "script": "IM_App_Validation_Route"},
    {"type": "compare"},
]


@pytest.mark.parametrize(
    ("step", "label"),
    [
        ({"type": "phase", "name": "優化前"}, "階段:優化前"),
        ({"type": "ue_control", "collect": False}, "移動到起點"),
        ({"type": "ue_control", "script": "IM_App_Validation_Route"}, "沿測試路線移動"),
        ({"type": "xapp_action", "action": "install"}, "安裝 xApp"),
        ({"type": "xapp_action", "action": "uninstall"}, "解除安裝 xApp"),
        ({"type": "wait", "seconds": 20}, "等待 20 秒"),
        ({"type": "compare"}, "前後比較"),
    ],
)
def test_step_label(step, label):
    assert transform.step_label(step) == label


def test_process_finished_run_is_complete():
    results = [{"ok": True}] * len(INDOOR_STEPS)
    p = transform.process(INDOOR_STEPS, results, "done")
    assert p == {"total": 8, "done": 8, "current": None, "label": "已完成", "failed": False}


def test_process_running_step_is_the_current_one():
    """最後一筆結果還在 running:那一步就是「現在」,還不算完成。"""
    results = [{"ok": True}, {"ok": True}, {"ok": True, "done": {"state": "running"}}]
    p = transform.process(INDOOR_STEPS, results, "running")
    assert (p["done"], p["current"], p["label"]) == (2, 2, "沿測試路線移動")


def test_process_next_step_after_the_last_result():
    p = transform.process(INDOOR_STEPS, [{"ok": True}] * 3, "running")
    assert (p["done"], p["current"], p["label"]) == (3, 3, "安裝 xApp")


def test_process_pipeline_cursor_wins():
    p = transform.process(INDOOR_STEPS, [{"ok": True}], "running", cursor=4)
    assert (p["current"], p["label"]) == (4, "等待 20 秒")


def test_process_failed_step_is_reported():
    """實測會有 ok=True 但 done.state=failed 的結果 —— 也算失敗。"""
    results = [{"ok": True}, {"ok": True, "done": {"state": "failed"}}]
    p = transform.process(INDOOR_STEPS, results, "error")
    assert p["failed"] is True
    assert (p["done"], p["current"], p["label"]) == (1, 1, "移動到起點失敗")


@override_settings(FIELD_TEST_TARGETS=TARGETS)
def test_mission_reports_process_from_the_run_record(monkeypatch):
    extra = {
        "/ext/validations": {
            "validations": [{"run_id": "r1", "plan_id": "p1", "status": "running"}]
        },
        "/ext/validations/r1": {"status": "running", "phase": "優化前", "phases": {"優化前": 5}},
        "/ext/validations/r1/samples": {"next_seq": 5, "samples": _samples(5, 0)},
        "/validation-runs/r1": {"steps": INDOOR_STEPS, "results": [{"ok": True}] * 3},
    }
    monkeypatch.setattr(perf_client, "get", _fake_ctrl_get(extra))
    body = APIClient().get("/api/field-tests/missions/indoor/").json()
    assert body["process"] == {
        "total": 8,
        "done": 3,
        "current": 3,
        "label": "安裝 xApp",
        "failed": False,
    }


@override_settings(FIELD_TEST_TARGETS=TARGETS)
def test_mission_process_falls_back_to_plan_and_phase(monkeypatch):
    """兩個來源都查不到:用方案步驟 + 目前階段,至少知道走到哪個階段標記。"""
    extra = {
        "/ext/validations": {
            "validations": [{"run_id": "r1", "plan_id": "p1", "status": "running"}]
        },
        "/ext/validations/r1": {
            "status": "running",
            "phase": "優化後",
            "phases": {"優化前": 5, "優化後": 1},
        },
        "/ext/validations/r1/samples": {"next_seq": 6, "samples": _samples(5, 1)},
        "/pipeline-plans/p1": {"id": "p1", "spec": {"env_id": "env-indoor", "steps": INDOOR_STEPS}},
    }
    monkeypatch.setattr(perf_client, "get", _fake_ctrl_get(extra))
    body = APIClient().get("/api/field-tests/missions/indoor/").json()
    # 「優化後」標記是第 6 步(index 5)→ 已完成 6 步,現在在第 7 步
    assert (body["process"]["done"], body["process"]["label"]) == (6, "沿測試路線移動")
