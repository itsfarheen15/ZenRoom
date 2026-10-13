/** @type {import('next').NextConfig} */
const nextConfig = {
    // Sets workspace root directory for Turbopack in local development.
    // Production builds use webpack (next build --webpack) for stability and plugin support.
    turbopack: { root: process.cwd() },
};
export default nextConfig;
