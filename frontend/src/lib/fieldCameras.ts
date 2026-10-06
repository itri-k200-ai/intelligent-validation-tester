import { FIELD_SCENARIOS } from "@/config/fieldScenarios";
import type { ReplayCamera } from "@/hooks/FieldTest/useFieldTestReplay";
import type { FieldScenarioId } from "@/types/fieldTest";

const USE_MOCK = process.env.NEXT_PUBLIC_USE_MOCK === "true";

/**
 * 固定攝影機在平台 `/cameras` 裡登記的名稱,順序對應 FIELD_SCENARIOS[].cameras。
 *
 * 最後一格是載具車載,不在這裡 —— 它要先查上游有沒有在推流、名額有沒有滿
 * (見 useFieldTestCamera),所以用 null 佔位。
 *
 * 名稱對不上時改這裡即可,不必動元件 —— 平台回 404 時那一格會退回佔位畫面
 * (見 LiveVideo 的 MjpegVideo),不會變成破圖,也不影響其他格。
 */
const FIXED_CAMERAS: Record<FieldScenarioId, (string | null)[]> = {
  indoor: ["camera1", "camera2", "camera3", null],
  // 室外固定攝影機(52 館屋頂)不經平台,直接由我們的 mediamtx 向場域端拉 HLS
  // (見 media-server/mediamtx.yml 的 field-b52-roof)。以 hls: 開頭表示這一種。
  outdoor: ["hls:field-b52-roof", null],
};

/** hls:<mediamtx 路徑> → 經 nginx /hls/ 的播放清單 */
function hlsUrl(name: string) {
  return name.startsWith("hls:") ? `/hls/${encodeURIComponent(name.slice(4))}/index.m3u8` : null;
}

/**
 * 每一格影像的來源位址。
 *
 * 都走我們後端代理 —— 金鑰與場域網段只在後端,牆面的瀏覽器不直接打平台。
 * 固定攝影機用 MJPEG 的 /stream,<img> 直接吃得動(與車載同一種播法)。
 * 平台建議外部改用 /snapshot 輪詢,relay 扛不住時再換(後端兩支都備好了)。
 *
 * 這份和 mission 分開:上游驗測資料拿不到時(或還沒開始測),影像照樣要能播。
 * mock 模式沒有後端可打,一律 null(顯示佔位畫面)。
 */
export function cameraSources(scenario: FieldScenarioId): (string | null)[] {
  if (USE_MOCK) return FIELD_SCENARIOS[scenario].cameras.map(() => null);
  return FIXED_CAMERAS[scenario].map((name) =>
    name ? (hlsUrl(name) ?? `/api/field-tests/camera/by-name/${encodeURIComponent(name)}/stream`) : null,
  );
}

/**
 * 一般 / 手機版用的「單張快照」位址,順序同 cameraSources,最後一格是載具車載。
 *
 * 不用 MJPEG 串流的原因:
 *  - 上游 relay 同時只允許 3 路串流,牆面自己就要用掉。每多一個人用手機或筆電看,
 *    就會從牆上搶走一路,牆上那格變成轉圈。快照是一次性的短請求,不佔名額。
 *  - 瀏覽器對同一個來源只開 6 條連線,永不結束的串流會把輪詢擠到排隊
 *    (中牆實際踩過:切換歷史卡住,要重整才好)。
 * 代價是畫面約 2 秒更新一次,看狀況足夠。
 */
export function snapshotSources(scenario: FieldScenarioId): (string | null)[] {
  if (USE_MOCK) return FIELD_SCENARIOS[scenario].cameras.map(() => null);
  return FIXED_CAMERAS[scenario].map((name) =>
    name
      ? // HLS 那幾支直接播影片:mediamtx 一路拉進來可以發給任何人看,沒有平台 relay 的名額問題
        (hlsUrl(name) ?? `/api/field-tests/camera/by-name/${encodeURIComponent(name)}/snapshot/`)
      : `/api/field-tests/camera/${scenario}/snapshot/`,
  );
}

/**
 * 歷史回放:每一格對應平台回放索引裡的哪一支鏡頭(順序同 FIELD_SCENARIOS[].cameras)。
 * 固定攝影機用平台登記的名稱對;最後一格是載具,平台的 key 固定叫 onboard。
 *
 * 室外固定那格:即時改看我們 mediamtx 的 52 館屋頂,但回放只有平台錄的 ocamera1
 * (平台登記的室外固定攝影機)可用 —— 目前它一張都沒存,那格回放時會轉圈。
 */
const REPLAY_NAMES: Record<FieldScenarioId, string[]> = {
  indoor: ["camera1", "camera2", "camera3", "onboard"],
  outdoor: ["ocamera1", "onboard"],
};

export function replayCameraFor(
  scenario: FieldScenarioId,
  index: number,
  cameras: ReplayCamera[],
): ReplayCamera | null {
  const want = REPLAY_NAMES[scenario][index];
  if (!want) return null;
  return cameras.find((c) => c.key === want || c.name === want) ?? null;
}

/**
 * 回放的時鐘要跟哪一支鏡頭走:有車載就用車載(它從頭錄到尾),否則用張數最多的。
 * 都沒有就回 null,由樣本的時間軸來播(見 useReplayCursor 的 fromSamples)。
 */
export function replayMaster(cameras: ReplayCamera[]): ReplayCamera | null {
  return (
    cameras.find((c) => c.key === "onboard") ??
    [...cameras].sort((a, b) => b.frames.length - a.frames.length)[0] ??
    null
  );
}

/**
 * 離「上一張」多久還算同一段錄影:這支鏡頭平常間隔的 1.5 倍。
 * 實測平台每 8.2 秒存一張(各鏡頭同一個時刻),兩趟之間的 app 部署會空 31 秒 ——
 * 間隔內維持上一張,超過就當作這段沒錄到(轉圈),不要把很久以前那張當成現在。
 */
function frameGapS(camera: ReplayCamera) {
  const w = camera.frames.map((f) => f.wall).filter((x): x is number => x != null);
  const d = w.slice(1).map((x, i) => x - w[i]).sort((a, b) => a - b);
  const typical = d.length ? d[Math.floor(d.length / 2)] : 0;
  return Math.max(3, typical * 1.5);
}

/**
 * 這支鏡頭在 wall 這個時刻該顯示第幾張:取時間上最接近的一張。
 * 各鏡頭錄的時段不同(實測:車載與 camera3 兩趟都有 26 張,camera1 / camera2 只有
 * 優化後的 11 張),所以不能共用同一個序號。
 *
 * 用「最接近」而不是「wall 之前最近的一張」:同一個時刻存的各鏡頭時間戳會差幾十毫秒,
 * 只取之前的會一直慢一張(實測車載第 16 張時 camera1 停在第 1 張)。
 * 離最接近的一張還超過 frameGapS 就回 null —— 這支鏡頭這段沒錄到(轉圈)。
 */
export function frameAt(camera: ReplayCamera, wall: number | null): number | null {
  if (wall == null) return null;
  let best: number | null = null;
  let bestGap = Infinity;
  camera.frames.forEach((f, i) => {
    if (f.wall == null) return;
    const gap = Math.abs(f.wall - wall);
    if (gap < bestGap) {
      best = i;
      bestGap = gap;
    }
  });
  return best === null || bestGap > frameGapS(camera) ? null : best;
}
