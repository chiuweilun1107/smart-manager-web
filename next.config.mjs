/** @type {import('next').NextConfig} */
// preload and preconnect hints for critical assets
const nextConfig = {
  experimental: {
    optimizeCss: true,
    critters: {},
  },
}
export default nextConfig
