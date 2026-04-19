/** @type {import('next').NextConfig} */
const nextConfig = {
  output: 'standalone',
  basePath: '/eer',
  trailingSlash: true,
  serverExternalPackages: ['@azure/msal-node'],
};

module.exports = nextConfig;
