import { FIELD_SCENARIOS } from "@/config/fieldScenarios";
import type { FieldScenarioId } from "@/types/fieldTest";

/**
 * 每一格影像的來源位址。
 *
 * 車載影像是外部平台的 MJPEG,走我們後端代理(金鑰與場域網段只在後端);
 * 固定攝影機走 IVT 通用層的 HLS,要等攝影機建進資料庫才有位址,先留 null。
 *
 * 這份和 mission 分開:上游驗測資料拿不到時(或還沒開始測),影像照樣要能播。
 * mock 模式沒有後端可打,一律 null(顯示佔位畫面)。
 */
export function cameraSources(scenario: FieldScenarioId): (string | null)[] {
  // 固定攝影機:等 IVT 建好 Camera(有 RTSP)才會有 HLS 位址。
  // 車載影像不在這裡給 —— 要先查上游有沒有在推流、名額有沒有滿,見 useFieldTestCamera。
  return FIELD_SCENARIOS[scenario].cameras.map(() => null);
}
