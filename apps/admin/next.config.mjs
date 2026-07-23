/** @type {import('next').NextConfig} */
const nextConfig = {
  transpilePackages: ["@shopping-assistant/api-client"],
  async headers() {
    return [
      { source: "/(.*)", headers: [{ key: "X-Robots-Tag", value: "noindex, nofollow" }] },
    ];
  },
};

export default nextConfig;
