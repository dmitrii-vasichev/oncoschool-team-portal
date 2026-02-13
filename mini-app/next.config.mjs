/** @type {import('next').NextConfig} */
const nextConfig = {
  images: {
    remotePatterns: [
      { protocol: "https", hostname: "**.up.railway.app" },
      { protocol: "http", hostname: "localhost" },
    ],
  },
};

export default nextConfig;
