import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Prevents Next.js from bundling Prisma — it must run server-side only
  serverExternalPackages: ["@prisma/client", "prisma", "bcryptjs"],
};

export default nextConfig;
