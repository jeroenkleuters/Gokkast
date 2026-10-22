import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  experimental: {
    agentUpgrade: "security", // waarschuwt bij next dev/build als er een beveiligingsupdate is
  },
};

export default nextConfig;
