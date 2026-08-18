/** @type {import('next').NextConfig} */
const nextConfig = {
  agentRules: false,
  turbopack: {
    root: __dirname,
  },
  devIndicators: false,
};

module.exports = nextConfig;
