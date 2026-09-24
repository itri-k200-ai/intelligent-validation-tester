"""場域測試(智慧網路中牆)代理層的行為。

外部 Performance_tester 不在測試環境裡,所以把 client.get 換掉 —— 這裡要驗的是
「我們有沒有正確轉換與正確處理失敗」,不是對方活著沒。
"""

import math

import pytest
from django.test import override_settings
from rest_framework.test import APIClient

from apps.field_tests import client as perf_client
from apps.field_tests import history, transform, views


@pytest.fixture(autouse=True)
def _clear_caches():
    """views 的快取是模組層級的,測試之間要清掉,不然前一個測試的 run 會帶到下一個。"""
    views._plan_env_cache.clear()
    views._process_cache.clear()
    views._scene_cache.clear()
    yield


class _FakeRedis:
    """history.py 只用到 hash 與一個集合,測試環境沒有 Redis,拿 dict / set 頂替。"""

    def __init__(self):
        self.data: dict[str, str] = {}
        self.seen: dict[str, str] | None = None

    def hget(self, _key, field):
        return self.data.get(field)

    def hgetall(self, key):
        return dict(self.seen or {}) if key.endswith("seen") else dict(self.data)

    def hset(self, key, field=None, value=None, mapping=None):
        target = "seen" if key.endswith("seen") else "data"
        if target == "seen" and self.seen is None:
            self.seen = {}
        store = self.seen if target == "seen" else self.data
        if mapping:
            store.update(mapping)
        else:
            store[field] = value

    def hdel(self, _key, field):
        self.data.pop(field, None)

    def delete(self, _key):
        self.data.clear()

    # 已處理過的 adapter 通知(runId → notified_at)
    def exists(self, _key):
        return self.seen is not None


@pytest.fixture(autouse=True)
def fake_redis(monkeypatch):
    fake = _FakeRedis()
    monkeypatch.setattr(history, "_redis", lambda: fake)
    return fake


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


# ── 平台指定要顯示的歷史驗測(notifyHisShow → /api/field-tests/history/)──────

def _history_runs():
    """室內(env-indoor)兩筆、室外(env-outdoor)一筆,都已結束。紀錄沒有 plan_id,
    跟平台實測一樣要靠 meta.environment_id 分情境。"""
    return {
        "/ext/validations": {
            "validations": [
                {"run_id": "old", "meta": {"environment_id": "env-indoor"},
                 "status": "done", "created": 100, "phases": {"優化前": 9, "優化後": 9}},
                {"run_id": "new", "meta": {"environment_id": "env-indoor"},
                 "status": "done", "created": 300, "phases": {"優化前": 9, "優化後": 9}},
                {"run_id": "out1", "meta": {"environment_id": "env-outdoor"},
                 "status": "done", "created": 200, "phases": {"部署前": 9, "部署後": 9}},
            ]
        },
        "/ext/validations/old": {"status": "done", "phases": {"優化前": 9, "優化後": 9}},
        "/ext/validations/old/samples": {"next_seq": 20, "samples": _samples(9, 9)},
        "/ext/validations/new": {"status": "done", "phases": {"優化前": 9, "優化後": 9}},
        "/ext/validations/new/samples": {"next_seq": 20, "samples": _samples(9, 9)},
        "/ext/validations/out1": {"status": "done", "phases": {"部署前": 9, "部署後": 9}},
        "/ext/validations/out1/samples": {"next_seq": 20, "samples": _samples(9, 9)},
    }


@override_settings(FIELD_TEST_TARGETS=TARGETS)
def test_history_notice_pins_each_scenario_and_the_wall_follows(monkeypatch):
    """一次通知帶室內 + 室外兩筆:各自指定給自己那面牆,牆面就顯示那一次。"""
    monkeypatch.setattr(perf_client, "get", _fake_ctrl_get(_history_runs()))
    res = APIClient().post("/api/field-tests/history/", ["old", "out1"], format="json")
    assert res.status_code == 200
    assert res.json()["pinned"] == {"indoor": "old", "outdoor": "out1"}

    # 室內沒有指定的話會挑最新的 new,現在要顯示被指定的 old
    assert APIClient().get("/api/field-tests/missions/indoor/").json()["runId"] == "old"
    assert APIClient().get("/api/field-tests/missions/outdoor/").json()["runId"] == "out1"


@override_settings(FIELD_TEST_TARGETS=TARGETS)
def test_history_notice_takes_the_newest_when_one_scenario_gets_several(monkeypatch):
    monkeypatch.setattr(perf_client, "get", _fake_ctrl_get(_history_runs()))
    res = APIClient().post("/api/field-tests/history/", ["old", "new"], format="json")
    assert res.json()["pinned"] == {"indoor": "new"}


@override_settings(FIELD_TEST_TARGETS=TARGETS)
def test_history_notice_reports_ids_it_cannot_place(monkeypatch):
    monkeypatch.setattr(perf_client, "get", _fake_ctrl_get(_history_runs()))
    res = APIClient().post("/api/field-tests/history/", ["nope"], format="json")
    assert res.status_code == 404
    assert res.json()["unknown"] == ["nope"]


@override_settings(FIELD_TEST_TARGETS=TARGETS)
def test_a_new_run_takes_the_wall_back_to_live(monkeypatch):
    """指定了歷史紀錄之後,平台又開跑新的驗測 —— 牆要回到即時那一筆,指定也清掉。"""
    extra = _history_runs()
    monkeypatch.setattr(perf_client, "get", _fake_ctrl_get(extra))
    APIClient().post("/api/field-tests/history/", ["old"], format="json")
    assert APIClient().get("/api/field-tests/missions/indoor/").json()["runId"] == "old"

    running = dict(extra)
    running["/ext/validations"] = {
        "validations": [
            {"run_id": "live1", "meta": {"environment_id": "env-indoor"},
             "status": "running", "created": 400},
            *extra["/ext/validations"]["validations"],
        ]
    }
    running["/ext/validations/live1"] = {"status": "running", "phase": "優化前", "phases": {"優化前": 2}}
    running["/ext/validations/live1/samples"] = {"next_seq": 3, "samples": _samples(2, 0)}
    monkeypatch.setattr(perf_client, "get", _fake_ctrl_get(running))
    assert APIClient().get("/api/field-tests/missions/indoor/").json()["runId"] == "live1"
    # 指定已經清掉 —— 那一輪跑完之後牆要跟著新的走,不要再跳回歷史
    assert APIClient().get("/api/field-tests/history/").json()["pinned"] == {}


@override_settings(FIELD_TEST_TARGETS=TARGETS)
def test_history_pin_is_dropped_when_the_run_disappears(monkeypatch):
    monkeypatch.setattr(perf_client, "get", _fake_ctrl_get(_history_runs()))
    APIClient().post("/api/field-tests/history/", ["old"], format="json")

    gone = dict(_history_runs())
    gone["/ext/validations"] = {
        "validations": [r for r in _history_runs()["/ext/validations"]["validations"]
                        if r["run_id"] != "old"]
    }
    gone["/ext/validations/new"] = {"status": "done", "phases": {"優化前": 9, "優化後": 9}}
    gone["/ext/validations/new/samples"] = {"next_seq": 20, "samples": _samples(9, 9)}
    monkeypatch.setattr(perf_client, "get", _fake_ctrl_get(gone))
    assert APIClient().get("/api/field-tests/missions/indoor/").json()["runId"] == "new"


@override_settings(FIELD_TEST_TARGETS=TARGETS, FIELD_TEST_NOTIFY_TOKEN="s3cret")
def test_history_notice_can_require_a_token(monkeypatch):
    monkeypatch.setattr(perf_client, "get", _fake_ctrl_get(_history_runs()))
    assert APIClient().post("/api/field-tests/history/", ["old"], format="json").status_code == 403
    res = APIClient().post(
        "/api/field-tests/history/", ["old"], format="json", HTTP_X_NOTIFY_TOKEN="s3cret"
    )
    assert res.status_code == 200


@override_settings(FIELD_TEST_TARGETS=TARGETS)
def test_history_pin_can_be_cleared(monkeypatch):
    monkeypatch.setattr(perf_client, "get", _fake_ctrl_get(_history_runs()))
    APIClient().post("/api/field-tests/history/", ["old", "out1"], format="json")
    res = APIClient().delete("/api/field-tests/history/?scenario=indoor")
    assert res.json()["pinned"] == {"outdoor": "out1"}
    assert APIClient().delete("/api/field-tests/history/").json()["pinned"] == {}


@override_settings(FIELD_TEST_TARGETS=TARGETS)
def test_records_list_is_filtered_by_scenario_and_marks_the_pinned_one(monkeypatch):
    monkeypatch.setattr(perf_client, "get", _fake_ctrl_get(_history_runs()))
    APIClient().post("/api/field-tests/history/", ["old"], format="json")
    body = APIClient().get("/api/field-tests/records/?scenario=indoor").json()
    # 只留室內的,新的在前面
    assert [r["runId"] for r in body["runs"]] == ["new", "old"]
    assert [r["pinned"] for r in body["runs"]] == [False, True]
    assert body["runs"][0]["bothPasses"] is True
    assert body["pinned"] == {"indoor": "old"}
    # 不給情境就全部(含室外那筆)
    assert len(APIClient().get("/api/field-tests/records/").json()["runs"]) == 3


# ── 由我們去問 adapter:誰被通知要顯示歷史 ─────────────────────────────

class _FakeAdapter:
    """GET {base}/autoTest/history/notified 的假回應。

    notified 是 {runId: notified_at} —— 重複通知同一筆時 adapter 會更新 notified_at,
    我們就是靠這個分辨「又通知了一次」。
    """

    def __init__(self, notified: dict[str, str] | None = None):
        self.notified = notified or {}
        self.calls = 0

    def __call__(self, url, timeout=None):
        self.calls += 1
        return _FakeResponse(
            {"notified": [{"id": k, "notified_at": v, "count": 1} for k, v in self.notified.items()]}
        )


class _FakeResponse:
    def __init__(self, payload):
        self._payload = payload

    def raise_for_status(self):
        return None

    def json(self):
        return self._payload


@pytest.fixture(autouse=True)
def _clear_adapter_cache():
    views._adapter_poll.clear()
    yield


@pytest.fixture
def adapter(monkeypatch):
    """每個測試自己決定 adapter 上誰被標成 notified;順便關掉輪詢的 5 秒節流。"""
    fake = _FakeAdapter()
    monkeypatch.setattr(views.httpx, "get", fake)
    monkeypatch.setattr(views, "_adapter_poll", {})
    return fake


@override_settings(FIELD_TEST_TARGETS=TARGETS, FIELD_TEST_ADAPTER_BASE="http://adapter")
def test_wall_follows_a_notice_it_finds_on_the_adapter(monkeypatch, adapter):
    """adapter 只把紀錄標成 notified、不會通知我們,所以牆面輪詢時順便去問。"""
    monkeypatch.setattr(perf_client, "get", _fake_ctrl_get(_history_runs()))
    # 第一次:先把現況記起來(後端重開不該讓牆跳到很久以前的通知)
    adapter.notified = {"old": "100"}
    assert APIClient().get("/api/field-tests/missions/indoor/").json()["runId"] == "new"

    # 之後才出現的通知才算數
    adapter.notified = {"old": "100", "out1": "200"}
    views._adapter_poll.clear()
    assert APIClient().get("/api/field-tests/missions/outdoor/").json()["runId"] == "out1"
    # 同一筆不會一直重新指定:清掉之後不該又自己跳回去
    APIClient().delete("/api/field-tests/history/?scenario=outdoor")
    views._adapter_poll.clear()
    assert APIClient().get("/api/field-tests/missions/outdoor/").json()["runId"] == "out1"  # 最新一筆剛好也是它


@override_settings(FIELD_TEST_TARGETS=TARGETS, FIELD_TEST_ADAPTER_BASE="http://adapter")
def test_adapter_is_asked_at_most_once_every_few_seconds(monkeypatch, adapter):
    """兩面牆各自 1~15 秒輪詢,不能每次都去敲 adapter。"""
    monkeypatch.setattr(perf_client, "get", _fake_ctrl_get(_history_runs()))
    for _ in range(4):
        APIClient().get("/api/field-tests/missions/indoor/")
    assert adapter.calls == 1


@override_settings(FIELD_TEST_TARGETS=TARGETS, FIELD_TEST_ADAPTER_BASE="http://adapter")
def test_adapter_being_down_does_not_break_the_wall(monkeypatch, adapter):
    import httpx

    def boom(url, timeout=None):
        raise httpx.ConnectError("no route")

    monkeypatch.setattr(views.httpx, "get", boom)
    monkeypatch.setattr(perf_client, "get", _fake_ctrl_get(_history_runs()))
    assert APIClient().get("/api/field-tests/missions/indoor/").status_code == 200


@override_settings(FIELD_TEST_TARGETS=TARGETS, FIELD_TEST_ADAPTER_BASE="http://adapter")
def test_the_same_record_notified_again_is_shown_again(monkeypatch, adapter):
    """adapter 重複通知同一筆時會更新 notified_at —— 時間變了就要再切一次。"""
    monkeypatch.setattr(perf_client, "get", _fake_ctrl_get(_history_runs()))
    APIClient().get("/api/field-tests/missions/indoor/")          # 先建立基準(還沒有通知)
    adapter.notified = {"old": "100"}
    views._adapter_poll.clear()
    assert APIClient().get("/api/field-tests/missions/indoor/").json()["runId"] == "old"

    APIClient().delete("/api/field-tests/history/?scenario=indoor")
    views._adapter_poll.clear()
    assert APIClient().get("/api/field-tests/missions/indoor/").json()["runId"] == "new"

    adapter.notified = {"old": "300"}                             # 平台又通知同一筆
    views._adapter_poll.clear()
    assert APIClient().get("/api/field-tests/missions/indoor/").json()["runId"] == "old"
