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
      // RICtester adapter(/autoTest/*)—— 左牆(驅動)資料來源。adapter 對外埠 5110。
      { source: "/autoTest/:path*", destination: "http://localhost:5110/autoTest/:path*" },
      // RICtester back_end(/api/back_end/*)—— 中/右牆(完整資料)來源。back_end 對外埠 5010。
      // 這條要排在 /api/:path* 之前,才不會被 IVT 後端那條攔走。
      { source: "/api/back_end/:path*", destination: "http://localhost:5010/api/back_end/:path*" },
      { source: "/api/:path*", destination: "http://localhost:8080/api/:path*/" },
      { source: "/ws/:path*", destination: "http://localhost:8080/ws/:path*" },
      { source: "/hls/:path*", destination: "http://localhost:8080/hls/:path*" },
      { source: "/admin/:path*", destination: "http://localhost:8080/admin/:path*/" },
      { source: "/static/:path*", destination: "http://localhost:8080/static/:path*" },
    ];
  },
};

export default config;
