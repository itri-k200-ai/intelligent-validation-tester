import { FIELD_SCENARIOS } from "@/config/fieldScenarios";
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
