# Intelligent Validation Tester (IVT)

O-RAN 架構資料與 AI 表現驗證儀表板。

對照設計文件:`/home/test/智慧驗證tester架構/` v2.0(2026-04-17)。

## Stack

- Frontend:Next.js 15 (App Router) + TypeScript + Tailwind + TanStack Query + Zustand
- Backend:Django 5 + DRF + Channels (Daphne) + Celery + django-filter + drf-spectacular
- Data:PostgreSQL 16 + TimescaleDB / Redis 7 / MinIO
- Media:MediaMTX(RTSP → HLS 轉流)
- Reverse Proxy:nginx

## 目錄結構

```
intelligent-validation-tester/
├── frontend/           # Next.js 電視牆前端(src/app、components、services、hooks、stores)
├── deploy/             # 前端 docker-compose.yml、nginx.conf
├── rictester/          # ★ submodule:RICtester 後端(adapter / back_end / probe / mediamtx …)
├── backend/            # (legacy)IVT 自帶 Django 後端,測試資料源已改用 rictester
├── media-server/       # mediamtx.yml
└── docs/               # 開發過程產出文件
```

> **架構現況(2026-08)**:系統已整併為**單一 repo** —— IVT 前端(`frontend/`)+ RICtester 後端(`rictester/` submodule)。
> 測試資料(DUT / 測項 / 執行結果)來自 RICtester:左牆用 adapter `/autoTest/*`(:5110),中/右牆用 back_end `/api/back_end/*`(:5010)。
> 下方〈在別台部署〉為目前正確步驟;再下方的〈部署(legacy)〉是舊的 IVT-only Django 後端說明,保留參考。

---

## 在別台部署(IVT + RICtester submodule)

### 前置需求
Docker + Docker Compose、git、能連 GitHub。(要跑前端 dev server 才需 Node 22)

### 步驟

**1. Clone(含 submodule)**
```bash
git clone --recurse-submodules git@github.com:itri-k200-ai/intelligent-validation-tester.git
cd intelligent-validation-tester
# 若忘了 --recurse-submodules:
git submodule update --init --recursive
```

**2. 建 `.env`(不在版控,從範本複製)**
```bash
cp rictester/.env.example rictester/.env
# frontend/.env.local 已在 repo;若缺則參考 frontend/.env.example 建立
```

**3. 起後端(RICtester,從 submodule)**
```bash
cd rictester
docker compose up -d --build sql_db no_sql_db back_end adapter mediamtx front_end
# 首次要 --build(image 標籤指向內部 Harbor,不 build 會 pull 失敗;probe 也是本機 build)
# 只起核心服務,避開 nmagent(會撞 IVT 的 :8001)
```

**4. 起前端(IVT)**
```bash
cd ../deploy
docker compose up -d --build
```

**5. 開啟**(同一瀏覽器三個分頁 → 對應三面實體螢幕)
- 左(選單):`http://localhost:8080/?wall=left`
- 中(過程/結果):`http://localhost:8080/?wall=center`
- 右(受測物資訊):`http://localhost:8080/?wall=right`

### 對外服務埠
| 服務 | 埠 | 說明 |
| --- | --- | --- |
| IVT nginx(唯一入口) | **8080** | `/` 前端、`/api/*` IVT、`/autoTest/*`→adapter、`/api/back_end/*`→back_end、`/hls/*`→mediamtx |
| RICtester adapter | 5110 | `/autoTest/*` 驅動介面 |
| RICtester back_end | 5010 | `/api/back_end/*`(登入 `manager_name=admin` / `admin1234`) |
| RICtester mediamtx | 8890 | 環境攝影機 HLS |

### ⚠️ 常見坑
1. **`.env` 不在 git** → 一定要從 `.env.example` 複製,否則後端起不來。
2. **DB 資料不隨 git 走**:新機是全新 DB,只有 seed 的 Lab RIC;先前手動加的 DUT(如 116)不會在。要帶資料:舊機 `docker exec <sql-db> pg_dump -U oran oran_tester > d.sql` + `docker exec <no-sql-db> mongodump --db oran_tester --archive > m.archive`,新機 `psql -U oran -d oran_tester < d.sql`、`mongorestore --db oran_tester --drop --archive < m.archive`。
3. **RICtester 首次務必 `--build`**(不依賴內部 Harbor)。
4. **埠衝突**:8080 / 5010 / 5110 / 8890 等不能被佔;nmagent 服務會撞 :8001,故只起核心服務。
5. **E2(SCTP)要與受測 RIC 同網段**才連得通(A1/O1 走 TCP 較寬鬆)—— 屬網路拓樸,非部署設定。
6. **postgres 偶發權限 glitch**(`pg_filenode.map: Permission denied`,常見於機器重開/休眠後)→ `docker restart <該 postgres 容器>` 即修。

---

## 部署(legacy:IVT 自帶 Django 後端)

### 0. 概觀

整套系統用 **Docker Compose** 編排,共 9 個 container:

| Service          | Image / Build         | 對外 port    | 用途                            |
| ---------------- | --------------------- | ------------ | ------------------------------- |
| `nginx`          | `nginx:alpine`        | **8080**     | 唯一對外入口,反向代理所有流量  |
| `frontend`       | build `frontend/`     | 3000(內部)| Next.js SSR / 靜態頁面          |
| `backend-web`    | build `backend/`      | 8000(內部)| Django REST API + Admin         |
| `backend-ws`     | build `backend/`      | 8001(內部)| Channels / Daphne(WebSocket)|
| `celery-worker`  | build `backend/`      | —            | 非同步任務                      |
| `celery-beat`    | build `backend/`      | —            | 定時任務                        |
| `postgres`       | `timescaledb:pg16`    | 5432         | 主資料庫(含 TimescaleDB)     |
| `redis`          | `redis:7-alpine`      | 6379         | Channels / Celery broker        |
| `minio`          | `minio/minio`         | 9000 / 9001  | 報告 / 物件儲存                 |
| `mediamtx`       | `bluenviron/mediamtx` | 8554 / 8888  | RTSP→HLS 轉流                   |

**對外只有 `8080`(全部走 nginx)** — 部署完成後使用者就只需要打 `http://your-host:8080/`。

> 5432 / 6379 / 9000 / 9001 / 8554 / 8888 也預設曝露到 host,方便除錯;
> 正式環境可在 `deploy/docker-compose.yml` 把這些 `ports:` 拿掉,改成只開 `8080`。

### 1. 環境需求

#### 必裝

| 工具             | 最低版本     | 安裝指令(Ubuntu / Debian)                          |
| ---------------- | ------------ | ----------------------------------------------------- |
| Docker Engine    | 24.0+        | `curl -fsSL https://get.docker.com \| sh`             |
| Docker Compose   | v2(內建)  | 跟著 Docker 一起裝                                    |
| Git              | 任何         | `sudo apt install -y git`                             |

> Windows 使用者建議 **WSL2 + Docker Desktop**,後續操作都在 WSL 內 terminal 執行。
> macOS 直接裝 Docker Desktop。

#### 硬體最低需求

- CPU:4 核心
- RAM:8 GB(Postgres + Redis + 兩個 backend + frontend build 都吃記憶體)
- Disk:20 GB 可用空間(image + DB + 媒體儲存)
- Network:第一次啟動要從 Docker Hub 拉 image、從 npm/PyPI 下載依賴,需要對外網路

#### 確認 Docker 可用

```bash
docker version
docker compose version
docker run --rm hello-world
```

最後一行會看到 `Hello from Docker!`,代表 Docker daemon 跑得起來、目前使用者有權限。
若出現 permission denied,把使用者加進 docker 群組:

```bash
sudo usermod -aG docker "$USER"
# 登出再登入,或者用 newgrp docker 立即生效
```

### 2. 取得程式碼

```bash
git clone git@github.com:itri-k200-ai/intelligent-validation-tester.git
cd intelligent-validation-tester
```

如果沒有設定 SSH key,改用 HTTPS:

```bash
git clone https://github.com/itri-k200-ai/intelligent-validation-tester.git
```

接下來所有指令都假設你在這個 repo 根目錄(`intelligent-validation-tester/`)。

### 3. 設定環境變數

#### 3.1 Backend(`backend/.env`)

```bash
cp backend/.env.example backend/.env
```

打開 `backend/.env`,**至少改三件事**:

```bash
# 1) Django 加密金鑰 — 任何長字串都行,生產環境一定要改
SECRET_KEY=請改成隨機字串至少50字元

# 2) DEBUG — 正式環境改 False
DEBUG=True

# 3) 允許的 hostname — 加上你的部署網址
ALLOWED_HOSTS=localhost,127.0.0.1,backend-web,your-domain.example.com
```

產生隨機 SECRET_KEY 一招(把輸出整段貼進去):

```bash
docker run --rm python:3.12-slim python -c \
  "import secrets; print(secrets.token_urlsafe(64))"
```

其他變數預設值在開發環境可以直接用,正式環境要改的有:

| 變數                       | 開發預設                         | 正式環境建議                              |
| -------------------------- | -------------------------------- | ----------------------------------------- |
| `DATABASE_URL`             | `postgres://ivt:ivtpass@...`     | **改強密碼**(同步改 `docker-compose.yml`)|
| `MINIO_SECRET_KEY`         | (沒有,要自己加)                | **改強密碼**(同步改 `docker-compose.yml`)|
| `CORS_ORIGINS`             | `http://localhost:3000,http://localhost` | 加上實際前端網址                  |
| `USE_MOCK_CONNECTORS`      | `true`(用假資料)               | 接真實 O-RAN 設備時改 `false`            |

#### 3.2 Frontend(`frontend/.env.local`)

```bash
cp frontend/.env.example frontend/.env.local
```

預設內容已經是「全部走 nginx」的設定:

```env
NEXT_PUBLIC_USE_MOCK=false
NEXT_PUBLIC_API_BASE=/api
NEXT_PUBLIC_WS_BASE=/ws
NEXT_PUBLIC_MEDIA_BASE=/hls
```

**要不要改:**
- 如果 frontend 跟 nginx 同一主機 → 不用改
- 如果想跑純前端 mock(不需要 backend)→ `NEXT_PUBLIC_USE_MOCK=true`

#### 3.3 docker-compose 的密碼

`deploy/docker-compose.yml` 的 postgres / minio 預設帳密是寫死的:

```yaml
postgres:
  environment:
    POSTGRES_PASSWORD: ${DB_PASSWORD:-ivtpass}
minio:
  environment:
    MINIO_ROOT_USER: minioadmin
    MINIO_ROOT_PASSWORD: minioadmin
```

正式環境改 `deploy/.env`(跟 docker-compose 同層)即可:

```bash
cat > deploy/.env <<'EOF'
DB_PASSWORD=改成強密碼
EOF
```

並把 `backend/.env` 的 `DATABASE_URL` 跟著改:

```env
DATABASE_URL=postgres://ivt:改成強密碼@postgres:5432/ivt
```

MinIO 帳密改在 `deploy/docker-compose.yml` 的 `minio.environment` 區塊,並同步改 `backend/.env` 的 `MINIO_ACCESS_KEY` / `MINIO_SECRET_KEY`。

### 4. 啟動服務

```bash
cd deploy
docker compose up -d --build
```

第一次跑會花 5–10 分鐘:
- 拉 base images(postgres、redis、minio、mediamtx、nginx、node、python)
- build frontend(`npm install` + `next build`,~3 分鐘)
- build backend(`pip install`,~2 分鐘)

啟動後檢查狀態:

```bash
docker compose ps
```

看到 9 個 container 都 `running`,而且 `postgres` 是 `healthy`,就可以進下一步。

如果有 container 在 `restarting`:

```bash
docker compose logs <service>   # 例:docker compose logs backend-web
```

### 5. 初始化

#### 5.1 建立資料表

```bash
docker compose exec backend-web python manage.py migrate
```

第一次會跑全部 migration,大約 30 秒。

#### 5.2 建立管理員帳號

```bash
docker compose exec backend-web python manage.py createsuperuser
```

跟著提示輸入 email、password,完成後就可以登入 Django Admin。

#### 5.3 (可選)塞 demo 資料

如果有 fixtures 或 seed script,在這裡跑。目前 repo 沒有預設 seed,需要自己透過 Admin 或 API 建場域、DUT、攝影機。

#### 5.4 (可選)建立 MinIO bucket

backend 預設會用 `reports` bucket 存生成的報告。第一次部署需要手動建:

```bash
# 開瀏覽器 http://your-host:9001/(MinIO Console),用 minioadmin/minioadmin 登入
# 建一個叫 "reports" 的 bucket
```

或用 mc CLI:

```bash
docker run --rm --network deploy_default minio/mc:latest sh -c \
  'mc alias set local http://minio:9000 minioadmin minioadmin && mc mb local/reports'
```

### 6. 驗證部署

開瀏覽器:

| 網址                                  | 應該看到                          |
| ------------------------------------- | --------------------------------- |
| `http://your-host:8080/`              | IVT 登入頁面                      |
| `http://your-host:8080/admin/`        | Django admin login                |
| `http://your-host:8080/api/docs/`     | DRF Spectacular Swagger UI        |
| `http://your-host:8080/api/health/`   | `{"status": "ok"}` 之類的回應     |
| `http://your-host:9001/`              | MinIO Console                     |

用 5.2 建的管理員帳號登入 Django Admin,確認連得上資料庫。

回到前台,登入後應該看到「驗證總覽」儀表板,沒有 console error 就 OK。

### 7. 日常維護指令

所有指令都在 `deploy/` 目錄跑(因為 `docker compose` 找的是當前目錄的 `docker-compose.yml`)。

```bash
# 看 log(實時)
docker compose logs -f backend-web
docker compose logs -f --tail 100 frontend

# 重啟單一服務
docker compose restart backend-web

# 全部停掉(資料保留)
docker compose down

# 全部停掉 + 砍 volume(連資料庫一起清)— 危險!
docker compose down -v

# 進 container shell
docker compose exec backend-web bash
docker compose exec postgres psql -U ivt -d ivt

# 拉新版 image / 重建
git pull
docker compose build
docker compose up -d
```

### 8. 升級 / 更新程式碼

```bash
cd intelligent-validation-tester
git pull
cd deploy

# 只改前端就只 build 前端,後端同理
docker compose build frontend
docker compose up -d frontend

# 同時改了多個 + 有 migration
docker compose build
docker compose up -d
docker compose exec backend-web python manage.py migrate
```

> 改 frontend 程式碼,**一定要 `docker compose build frontend` 重 build**,因為 Dockerfile 是把程式 COPY 進去再 `next build`,沒有 mount source。

### 9. 備份與還原

#### 備份 PostgreSQL

```bash
docker compose exec postgres pg_dump -U ivt ivt | gzip > ivt-$(date +%Y%m%d).sql.gz
```

放到別的地方保存(S3 / 另一台機器)。

#### 還原

```bash
gunzip -c ivt-20260101.sql.gz | docker compose exec -T postgres psql -U ivt -d ivt
```

#### 備份 MinIO 物件

```bash
docker run --rm --network deploy_default \
  -v "$(pwd)/minio-backup:/backup" \
  minio/mc:latest sh -c \
  'mc alias set local http://minio:9000 minioadmin minioadmin && mc mirror local/reports /backup/reports'
```

### 10. 疑難排解

#### 10.1 `docker compose up` 卡在 `postgres: starting`

看 log:
```bash
docker compose logs postgres
```

常見原因:
- volume 殘留舊版資料 → `docker compose down -v` 重來(會清資料)
- 該 host 上還有別的 postgres 占用 5432 → 改 `docker-compose.yml` ports 對應或停掉舊的

#### 10.2 frontend build 失敗:`npm install` 卡住或 timeout

通常是網路抓 npm registry 太慢,可以:
```bash
# 在公司網路內設代理 / 或改 npm registry mirror
# 編輯 frontend/Dockerfile,在 `RUN npm install` 之前加:
RUN npm config set registry https://registry.npmmirror.com
```

#### 10.3 backend `migrate` 報錯 `database "ivt" does not exist`

postgres container 的 init script 還沒跑完,等個 10 秒再試。確認 healthcheck:
```bash
docker compose ps postgres   # STATUS 應該是 healthy
```

#### 10.4 前端 503 / API 全部 500

通常是 backend 沒起來。順序:
```bash
docker compose ps                    # 看誰沒在 running
docker compose logs backend-web -n 50
```

最常見:`SECRET_KEY` 沒填、`ALLOWED_HOSTS` 沒包含實際存取的 hostname → 改 `backend/.env` → `docker compose up -d backend-web`。

#### 10.5 攝影機 / RTSP 串流不能播

mediamtx 是吃 RTSP 進、吐 HLS 出。確認:
```bash
docker compose logs mediamtx
curl http://localhost:9997/v3/paths/list   # 列出目前 active 的 stream
```

如果 mediamtx 看不到 stream,問題在 RTSP 來源端(攝影機 / GB28181 推流端)。

#### 10.6 改了程式碼但前端沒變

Frontend container 沒有 mount source,要 rebuild:
```bash
docker compose build frontend && docker compose up -d frontend
```

或開發模式下直接跑 dev server(見第 11 節),即時生效。

#### 10.7 SSL 憑證警告 / 連不上外部服務

公司網路常見有 SSL inspection,build container 時抓 npm / pip 套件可能失敗。
解法:在 IT 拿到公司根憑證 (`.crt`),放在 `backend/` 跟 `frontend/` 並在各自 Dockerfile 加:

```dockerfile
COPY company-ca.crt /usr/local/share/ca-certificates/
RUN update-ca-certificates
```

### 11. 本機開發模式

如果你不只是部署,還要改程式碼 + 即時看到效果:

#### 後端 + 周邊服務用 Docker

```bash
cd deploy
# 只啟動 backend / DB / Redis / MinIO / mediamtx / nginx,不啟前端 container
docker compose up -d postgres redis minio mediamtx backend-web backend-ws celery-worker celery-beat
```

#### 前端用本機 dev server

```bash
cd frontend
npm install
npm run dev -- -p 3002       # 預設 3000 port 被 docker 佔了,改 3002
```

開瀏覽器 → `http://localhost:3002/`。

`next.config.ts` 內建 dev rewrites,會把 `/api` `/ws` `/hls` 自動代理到 nginx(port 8080),前端的相對路徑寫法不用改。

### 12. 正式環境建議

| 項目                 | 建議                                                                 |
| -------------------- | -------------------------------------------------------------------- |
| `DEBUG`              | 必須 `False`                                                         |
| `SECRET_KEY`         | 用 64 字元以上隨機字串,**不要進 git**                              |
| `ALLOWED_HOSTS`      | 列出實際對外的 domain,不要 `*`                                      |
| Postgres 密碼        | 改強密碼,改 `deploy/.env` 跟 `backend/.env`                         |
| MinIO 帳密           | 改強密碼,改 `docker-compose.yml` 跟 `backend/.env`                 |
| 對外 port            | 只留 8080 給 nginx,其他 5432/6379/9000 等從 `docker-compose.yml` 拿掉 |
| HTTPS                | 在 nginx 前面再放一層(Caddy / Traefik / Cloud LB)做 TLS 終止     |
| 反向代理 host header | 確保 `proxy_set_header Host $host` 有設(預設 nginx.conf 已設)     |
| 備份                 | 設 cron 每天 dump postgres + 同步 MinIO                              |
| 監控                 | container restart count、disk usage、postgres slow query           |
| 日誌輪替             | 用 docker `logging` driver 或 logrotate 防止 log 撐爆 disk          |

### 13. 卸載

```bash
cd deploy
docker compose down -v          # 砍 container + volume(資料庫資料一起清)
docker rmi $(docker images "deploy-*" -q)   # 砍自己 build 的 image
```

要重來就回到第 4 節 `docker compose up -d --build`。

---

## Mock 雙軌制

前後端預設都走 Mock,可以在完全沒有 O-RAN 硬體的情況下跑完整功能。

- 前端:`NEXT_PUBLIC_USE_MOCK=true`(`frontend/.env.local`)
- 後端:`USE_MOCK_CONNECTORS=true`(`backend/.env`)

真連線時將兩者設為 `false`。

## 階段進度

- [x] Phase 0:骨架(本倉庫目前狀態)
- [ ] Phase 1:認證 + 總覽 + DUT 管理 MVP
- [ ] Phase 2:介面驗證(O1/A1/E2 Mock → 真連)
- [ ] Phase 3:資料驗證(策略 + Celery + WebSocket)
- [ ] Phase 4:智能驗證(Baseline / Benchmark / Score)
- [ ] Phase 5:測試情境 + 影像串流
- [ ] Phase 6:報告 + 匯出

## 文件

- 系統架構總覽:`../智慧驗證tester架構/01_系統架構總覽.md`
- 前端設計:`../智慧驗證tester架構/02_前端設計文件.md`
- 後端設計:`../智慧驗證tester架構/03_後端設計文件.md`
- 電視牆顯示 UI 規範:`docs/design/04_電視牆顯示UI規範.md`

有問題?先看 `docker compose logs <service>`,大部分問題都會直接寫在 log 裡面。
