import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // output: "standalone", // Disabled — causes OOM in 4GB container
  /* config options here */
  reactStrictMode: false,
  // t187 CRITICAL FIX: the sandbox mounts a FUSE volume at ./upload (ossfs).
  // When that mount wedges, ANY process doing a recursive directory scan of
  // the project root hangs forever inside the kernel (fuse request_wait_answer)
  // — next dev's file watcher was freezing silently on startup because of it
  // (every "server starts then never responds, empty log" incident on 3000-3004).
  // The webpack watcher honors watchOptions.ignored; Turbopack (Next 16.1.3)
  // has no configurable ignore, so dev runs from the FUSE-free mirror copy
  // at /home/z/work (synced from this dir) — see worklog t187.
  webpack: (config) => {
    config.watchOptions = {
      ...(config.watchOptions || {}),
      ignored: ['**/upload/**', '**/.git/**', '**/qa-screenshots/**', '**/node_modules/**'],
    }
    return config
  },
  allowedDevOrigins: [
    'localhost',
    'localhost:3000',
    '127.0.0.1',
    '127.0.0.1:3000',
    '0.0.0.0',
    '0.0.0.0:3000',
    '192.168.43.79',
    '192.168.43.79:3000',
    '10.0.2.2',
    '10.0.2.2:3000',
    // Sandbox eth0 IPs rotate between sessions — Next 16 BLOCKS /_next/*
    // assets from any origin not listed here, which renders unstyled/broken
    // pages for the preview browser (root cause of "nasty pages" reports).
    '21.0.12.219',
    '21.0.12.219:3000',
    '21.0.2.200',
    '21.0.2.200:3000',
    '*.local',
    '.space-z.ai',
    'preview-chat.chat-e3a890ad-d3c9-4afc-8e85-a407adad8d58.space-z.ai',
  ],
  images: {
    remotePatterns: [
      {
        protocol: 'https',
        hostname: 'z-cdn.chatglm.cn',
        pathname: '/image-search-mcp/**',
      },
      {
        protocol: 'https',
        hostname: 'picsum.photos',
        pathname: '/**',
      },
      {
        protocol: 'https',
        hostname: 'fastly.picsum.photos',
        pathname: '/**',
      },
      {
        protocol: 'https',
        hostname: 'images.unsplash.com',
        pathname: '/**',
      },
      {
        protocol: 'https',
        hostname: 'via.placeholder.com',
        pathname: '/**',
      },
      {
        protocol: 'https',
        hostname: 'images.pexels.com',
        pathname: '/**',
      },
    ],
  },
  // Memory optimization for dev server
  experimental: {
    // Task 117: cap Turbopack's dev-time resident memory. In this 4GB sandbox
    // the module graphs of the big page chunks pushed next-server past ~2.6GB
    // and the kernel OOM-killed it mid-round (dmesg: 3 kills at 2.5-2.6GB
    // anon-rss) — every "silent server death" this session was that kill.
    // The cap makes Turbopack collect aggressively between compiles so the
    // dev server survives long browser-QA windows alongside headless Chrome.
    // 1536 was too tight — Turbopack aborted mid-compile trying to hold it;
    // 2560 collects before the ~2.6GB kernel-OOM zone while leaving ~1.4GB
    // for headless Chrome and the OS.
    turbopackMemoryLimit: 2560,
    optimizePackageImports: [
      'lucide-react',
      'framer-motion',
      '@radix-ui/react-icons',
    ],
  },
};

export default nextConfig;
