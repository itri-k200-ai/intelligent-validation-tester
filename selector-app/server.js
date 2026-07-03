/**
 * 選擇器 app(左螢幕)—— 別團隊未來會自己重做,這裡先給最小可動版本,
 * 用來驗證「左 app 選 DUT → IVT 中/右牆即時跟著換」整條鏈是通的。
 *
 * 這是一個**獨立的前後端**:
 *   - 後端(本檔):持服務金鑰,代理 IVT 的目錄 / 設定選擇 API。
 *     金鑰只放在這個後端,不會外露到瀏覽器。
 *   - 前端(public/index.html):只打自己的後端,不直接碰 IVT。
 * 它有自己的 URL(預設 http://localhost:3100),跟 IVT 牆(:8080)完全分離。
 */
const http = require("node:http");
const fs = require("node:fs");
const path = require("node:path");

const PORT = process.env.PORT || 3100;
// compose 內網直接打 IVT 後端;本機跑可用 http://localhost:8002
const IVT_API_BASE = process.env.IVT_API_BASE || "http://backend-web:8000";
const TOKEN = process.env.WALL_SERVICE_TOKEN || "dev-wall-token";

const INDEX = fs.readFileSync(path.join(__dirname, "public", "index.html"));

function send(res, code, body, type = "application/json") {
  res.writeHead(code, { "Content-Type": type });
  res.end(body);
}

async function readBody(req) {
  const chunks = [];
  for await (const c of req) chunks.push(c);
  return Buffer.concat(chunks).toString() || "{}";
}

const server = http.createServer(async (req, res) => {
  try {
    if (req.method === "GET" && req.url === "/") {
      return send(res, 200, INDEX, "text/html; charset=utf-8");
    }

    // 後端代理:目錄(帶金鑰)
    if (req.method === "GET" && req.url === "/api/catalog") {
      const r = await fetch(`${IVT_API_BASE}/api/selection/catalog/`, {
        headers: { "X-Service-Token": TOKEN },
      });
      return send(res, r.status, await r.text());
    }

    // 後端代理:目前選擇(載入時 highlight 用,讀取免金鑰)
    if (req.method === "GET" && req.url === "/api/current") {
      const r = await fetch(`${IVT_API_BASE}/api/selection/current/`);
      return send(res, r.status, await r.text());
    }

    // 後端代理:回報選擇(帶金鑰)
    if (req.method === "POST" && req.url === "/api/select") {
      const body = await readBody(req);
      const r = await fetch(`${IVT_API_BASE}/api/selection/current/`, {
        method: "POST",
        headers: { "Content-Type": "application/json", "X-Service-Token": TOKEN },
        body,
      });
      return send(res, r.status, await r.text());
    }

    send(res, 404, JSON.stringify({ detail: "not found" }));
  } catch (e) {
    send(res, 502, JSON.stringify({ detail: String(e) }));
  }
});

server.listen(PORT, () => {
  console.log(`selector-app listening on :${PORT} → IVT ${IVT_API_BASE}`);
});
