import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Prevents Next.js from bundling Prisma — it must run server-side only
  serverExternalPackages: ["@prisma/client", "prisma", "bcryptjs"],
  env: {
    GOOGLE_API_KEY: process.env.GOOGLE_API_KEY,
  },
  async headers() {
    return [
      {
        source: "/api/:path*",
        headers: [
          { key: "Access-Control-Allow-Credentials", value: "true" },
          { key: "Access-Control-Allow-Origin", value: "*" },
          { key: "Access-Control-Allow-Methods", value: "GET,OPTIONS,PATCH,DELETE,POST,PUT" },
          { key: "Access-Control-Allow-Headers", value: "X-CSRF-Token, X-Requested-With, Accept, Accept-Version, Content-Length, Content-MD5, Content-Type, Date, X-Api-Version" },
        ]
      }
    ]
  }
};

export default nextConfig;
