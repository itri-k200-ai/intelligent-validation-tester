"use client";
import { useMemo } from "react";

import { FIELD_SCENARIOS } from "@/config/fieldScenarios";
import type { SceneTrack } from "@/components/FieldTest/SceneMap3D";
import { useFieldTestLive, type FieldLive } from "@/hooks/FieldTest/useFieldTestLive";
import { useFieldTestMission } from "@/hooks/FieldTest/useFieldTestMission";
import { useFieldTestReplay } from "@/hooks/FieldTest/useFieldTestReplay";
import { useFieldTestScene } from "@/hooks/FieldTest/useFieldTestScene";
import { useReplayCursor } from "@/hooks/FieldTest/useReplayCursor";
import { PHASE, currentStage, emptyMission } from "@/lib/fieldView";
import { firstGeo, makeGeoProjector, projectMission } from "@/lib/geoProjection";
import type { FieldMission, FieldVehicleStatus, FieldScenarioId, LinkQuality } from "@/types/fieldTest";

/**
 * 一般 / 手機版(FieldTestResponsive)要顯示的一切:即時或回放當下的 mission、
 * 載具數值、通訊品質、位置、進度、階段、地圖資料。
 *
 * 規則與中牆(FieldTestWall)相同 —— 只有被指定看歷史、且沒有驗測在跑時才回放;
 * 回放時把整份 mission 截到游標的時間,進度條、軌跡、圖表、數值一起倒帶。
 * 差別:中牆室內只靠影格回放,這裡沒有影格時一律退回樣本的時間軸(室外本來就是),
 * 所以室內沒存影像的那幾筆也能重播數值與軌跡。
 */
export function useFieldView(scenario: FieldScenarioId) {
  const sc = FIELD_SCENARIOS[scenario];
  const { mission } = useFieldTestMission(scenario);
  // service 的回傳型別沒列 geo(後端有給,室外才有)—— 照中牆的寫法以 FieldLive 看待
  const live = useFieldTestLive(scenario).live as FieldLive | null;
  const { replay } = useFieldTestReplay(scenario);
  const { scene } = useFieldTestScene(scenario);

  // 骨架固定同一個物件(理由同中牆:不然 3D 地圖每次 render 都重畫)
  const empty = useMemo(() => emptyMission(sc, scenario), [sc, scenario]);
  const base: FieldMission = mission ?? empty;

  const running = base.runs.some((r) => r.status === "running");
  const replaying = !!base.pinned && !running;
  // 回放索引 30 秒才重抓一次,切換歷史的頭幾十秒還是上一筆 —— 比對 runId 擋掉
  const freshReplay = !!replay && !!base.runId && replay.runId === base.runId;
  const replayCam = replaying && freshReplay ? (replay?.cameras?.[0] ?? null) : null;

  const cursor = useReplayCursor(
    replayCam?.frames ?? null,
    replay?.periodS ?? null,
    base.runs,
    replaying && !replayCam,
  );
  const rs = replaying ? cursor.sample : null;

  // 只放這一筆真的有值的欄位:spread 一個 undefined 會把原本的值蓋掉
  const replayVehicle = useMemo(() => {
    if (!rs) return null;
    const v: FieldVehicleStatus = {};
    if (rs.yawDeg != null) v.yawDeg = rs.yawDeg;
    if (rs.headingDeg != null) v.headingDeg = rs.headingDeg;
    if (rs.speedMps != null) v.speedMps = rs.speedMps;
    if (rs.verticalSpeedMps != null) v.verticalSpeedMps = rs.verticalSpeedMps;
    if (rs.altitudeM != null) v.altitudeM = rs.altitudeM;
    if (rs.batteryPct != null) v.batteryPct = rs.batteryPct;
    if (rs.satellites != null) v.satellites = rs.satellites;
    if (rs.localizationPct != null) v.localizationPct = rs.localizationPct;
    return v;
  }, [rs]);

  const total = sc.route.length;
  const play: FieldMission = useMemo(() => {
    const cut = rs?.wall;
    if (cut == null) return base;
    return {
      ...base,
      vehicle: { ...base.vehicle, ...(replayVehicle ?? {}) },
      runs: base.runs.map((r) => {
        const kept = (r.samples ?? []).filter((x) => (x.wall ?? 0) <= cut);
        const last = kept.at(-1);
        const progress = last?.progress ?? 0;
        return {
          ...r,
          samples: kept,
          progress,
          reachedWaypoints: Math.round((progress / 100) * total),
          position: last && last.x != null && last.y != null ? { x: last.x, y: last.y } : null,
          status: kept.length === 0 ? ("pending" as const) : r.status,
        };
      }),
    };
  }, [base, rs?.wall, replayVehicle, total]);

  // 回放進度:游標的絕對時間落在所有樣本首尾之間的位置
  const replayPercent = useMemo(() => {
    const cut = rs?.wall;
    if (cut == null) return null;
    const walls = base.runs
      .flatMap((r) => (r.samples ?? []).map((x) => x.wall))
      .filter((w): w is number => w != null);
    if (walls.length < 2) return null;
    const a = Math.min(...walls);
    const b = Math.max(...walls);
    if (b <= a) return null;
    return Math.round(Math.min(1, Math.max(0, (cut - a) / (b - a))) * 100);
  }, [base, rs?.wall]);

  const p = base.process;
  const percent =
    replayPercent ?? (p && p.total ? Math.round((p.done / p.total) * 100) : null);

  const run = base.runs[base.currentRun];
  const baseLink: LinkQuality | null = live?.link ?? run?.link ?? null;
  const link: LinkQuality | null =
    rs && baseLink
      ? {
          ...baseLink,
          sinrDb: rs.sinrDb ?? null,
          rsrpDbm: rs.rsrpDbm ?? null,
          rsrqDb: rs.rsrqDb ?? null,
          dlKbps: rs.dlKbps ?? null,
          ulKbps: rs.ulKbps ?? null,
          rttMs: rs.rttMs ?? null,
        }
      : baseLink;

  // ── 位置:室內是 SLAM x / y;室外是 GPS,要換成場景的公尺座標 ──
  const origin = scenario === "outdoor" ? (scene?.center ?? firstGeo(base) ?? live?.geo ?? null) : null;
  const project = useMemo(() => (origin ? makeGeoProjector(origin) : null), [origin?.lat, origin?.lon]); // eslint-disable-line react-hooks/exhaustive-deps
  const mapMission = project ? projectMission(play, project) : play;
  const replayGeo = rs && rs.lat != null && rs.lon != null ? { lat: rs.lat, lon: rs.lon } : null;
  const geo = replayGeo ?? live?.geo ?? null;
  const replayXY = rs && rs.x != null && rs.y != null ? { x: rs.x, y: rs.y } : null;
  const position =
    scenario === "outdoor"
      ? project && geo
        ? project(geo)
        : null
      : (replayXY ?? live?.position ?? run?.position ?? null);

  // 3D 軌跡只在筆數或原點變了才重算(理由見中牆:每秒重建會吃掉整顆 CPU)
  const sceneTracks: SceneTrack[] = useMemo(
    () =>
      mapMission.runs.map((r) => ({
        key: r.phase,
        color: PHASE[r.phase].color,
        points: r.samples.flatMap((s) =>
          typeof s.x === "number" && typeof s.y === "number" ? [{ x: s.x, y: s.y }] : [],
        ),
      })),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [mapMission.runs.map((r) => r.samples.length).join("/"), origin?.lat, origin?.lon],
  );
  const uavAlt = live?.vehicle.altitudeM ?? null;
  const sceneUav = useMemo(
    () => (scenario === "outdoor" && position ? { x: position.x, y: position.y, altM: uavAlt } : null),
    [scenario, position?.x, position?.y, uavAlt], // eslint-disable-line react-hooks/exhaustive-deps
  );

  return {
    sc,
    mission: base,
    play,
    mapMission,
    running,
    replaying,
    replayCam,
    replayAt: cursor.at,
    percent,
    stage: currentStage(p, replayPercent),
    vehicle: { ...base.vehicle, ...live?.vehicle, ...(replayVehicle ?? {}) } as FieldVehicleStatus,
    link,
    position,
    geo,
    realFrame: !!project,
    scene,
    sceneTracks,
    sceneUav,
    hasData: !!mission,
  };
}
