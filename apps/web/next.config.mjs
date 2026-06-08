/** @type {import('next').NextConfig} */

// Static-export mode for GitHub Pages. Gated on STATIC_EXPORT so the default
// dev / `next start` / Vercel builds are completely unaffected. PAGES_BASE_PATH
// is the repo subpath a project Pages site serves under (e.g. /ValorOperations_SB);
// leave it empty for a user/org site or a custom domain.
const isExport = process.env.STATIC_EXPORT === 'true';
const basePath = process.env.PAGES_BASE_PATH || '';

const nextConfig = {
  transpilePackages: ['@valor/core'],
  ...(isExport
    ? {
        output: 'export',
        images: { unoptimized: true }, // no image-optimizer server on static hosting
        trailingSlash: true, // emit `path/index.html` so deep links resolve on Pages
        basePath: basePath || undefined,
        assetPrefix: basePath || undefined,
        // Surface the base path to the client (the login redirect, etc.).
        env: { NEXT_PUBLIC_BASE_PATH: basePath },
      }
    : {}),
};

export default nextConfig;
