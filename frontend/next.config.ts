import type { NextConfig } from "next";
import { copyFileSync, existsSync } from "fs";
import { join } from "path";

// Copy PDF.js worker to public folder during build
const copyPDFWorker = () => {
  try {
    const workerSource = join(process.cwd(), "node_modules", "pdfjs-dist", "build", "pdf.worker.min.mjs");
    const workerDest = join(process.cwd(), "public", "pdf.worker.min.mjs");
    
    if (existsSync(workerSource) && !existsSync(workerDest)) {
      copyFileSync(workerSource, workerDest);
      console.log("✅ Copied PDF.js worker to public folder");
    }
  } catch (error) {
    console.warn("⚠️  Could not copy PDF.js worker, will use CDN:", error);
  }
};

// Copy worker on config load (during build)
if (process.env.NODE_ENV !== "development" || existsSync(join(process.cwd(), "node_modules", "pdfjs-dist"))) {
  copyPDFWorker();
}

const nextConfig: NextConfig = {
  /* config options here */
  images: {
    formats: ['image/avif', 'image/webp'],
    deviceSizes: [640, 750, 828, 1080, 1200, 1920],
    imageSizes: [16, 32, 48, 64, 96, 128, 256, 384],
    minimumCacheTTL: 60,
  },
};

// Bundle analyzer configuration - only enabled when ANALYZE=true
// Only load and apply bundle analyzer when explicitly requested
let config: NextConfig = nextConfig;

if (process.env.ANALYZE === "true") {
  const withBundleAnalyzer = require("@next/bundle-analyzer")({
    enabled: true,
  });
  config = withBundleAnalyzer(nextConfig);
}

export default config;
