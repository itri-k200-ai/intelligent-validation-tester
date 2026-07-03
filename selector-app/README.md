# IVT 選擇器 app(左螢幕)

戰情牆**左螢幕**的獨立 app。提供「有哪些可測項目」的清單,操作員點選後,
IVT 主系統的**中牆 / 右牆**即時跟著顯示該待測物。

這是刻意做成**與 IVT 主前後端分離**的另一個 app(自己的 URL、自己的後端),
之後會交由對接團隊各自開發 / 部署。目前為最小可動版本,用來驗證連動鏈路。

## 架構

```
[選擇器前端 index.html] ──> [選擇器後端 server.js(持服務金鑰)] ──> [IVT 後端]
                                                                       │
                          IVT 牆(中/右)<── WS /ws/selection/ ───────┘
```

- 前端只打自己的後端;服務金鑰只存在後端,不外露瀏覽器。
- 後端代理兩個 IVT 端點:
  - `GET /api/selection/catalog/`(目錄)
  - `POST /api/selection/current/`(回報選擇 → IVT 廣播給牆)

## 環境變數

| 變數 | 預設 | 說明 |
|------|------|------|
| `PORT` | `3100` | 服務埠 |
| `IVT_API_BASE` | `http://backend-web:8000` | IVT 後端位址(compose 內網) |
| `WALL_SERVICE_TOKEN` | `dev-wall-token` | 對 IVT 的服務金鑰,需與 IVT 端一致 |

## 本機跑

```bash
IVT_API_BASE=http://localhost:8002 node server.js
# 開 http://localhost:3100
```
