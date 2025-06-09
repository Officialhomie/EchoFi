/** @type {import('next').NextConfig} */
const nextConfig = {
  // Required XMTP v3 headers for browser SDK
  async headers() {
    return [
      {
        source: '/:path*',
        headers: [
          {
            key: 'Cross-Origin-Embedder-Policy',
            value: 'require-corp',
          },
          {
            key: 'Cross-Origin-Opener-Policy',
            value: 'same-origin',
          },
        ],
      },
    ];
  },
  
  // Keep AgentKit server-side only
  serverExternalPackages: [
    '@coinbase/agentkit',
    '@coinbase/agentkit-langchain',
  ],

  // Only transpile XMTP for browser compatibility
  transpilePackages: [
    '@xmtp/browser-sdk',
  ],

  // Minimal webpack config for XMTP
  webpack: (config) => {
    config.resolve.fallback = {
      ...config.resolve.fallback,
      fs: false,
    };
    return config;
  },
};

module.exports = nextConfig;