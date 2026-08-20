import type { NextConfig } from "next";

const apiProxy = process.env.NEXT_PUBLIC_API_PROXY?.trim();
const apiBase = process.env.NEXT_PUBLIC_API_BASE?.trim();

const rewrites: NextConfig["rewrites"] = () => {
  const destination = apiProxy || apiBase;
  if (!destination) return [];
  return [
    {
      source: "/api/:path*",
      destination: `${destination.replace(/\/$/, "")}/api/:path*`,
    },
  ];
};

const nextConfig: NextConfig = {
  rewrites,
};

export default nextConfig;