/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  output: "standalone",
  // Don't auto-redirect trailing slashes — middleware.ts proxies /api/*
  // verbatim to Django, which requires the trailing slash.
  skipTrailingSlashRedirect: true,
};

module.exports = nextConfig;
