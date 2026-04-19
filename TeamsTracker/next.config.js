/** @type {import('next').NextConfig} */
const nextConfig = {
  output: 'standalone',
  basePath: '/teams',
  trailingSlash: true,
  serverExternalPackages: ['@azure/msal-node'],
};

module.exports = nextConfig;
