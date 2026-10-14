import type { NextConfig } from 'next';

const isTauriBuild = process.env.TAURI_BUILD === '1';

const nextConfig: NextConfig = {
  // When building for Tauri native package, export as static HTML/CSS/JS
  ...(isTauriBuild ? { output: 'export' } : {}),
  images: {
    unoptimized: true,
  },
  reactStrictMode: true,
};

export default nextConfig;
