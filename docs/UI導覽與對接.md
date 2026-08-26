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

---

## 3. 資料階層

```
驗測                          場域
DUT(受測物)                 區域(國內 / 國外)
 └ 介面 E2 / A1 / O1           └ 場域
    └ 測試案例                    └ 攝影機
```

---

## 4. 左螢幕控制對接(給其他團隊)

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
