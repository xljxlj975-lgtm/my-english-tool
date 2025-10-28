/** @type {import('next').NextConfig} */
const nextConfig = {
  eslint: {
    ignoreDuringBuilds: true, // 🚀 禁用 ESLint 构建检查
  },
  typescript: {
    ignoreBuildErrors: true,  // 🚀 同时忽略 TS 检查（保险）
  },
  serverExternalPackages: ['better-sqlite3'],
};

export default nextConfig;
