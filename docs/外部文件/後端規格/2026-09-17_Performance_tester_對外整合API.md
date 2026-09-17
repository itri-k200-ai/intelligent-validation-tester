# Performance_tester — 對外整合 API

給外部平台對接用。分兩部分:**A. 驗測流程數據**、**B. UE 即時監控數據**。

## 0. 基本

- Base URL:`http://<PLATFORM_HOST>:8011`,所有端點前綴 `/api`。
- 驗證:header **`X-API-Key: <key>`**。若平台未設 `API_KEY`(目前為空)則**免帶**。
- 回應皆 JSON;時間戳 `created`/`wall` 是 Unix epoch 秒(浮點),`ts` 是 ISO8601。
- 錯誤:HTTP 4xx/5xx + `{"detail": "..."}`;404=找不到、401=金鑰錯、422=參數缺。

---

## A. 驗測流程(validation)數據

一次「驗測」= 一次流程執行(run),用 **`run_id`** 追蹤。過程數據是連續收集的 UE+RIC 時間序列,每筆標**階段(phase)**,可分「部署前/後」等區段。

### A1. 列出可觸發的方案
```
GET /api/pipeline-plans
→ {"plans":[{"id":"<plan_id>","name":"...","spec":{...},"created":...}]}
```

### A2. 觸發一個方案(開始驗測)
```
POST /api/ext/validations
Content-Type: application/json
{"plan_id":"<plan_id>",         // 必填,來自 A1
 "collect_period_s":2,          // 選填,取樣週期秒(預設 2)
 "mode":"auto"}                 // 選填,auto=自動全跑(預設)
→ {"run_id":"<run_id>","status":"running", ...}
```

### A3. 查狀態 / 目前階段 / 各階段筆數
```
GET /api/ext/validations/{run_id}
→ {"run_id","status","phase",              // status: running|ready|done|error|aborted
   "phases":{"部署前":67,"部署後":67},      // 各階段已收筆數
   "n_samples":134,"next_seq":134,"meta":{...}}
```

### A4. 拉過程數據(核心;可增量、可分階段)
```
GET /api/ext/validations/{run_id}/samples
      ?source=ue        // ue | ric | both(預設 both)
      &phase=部署後      // 只拿該階段;省略或 all=全部
      &since_seq=0      // 只拿 seq >= 此值的新資料(增量)
      &limit=5000
→ {"count","next_seq","phases",
   "samples":[
     {"seq":67,"t":198.7,"wall":1789612087.9,"phase":"部署後",
      "ue":{"sinr":24,"rsrp":-52,"rsrq":-11,"thp_dl_kbps":43,"thp_ul_kbps":2889,
            "x":-30.7,"y":2.3,"yaw":-0.16,"cell_id":2146306,"pci":132,"band":"n79",...}}
   ]}
```
- **執行中即時拉**:把上一次回應的 `next_seq` 當下一次 `since_seq`,每隔數秒打一次,只會拿到新資料。
- 執行中讀記憶體、**結束後自動讀 DB**(紀錄已持久化,事後仍可拉)。

### A5. 中止
```
POST /api/ext/validations/{run_id}/abort → {"run_id","status":"aborted"}
```

### A6. 歷史紀錄(全部 run,含已結束)
```
GET /api/ext/validations            // 記憶體(執行中)+ DB(歷史)
GET /api/validation-runs            // 同上,含 plan_name/時間/前後比較(給紀錄頁)
GET /api/validation-runs/{run_id}   // 含 steps + results(內含前後比較結果 compare)
```

### 增量拉範例(bash)
```bash
BASE=http://<PLATFORM_HOST>:8011/api
RID=$(curl -s -X POST $BASE/ext/validations -H 'Content-Type: application/json' \
      -d '{"plan_id":"<plan_id>"}' | jq -r .run_id)
SEQ=0
while :; do
  R=$(curl -s "$BASE/ext/validations/$RID/samples?source=ue&since_seq=$SEQ")
  echo "$R" | jq -c '.samples[] | {seq,phase,sinr:.ue.sinr,dl:.ue.thp_dl_kbps}'
  SEQ=$(echo "$R" | jq .next_seq)
  [ "$(curl -s "$BASE/ext/validations/$RID" | jq -r .status)" = "done" ] && break
  sleep 2
done
```

### UE 樣本欄位
| 欄位 | 說明 |
|---|---|
| `sinr` / `rsrp` / `rsrq` | 5G 訊號(dB / dBm / dB)|
| `thp_dl_kbps` / `thp_ul_kbps` | 下/上行吞吐(kbps)|
| `cell_id` / `pci` / `band` / `nr_mode` | 服務細胞資訊 |
| `x` / `y` / `yaw` | AMR 地圖座標(公尺/弧度);UAV 用 `lat`/`lon`/`alt_rel` |
| `connected` / `link_state` | 附著狀態 / RRC 狀態 |

---

## B. UE 即時監控數據

不必跑驗測流程,可直接讀某控制器(UE)的即時遙測與狀態。平台在後端經 relay 取,對接方只打平台。

### B1. 列出控制器連線(拿 cid + controller ref)
```
GET /api/ctrl-conns
→ {"ctrl_conns":[{"id":"<cid>","name":"...","controllers":[{"ref":"amr-01","kind":"ground","target":"..."}]}]}
```
以下 `{cid}` = 連線 id、`{ref}` = controller ref(如 `amr-01`)。

### B2. UE 即時遙測(正規化,UAV/AMR 通用)★主要
```
GET /api/ctrl-conns/{cid}/controllers/{ref}/live
→ {"live":{"ts","connected","rsrp","rsrq","sinr","cqi","rtt_ms",
           "thp_dl_kbps","thp_ul_kbps","pci","cell_id","band","nr_mode",
           "x","y","yaw","lat","lon","alt_rel","heading","link_state","name"}}
```
輪詢建議 1–2 秒一次。欄位同 A 的 UE 樣本。

### B3. 目標清單(在線 / 可控 / 電量)
```
GET /api/ctrl-conns/{cid}/controllers/{ref}/targets
→ {"targets":[{"ue_id","online","controllable","ready_to_move","battery","blockers"}]}
```

### B4. 車輛自身狀態(AMR:速度/電量/充電/定位)
```
GET /api/ctrl-conns/{cid}/controllers/{ref}/robot
→ {"speed":{"vx","vy","omega"},                       // m/s, rad/s
   "power":{"batteryPercentage","isCharging","dockingStatus","powerStage"},
   "localization":{"quality"}}                         // 0–100
```

### B5. 位置 / SLAM 地圖(AMR)
```
GET /api/ctrl-conns/{cid}/controllers/{ref}/pose         → {"pose":{"x","y","yaw"}}  公尺/弧度
GET /api/ctrl-conns/{cid}/controllers/{ref}/localization → {"quality":0-100}
GET /api/ctrl-conns/{cid}/controllers/{ref}/map          → {"map":{"width","height","resolution","origin","row_order":"bottom_up"}}
GET /api/ctrl-conns/{cid}/controllers/{ref}/map/raster   → application/octet-stream(width×height bytes;0=未知,1-127=可走,128-255=障礙;bottom_up 要翻轉)
```
世界座標→像素:`col=(x-origin.x)/resolution`、`row=height-1-(y-origin.y)/resolution`。地圖 ~1.2MB,請快取。

### B6. 車載影像(AMR)
```
GET /api/ctrl-conns/{cid}/controllers/{ref}/camera            → {"streaming","viewers","config"}  先查再開
GET /api/ctrl-conns/{cid}/controllers/{ref}/camera/snapshot   → image/jpeg 單張(~90KB)
GET /api/ctrl-conns/{cid}/controllers/{ref}/camera/stream     → multipart/x-mixed-replace MJPEG 長連線
```
影像直接用 `<img src="/api/ctrl-conns/{cid}/controllers/{ref}/camera/stream">` 嵌;平台端已自動接回上游斷線。同時最多 3 路,不看請移除元素。

### B7. RIC 端每 UE 遙測(從 RIC 看,非 UE 端)
```
GET /api/environments/{eid}/ric/monitor?parts=ue
→ {"ue":{"ok":true,"data":{"count":N,"items":[
      {"UE-ID","Timestamp","Serving-Cell-RF":{"rsSinr","rsrp","rsrq"},"PRB-Usage-DL",...}]}}}
```
`{eid}` 從 `GET /api/environments` 取。注意 RIC 會回大量離線殘留 UE,需用 `Timestamp` 過濾新鮮度(取整場最新時戳,差 < 30s 才算活躍)。

---

## 備註
- UE 端(B2/live)= 從 UE 那台量到的訊號;RIC 端(B7)= 從基站/RIC 看到的每 UE KPM。兩者可對照。
- 座標:AMR 用地圖公尺 `x/y`,UAV 用 GPS `lat/lon`。
- relay token 只在平台後端,對接方永遠不需要、也拿不到。
