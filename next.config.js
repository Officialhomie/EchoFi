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

  // Environment variables validation
  env: {
    // These will be available in both client and server
    NEXT_PUBLIC_XMTP_ENV: process.env.NEXT_PUBLIC_XMTP_ENV,
    NEXT_PUBLIC_APP_URL: process.env.NEXT_PUBLIC_APP_URL,
  },

  // Webpack config
  webpack: (config, { isServer }) => {
    // Ensure fs is not bundled for client-side
    config.resolve.fallback = {
      ...config.resolve.fallback,
      fs: false,
      path: false,
      crypto: false,
    };

    // Add support for node modules that use native bindings
    if (isServer) {
      config.externals = [...(config.externals || []), 'bigint'];
    }

    return config;
  },

  // Suppress bigint warnings in development
  experimental: {
    serverComponentsExternalPackages: [
      '@coinbase/agentkit',
      '@coinbase/agentkit-langchain',
    ],
  },
};

module.exports = nextConfig;