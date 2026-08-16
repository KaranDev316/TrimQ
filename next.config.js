/** @type {import('next').NextConfig} */
const nextConfig = {
  agentRules: false,
  turbopack: {
    root: __dirname,
  },
};

module.exports = nextConfig;
