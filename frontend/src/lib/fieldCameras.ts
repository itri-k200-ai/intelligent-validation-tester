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
 * (見 LiveVideo 的 MjpegVideo,之後會自己重連),不會變成破圖,也不影響其他格。
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
/** 回放某一格的圖片網址(ReplayPlayer 與預載共用同一個,瀏覽器快取才對得上) */
export function replayFrameUrl(scenario: FieldScenarioId, camera: ReplayCamera, index: number): string {
  const q = camera.runId ? `?run_id=${encodeURIComponent(camera.runId)}` : "";
  return `/api/field-tests/replay/${scenario}/${camera.key}/${index}.jpg${q}`;
}

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
 * 錄影中間的空檔(平台偶爾漏存,實測無人機機載有 9~24 秒沒有影格)停在空檔前最後一張,
 * 不要整格變轉圈 —— 以前會「突然不見」,而且整個回放元件被拆掉,影格回來時要從頭重新載入。
 * 只有在這支鏡頭錄影的時段之外(比第一張早、比最後一張晚超過 frameGapS)才回 null(轉圈)。
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
  if (best === null) return null;
  if (bestGap <= frameGapS(camera)) return best;
  // 離最近的一張太遠:在錄影時段之內(空檔)就停在空檔前那張,時段外才算沒錄到
  const walls = camera.frames.map((f) => f.wall).filter((x): x is number => x != null);
  const inside = wall >= Math.min(...walls) && wall <= Math.max(...walls);
  if (!inside) return null;
  let before: number | null = null;
  camera.frames.forEach((f, i) => {
    if (f.wall != null && f.wall <= wall && (before === null || f.wall > camera.frames[before].wall!)) before = i;
  });
  return before ?? best;
}

/**
 * 回放時「這支鏡頭沒存影格」要不要改播即時畫面。
 *
 * 一般是不要(轉圈 + 標「回放」):回放配上現在的畫面,看的人會以為驗測正在進行。
 * 例外是室外固定攝影機(52 館屋頂):它本來就沒有回放功能(平台不存它的影格),
 * 一律顯示即時畫面、標「LIVE」(依現場回饋)。之後平台若開始替它存影格,有影格時仍優先播回放。
 */
const LIVE_IN_REPLAY: Record<FieldScenarioId, boolean[]> = {
  indoor: [false, false, false, false],
  outdoor: [true, false],
};

export function liveInReplay(scenario: FieldScenarioId, index: number): boolean {
  return LIVE_IN_REPLAY[scenario][index] ?? false;
}

/**
 * 場域攝影機的「直連」來源:瀏覽器先自己向場域端的 mediamtx 拉,拉不到才走我們的轉送
 * (/hls/<路徑>/,見 media-server/mediamtx.yml)。依現場要求:能直連的(電視牆、場域網段的電腦)
 * 就不經過我們的伺服器;連不到 192.168.145.61 的(院外、手機)自動退回轉送,照樣看得到。
 * 場域端的 mediamtx 允許跨網域(Access-Control-Allow-Origin: *),瀏覽器可以直接拉。
 */
const DIRECT_HLS: Record<string, string> = {
  // 720p 那一路(B52_Roof_mid,依現場要求;B52_Roof 是 4K),與 mediamtx.yml 的 field-b52-roof 同一個來源
  "/hls/field-b52-roof/index.m3u8": "http://192.168.145.61:8888/B52_Roof_mid/index.m3u8",
};

/**
 * 這支轉送網址對應的直連網址;沒有對應、或頁面是 HTTPS 時回 null
 * (HTTPS 頁面裡不能載 HTTP 的影像,瀏覽器會擋,直接走轉送)。
 */
export function directHlsFor(relaySrc: string): string | null {
  const direct = DIRECT_HLS[relaySrc];
  if (!direct) return null;
  if (typeof window !== "undefined" && window.location.protocol === "https:") return null;
  return direct;
}

/**
 * MJPEG 串流改走「攝影機專用埠」(38081,見 deploy/nginx.conf.template 的 8081 段)。
 *
 * MJPEG 是永不結束的連線,瀏覽器對同一個主機 + 埠只開 6 條、整個瀏覽器(含 iframe)共用;
 * 串流與資料輪詢擠在 38080 上,外層頁面同時嵌了中牆與右牆時輪詢就排不到連線,中牆會卡。
 * 串流換到另一個埠就是另一組 6 條。
 *
 * 只在 http://…:38080 的頁面上換(HTTPS 走 HTTP/2 沒有這個限制,而且 HTTPS 頁面不能載 HTTP 串流)。
 * 防火牆不一定有開這個埠,所以開頁時先打一次 _ping:連得到才換,連不到就照舊用 38080。
 */
// 頁面所在的埠 → 串流改走的埠。之前試開時剛好碰上室內影像出不來,事後查明是平台那支鏡頭
// 3 人名額滿了、camera1 / camera3 本身連不到,跟換埠無關,所以重新打開。
const CAMERA_PORT: Record<string, string> = { "38080": "38081" };

/**
 * 試行中(依現場要求,看效果再決定留不留):http://…:38080 的頁面優先從 HTTPS 38443 拉串流。
 *
 * 38443 走 HTTP/2,所有串流共用一條連線多工,沒有「每個主機 + 埠 6 條」的上限 ——
 * 同一台電腦同時開 /field(室內 4 路)和牆面時,38081 的 6 條會被佔滿,
 * 排在後面的 camera3、AMR 就一直出不來(實測:那台電腦在 38081 上剛好 6 條連線)。
 *
 * 連不到就自動退回 38081 → 38080,影像照樣出得來:
 *  - 自簽憑證:那台瀏覽器要先開過一次 https://<主機>:38443 並按「繼續前往」,不然 _ping 會失敗
 *  - 院外的防火牆擋 38443
 * 要換回只用 38081:把這個改成 {} 即可。
 */
const CAMERA_HTTPS_PORT: Record<string, string> = { "38080": "38443" };
/** 這個 origin 連不連得到(3 秒內有回就算) */
function reachable(origin: string): Promise<boolean> {
  const ctrl = new AbortController();
  const timer = window.setTimeout(() => ctrl.abort(), 3000);
  return fetch(`${origin}/api/field-tests/camera/_ping`, { mode: "no-cors", cache: "no-store", signal: ctrl.signal })
    .then(() => true)
    .catch(() => false)
    .finally(() => window.clearTimeout(timer));
}

/**
 * 開串流前最多等探測這麼久。院內兩個埠幾十毫秒就回;院外的防火牆是把封包直接丟掉,
 * 探測要等滿 3 秒逾時才知道不通 —— 以前就是這樣讓影像固定晚 3 秒才出來
 * (實測院外 140.96.158.x:38443 / 38081 的 _ping 一個都沒到 nginx)。
 * 等不到就先用同源開,探測照樣在背景跑,之後發現有更好的埠再換過去(見 onCameraOriginChange)。
 */
const PROBE_WAIT_MS = 300;
/** 上次探到的結果記在這台瀏覽器:下次開頁直接用,不必再等(背景照樣重探,換了網路會自己改) */
const ORIGIN_KEY = "ivt.field.cameraOrigin";

let originReady: Promise<string> | null = null;
let currentOrigin = "";
const originListeners = new Set<(origin: string) => void>();

function setOrigin(origin: string) {
  if (origin === currentOrigin) return;
  currentOrigin = origin;
  originListeners.forEach((fn) => fn(origin));
}

/** 串流位址換了(探到更好的埠、或記住的那個已經不通)時通知;回傳取消訂閱 */
export function onCameraOriginChange(fn: (origin: string) => void): () => void {
  originListeners.add(fn);
  return () => originListeners.delete(fn);
}

/**
 * 串流要接在哪個 origin 前面("" = 照舊同源)。整頁只探一次,候選同時探。
 * 最多等 PROBE_WAIT_MS 就交出當下最好的答案,之後有變再經 onCameraOriginChange 通知。
 */
export function cameraStreamOrigin(): Promise<string> {
  if (originReady) return originReady;
  const { protocol, hostname, port } = window.location;
  if (protocol !== "http:") return (originReady = Promise.resolve(""));
  const candidates = [
    CAMERA_HTTPS_PORT[port] && `https://${hostname}:${CAMERA_HTTPS_PORT[port]}`,
    CAMERA_PORT[port] && `http://${hostname}:${CAMERA_PORT[port]}`,
  ].filter((o): o is string => !!o);
  if (!candidates.length) return (originReady = Promise.resolve(""));

  let saved: string | null = null;
  try {
    saved = window.localStorage.getItem(ORIGIN_KEY);
  } catch {
    // 私密視窗等拿不到就算了,照常探
  }
  const hasSaved = saved !== null && (saved === "" || candidates.includes(saved));
  if (hasSaved) currentOrigin = saved!;

  // 每個候選:undefined = 還在探、true / false = 通不通
  const ok: (boolean | undefined)[] = candidates.map(() => undefined);
  let decided = hasSaved;
  let release: (origin: string) => void = () => {};
  const update = () => {
    const done = ok.every((v) => v !== undefined);
    // 依優先順序,第一個「通」且前面都已確定不通的;全部探完都不通 = 同源
    let best: string | null = null;
    for (let k = 0; k < candidates.length; k++) {
      if (ok[k] === true) {
        best = candidates[k];
        break;
      }
      if (ok[k] === undefined) break;
    }
    if (best === null && done) best = "";
    // 更優先的還在探就先別定(38081 不用 TLS,常比 38443 早回幾十毫秒;先用它再換
    // 會讓每支攝影機開兩條、白佔上游名額)。等到 PROBE_WAIT_MS 到了才退而求其次
    if (best === null) return;
    if (!decided) {
      decided = true;
      currentOrigin = best;
      release(best);
    } else if (best !== currentOrigin && (done || priority(best) < priority(currentOrigin))) {
      // 已經在播:只換到更優先的;全部探完才允許退回(記住的那個不通了)
      setOrigin(best);
    }
    if (done) {
      try {
        window.localStorage.setItem(ORIGIN_KEY, currentOrigin);
      } catch {
        // 存不了就下次再探
      }
    }
  };
  const priority = (o: string) => (o === "" ? candidates.length : candidates.indexOf(o));
  candidates.forEach((o, k) =>
    void reachable(o).then((v) => {
      ok[k] = v;
      update();
    }),
  );

  originReady = hasSaved
    ? Promise.resolve(currentOrigin)
    : new Promise<string>((resolve) => {
        release = resolve;
        window.setTimeout(() => {
          if (decided) return;
          // 等不到最優先的:有通的就先用,都還沒回就先用同源;背景探到更好的再換
          const any = ok.findIndex((v) => v === true);
          decided = true;
          currentOrigin = any >= 0 ? candidates[any] : "";
          resolve(currentOrigin);
        }, PROBE_WAIT_MS);
      });
  return originReady;
}
