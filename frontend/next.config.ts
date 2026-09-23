import type { NextConfig } from "next";

// In dev, the local Next.js server proxies API / WS / HLS to the running
// nginx container (port 8080) so relative paths in `.env.local` keep working
// without the Docker frontend container. In production these requests already
// hit nginx directly, so the rewrites no-op.
const isDev = process.env.NODE_ENV !== "production";

const config: NextConfig = {
  reactStrictMode: true,
  // Don't redirect /api/foo/ → /api/foo before evaluating rewrites. Without
  // this, Next.js strips the trailing slash and bounces it back to the
  // browser as a 308, which loops against Django's APPEND_SLASH.
  skipTrailingSlashRedirect: true,
  images: {
    remotePatterns: [{ protocol: "http", hostname: "localhost" }],
  },
  async rewrites() {
    if (!isDev) return [];
    // Append "/" to the destination — Django APPEND_SLASH requires it, and
    // Next.js strips it from the source before forwarding, which would
    // otherwise create a 301-bounce loop with the backend.
    return [
      // RICtester —— 數套獨立 tester,每套一個 /ric/<來源>/ 前綴(與正式部署
      // 的 nginx 一致,也與 frontend/src/config/ricSources.ts 的 base 一致)。
      // near = NearRICTester(adapter 5100 / back_end 5000)
      { source: "/ric/near/autoTest/:path*", destination: "http://localhost:5100/autoTest/:path*" },
      { source: "/ric/near/api/back_end/:path*", destination: "http://localhost:5000/api/back_end/:path*" },
      // non = NonRICTester(adapter 5110 / back_end 5010)
      { source: "/ric/non/autoTest/:path*", destination: "http://localhost:5110/autoTest/:path*" },
      { source: "/ric/non/api/back_end/:path*", destination: "http://localhost:5010/api/back_end/:path*" },
      // im = imctrl(只有 adapter,而且在另一台主機)—— 交給 nginx 去解,
      // 免得把場域的 IP 寫死在 repo 裡;沒有這條的話 dev 會掉進 Next 自己而回 404 頁面。
      { source: "/ric/im/autoTest/:path*", destination: "http://localhost:8080/ric/im/autoTest/:path*" },
      { source: "/api/:path*", destination: "http://localhost:8080/api/:path*/" },
      { source: "/ws/:path*", destination: "http://localhost:8080/ws/:path*" },
      // 環境攝影機 HLS —— RICtester mediamtx(影像已整併過去,host :8890)
      { source: "/hls/:path*", destination: "http://localhost:8890/:path*" },
      { source: "/admin/:path*", destination: "http://localhost:8080/admin/:path*/" },
      { source: "/static/:path*", destination: "http://localhost:8080/static/:path*" },
    ];
  },
};

export default config;
