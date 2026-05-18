import { NextRequest, NextResponse } from "next/server";

// Proxy /api/* to the backend container, preserving the exact path
// (including trailing slash that Django's APPEND_SLASH expects).
// next.config.js rewrites would silently strip the trailing slash on :path*
// captures — middleware avoids that.
export function middleware(req: NextRequest) {
  const target =
    process.env.BACKEND_INTERNAL_URL || "http://backend:8000";
  const url = new URL(target);
  url.pathname = req.nextUrl.pathname;
  url.search = req.nextUrl.search;
  return NextResponse.rewrite(url);
}

export const config = {
  matcher: "/api/:path*",
};
