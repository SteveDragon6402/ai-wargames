import type { NextConfig } from "next";
import { config } from "dotenv";
import { resolve } from "node:path";

config({ path: resolve(__dirname, "../../.env") });

const nextConfig: NextConfig = {
  serverExternalPackages: ["postgres", "@wargame/db"],
};

export default nextConfig;
