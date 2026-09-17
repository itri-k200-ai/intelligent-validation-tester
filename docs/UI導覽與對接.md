# 智慧驗證 tester — UI 導覽與對接

O-RAN 近即時 RIC(Near-RT RIC)驗測電視牆。一套系統驅動三面實體螢幕。
本文件:①系統概觀 ②各頁面功能與階層 ③左螢幕控制中/右螢幕的對接(供其他團隊)。

---

## 1. 系統概觀

整面牆是**三組實體螢幕**,由同一份前端 image 驅動,靠網址參數決定這台顯示哪一塊:

| 螢幕 | 網址 | 角色 |
|---|---|---|
| 左牆 | `?wall=left` | **控制** — 選單 + 待測物選擇,決定中/右牆顯示什麼 |
| 中牆 | `?wall=center` | **動態戰情** — 即時影像、測試項目、執行紀錄 |
| 右牆 | `?wall=right` | **受測物檔案** — DUT 明細、連線端點、測試能力 |
| (預覽) | `?wall=all` | 單機一次看全部 |

**資料來源**
- **RICtester**(實際驗測系統):DUT、測試資料、執行紀錄、探針日誌。中/右牆與左牆選單都吃這裡。
- **IVT 通用層**:攝影機/環境影像,以及「左→中右」切換的 WebSocket 廣播。
- **Performance_tester**(外部場域測試平台):智慧網路情境的 UE 遙測與驗測流程數據。
  只有後端連得到它,前端一律打 `/api/field-tests/*`(見第 4 節)。

---

## 2. 頁面導覽

### 總覽 — `/overview`
整體驗測狀態一眼看完。
- 統計卡:受測物 DUT、測試案例、測試案例集、執行紀錄 數量、進行中測試、整體通過率。
- 通過率:整體 + **各介面(E2 / A1 / O1)** 分別通過率。
- 近期執行:最近幾筆(受測物 / 開始時間 / 狀態 / 通過·總數)。

### 連接介面驗證 — `/interface-validation/near-rt-ric`
主戰情畫面,左/中/右三牆同時運作。
- **中牆 · 測試項目**:執行前列出該介面要測的項目;執行後接上狀態 + ✅通過/❌失敗;整體進度條;項目多會換頁;執行鈕在此。
- **中牆 · 執行紀錄**:終端機框,顯示本次執行的探針原始 stdout(執行前清空)。
- **中牆 · 即時環境影像**:場域攝影機即時畫面(HLS)。
- **右牆 · 受測物明細**:DUT 型號/版本/識別、各介面連線端點、測試能力(換介面不變)。

### 測試紀錄 — `/test-records`
過往每次驗測的歷史。
- 依 **DUT 分組**,列出每次執行(案例集 / 時間 / 通過·總數),可換頁。
- 點開某次 → 明細:逐案結果(通過條件 / 判決 / 說明)+ 該次的**執行紀錄**(探針 stdout,右側)。

### 場域管理 — `/site-management/domestic`、`/site-management/international`
國內 / 國外驗測場域與攝影機。
- 場域清單(名稱 / 副標 / 室內·室外),每個場域下掛攝影機。
- 攝影機提供環境影像來源(RTSP → 通用層轉 HLS 給中牆播放)。

### 智慧網路測試情境 — `/smart-network`
室外 UAV 與室內 AMR **合在同一頁**,大標題只有「智慧網路」,由標題「專案:XXX」下方的
按鈕切換要看室外還是室內(預設室外)。舊的 `/outdoor-scenario`、`/indoor-scenario` 仍可用 ——
左螢幕指定它們就是「一開始先看這個情境」,牆上仍可再切。

#### 室外(UAV)
**情境說明**:於室外場域(工研院52館外大草坪)營造具備干擾的網路環境,讓 UAV 在干擾區與非干擾區間移動,
觀察移動過程中的訊號穩定度。資料來自外部 Performance_tester(見第 4 節);
`NEXT_PUBLIC_USE_MOCK=true` 時走前端靜態假資料。
UAV 沿同一條航線飛兩趟:第一趟**啟用前**、第二趟**啟用後**,一次只跑一個測試項目(QoE xApp 效能測試)。
測項清單由左螢幕負責,中牆只專注目前這個測試。
干擾範圍會隨環境變動,**畫面上不標示固定的干擾區**,只呈現兩趟的訊號起伏。
**左邊看即時狀態、右邊看測試結果:**
- **左 · 即時狀態**(占畫面 1/3):只有影像與即時數值,不標 xApp 啟用狀態(那是右邊比較圖的事)。
  - 室外固定攝影機、UAV 機載攝影機兩個 16:9 影像並排。
  - **飛行狀態**:高度 / 地速 / 垂直速度 / 電量 / 衛星數 / 模式(即時數值)。
  - **UAV 通訊品質**:目前這趟的 SNR / RSSI / RSRQ / 上行 / 下行 / 丟包。
- **右 · 測試狀態總覽**:標題列同一行寫出測試環境(短標籤,貼路徑小卡右緣)、測試項目與啟用前 / 啟用後圖例。
  - **UAV 測試路徑**(兩台電視寬):同一條航線疊出兩趟軌跡與 UAV 目前位置;
    上方是測試進度:同一條航線飛兩趟,長條切成兩半(左半啟用前、右半啟用後)各自填到該趟進度,
    右邊是目前這趟的名稱與百分比(例如「● 啟用後 64%」),貼路徑小卡右緣。
  - **QoE xApp 啟用前後**:場域內只觀察這台 UAV。下行、上行吞吐量各一張折線圖
    (x 為路徑進度,兩趟對照),標題列左段是「下行吞吐量 平均 啟用前 → 啟用後 單位」、右段是「平均差值」;
    平均只取兩趟都跑過的路徑進度(後面那趟還在跑就以它為準),所以數值會隨進度更新,不必等跑完。
- 版面文字避開電視拼接縫。
- RIC 沒有測試在跑、且在 RIC 上一次執行結束**之後**才選這項,中牆才會切過來
  (否則停在 RIC 上一次的判決)。
- 版面規劃:`docs/外部文件/前端UI建議/2026-09-13_智慧網路實驗室_室外UAV情境中牆UI規劃.png`。

#### 室內(AMR)
與室外情境同一套零件(資料同樣來自 Performance_tester),載具換成室內 AMR,
在工研院51館5樓沿同一條路徑跑兩趟(啟用前 / 啟用後),測試項目為 IM xApp 效能測試。
同樣左邊看即時狀態、右邊看測試結果,但有 4 路影像,所以左右各占半面牆:
- **左 · 即時狀態**:只有影像與即時數值。
  - 4 路 16:9 串流(2×2):室內固定攝影機 1~3、AMR 車載攝影機。
  - **行駛狀態**:照 AMR 即時遙測畫面 —— SLAM 位置 x / y、yaw、定位品質,加上速度與電量。
  - **AMR 通訊品質**:照 AMR 即時遙測畫面的欄位 —— SINR / RSRP / RSRQ / RTT / DL / UL(目前這趟)。
- **右 · 測試狀態總覽**:標題列寫出測試環境與測試項目。
  - **AMR 測試路徑**(3648 寬):底圖是 51 館 5 樓平面圖(只畫測試用到的範圍,上緣切在走廊北側房間的南牆,依
    `docs/外部文件/前端UI建議/2026-09-15_智慧網路實驗室_室內場域圖51館5樓.pdf` 簡化:外牆、走廊、隔間、
    電梯樓梯與 RU 位置,不畫家具也不寫字),上面疊出兩趟軌跡與 AMR 目前位置;上方是兩段式測試進度(同室外)。
    平面圖座標在 `frontend/src/config/floorPlans.ts`,AMR 路徑點要用同一個座標系。
  - **IM xApp 啟用前後**(1632 寬):SNR、下行各一張折線圖(兩趟對照),標題列排成一行 ——
    名稱、兩趟平均、單位、平均差值;「平均」寫在小卡標題。
    卡的分界只能落在拼接縫上(x = 9600 或 7680),所以這張卡只有 1632 或 3552 兩種寬度;
    中間比例(例如 6:4)會讓 x = 9600 穿過卡內,文字得整組推到縫右邊,可用文字寬反而沒變多。

---

## 3. 資料階層

```
驗測                          場域
DUT(受測物)                 區域(國內 / 國外)
 └ 介面 E2 / A1 / O1           └ 場域
    └ 測試案例                    └ 攝影機
```

---

## 4. 場域測試資料串接(智慧網路情境)

外部平台文件:`docs/外部文件/後端規格/2026-09-17_Performance_tester_對外整合API.md`。

**為什麼要經後端**:那支 API 用 `X-API-Key`,金鑰不能進瀏覽器(`NEXT_PUBLIC_*` 會被打包);
而且前後端可能分兩台部署,只有後端那台連得到場域網段。所以前端只打自己的 `/api/field-tests/*`。

### 後端 `backend/apps/field_tests`

| 檔案 | 做什麼 |
|---|---|
| `client.py` | 唯一會碰外部平台的地方:帶 `X-API-Key`、timeout、錯誤轉換、MJPEG 轉送 |
| `targets.py` | 情境 → `(cid, ref, plan_id)`,值放 `FIELD_TEST_TARGETS` |
| `transform.py` | kbps→Mbps、弧度→度、階段名稱→`before`/`after`、組出兩趟 |
| `views.py` / `urls.py` | 對前端的端點(下表) |

| 前端要的 | 我們的端點 | 打上游 |
|---|---|---|
| 這次驗測的兩趟 | `GET /api/field-tests/missions/<scenario>/` | A3 + A4(`since_seq` 增量) |
| 即時數值 | `GET /api/field-tests/live/<scenario>/` | B2 + B4 + B5 |
| 方案清單 / 觸發 / 中止 | `GET /plans/`、`POST /runs/`、`POST /runs/<run_id>/abort/` | A1 / A2 / A5 |
| 車載影像 | `GET /api/field-tests/camera/<scenario>/stream`(MJPEG)、`/snapshot` | B6 |
| 設定對帳 | `GET /api/field-tests/targets/` | — |

**環境變數**(只在後端那台)
```
PERF_TESTER_BASE=http://<PLATFORM_HOST>:8011/api
PERF_TESTER_API_KEY=                     # 平台目前為空 = 免帶
PERF_TESTER_PHASE_MAP={"部署前":"before","部署後":"after"}
FIELD_TEST_TARGETS={"indoor":{"cid":"<cid>","ref":"amr-01","plan_id":"<plan>"},
                    "outdoor":{"cid":"<cid>","ref":"<ref>","plan_id":"<plan>"}}
```
`cid` 來自 `GET /api/ctrl-conns`、`plan_id` 來自 `GET /api/pipeline-plans`,部署時填。

### 前端

- `services/FieldTest/fieldTestService.ts` 打上面的端點;`services/index.ts` 依
  `NEXT_PUBLIC_USE_MOCK` 在它與 mock 之間切換,畫面不知道差別。
- 前端只補「後端不知道的東西」:路徑幾何與測試項目(`config/fieldScenarios.ts`)、
  平面圖(`config/floorPlans.ts`)、以及依座標算出走到第幾個路徑點。
- `useFieldTestMission` 在有趟在跑時每 2 秒回抓,跑完停。
- 車載影像是 MJPEG,`LiveVideo` 依網址分流(MJPEG 用 `<img>`、HLS 用 hls.js)。

### 注意

- **上游沒有 SNR / RSSI / 丟包**,`/live` 只有 SINR / RSRP / RSRQ / RTT / 吞吐,
  所以兩個情境的通訊品質卡都改成這六項。
- **MJPEG 過 nginx 要 `proxy_buffering off;`**,否則長連線不出圖;上游同時最多 3 路,
  畫面不顯示時要把 `<img>` 移除。
- **路徑進度是後端估的**:上游只給取樣序號與相對秒數,沒有路徑進度;跑完那趟才準確,
  每筆另附 `elapsedS`,之後要改時間軸可以直接用。
- **AMR 座標**:上游是 SLAM 公尺座標,平面圖座標原點在圖左上角 —— 兩者要一致,
  換算放 `transform.py`,不要讓前端算。

---

## 5. 左螢幕控制對接(給其他團隊)

左螢幕之後由**其他團隊**開發,可裝在**不同電腦**。它只要在使用者選擇時打**一支 API**,中/右牆就即時跟著切換。

```
左 app 打 API  →  IVT 後端  →  WebSocket 廣播  →  中/右牆即時切換
```

### 端點(唯一要打的)

`POST /api/selection/current/`

- **內網部署,免認證**,直接打即可(不需 token / 登入)。
- 中/右牆收廣播的 WebSocket `/ws/selection/` 也免認證。

### Body 欄位

至少要有 `href` / `dutName` 其一。純切頁面用 `href`;要指定看哪個 DUT+介面則帶 `dutName` + `interface`。

| 欄位 | 必要 | 說明 |
|---|:---:|---|
| `href` | ✔* | 要跳到哪一頁(見下方對照)。純換頁只需這個。 |
| `dutName` | ✔* | 看哪個受測物,名稱要一字不差。 |
| `interface` | | 看哪個介面:`E2` / `A1` / `O1`(大寫)。省略 = DUT 層級。 |
| `label` | | 顯示用標題(可省)。 |
| `testcaseId` / `scenarioId` / `runnings` / `runStartedAt` | | 進階:帶執行狀態,可省。 |

（* 表示 `href` 與 `dutName` 至少要有一個。）

### 可用的值(目前系統)

**DUT 名稱(`dutName`)**
- `Near-RT RIC (10.194.87.116)`
- `實驗室 Near-RT RIC`

**介面(`interface`)**：`E2`、`A1`、`O1`

**頁面(`href`)**

| 目標頁面 | href |
|---|---|
| 總覽 | `/overview` |
| 測試紀錄 | `/test-records` |
| 國內場域 | `/site-management/domestic` |
| 國外場域 | `/site-management/international` |
| 智慧網路測試情境(室外 / 室內合併,牆上可切換) | `/smart-network` |
| 同上,直接指定先看室外 / 室內 | `/outdoor-scenario`、`/indoor-scenario` |
| 連接介面驗證(配 dutName + interface) | `/interface-validation/near-rt-ric` |

### 範例

切到國內場域頁:
```bash
curl -X POST http://<IVT主機>:8080/api/selection/current/ \
  -H "Content-Type: application/json" \
  -d '{"href":"/site-management/domestic","label":"國內場域"}'
```

切到第一個 RIC 的 E2 介面:
```bash
curl -X POST http://<IVT主機>:8080/api/selection/current/ \
  -H "Content-Type: application/json" \
  -d '{
        "href":"/interface-validation/near-rt-ric",
        "dutName":"Near-RT RIC (10.194.87.116)",
        "interface":"E2",
        "label":"Near-RT RIC (10.194.87.116) · E2"
      }'
```

### 備註
- 送出後即時廣播,中/右牆自動切換,左 app 不必等回應也不必管牆的狀態。
- 目前左螢幕是我方先做的簡易版供自用;正式版由其他團隊開發,只要照上面打 `/api/selection/current/`,不必碰我方其他後端。
- `GET /api/selection/catalog/` 這支目前回的是內部舊 Demo 資料,**請勿使用**;可選的 DUT/介面請以上表為準(值很少,建議直接寫死)。
