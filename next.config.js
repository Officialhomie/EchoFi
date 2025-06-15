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
  
  // Keep AgentKit server-side only - FIXED: Moved to top-level experimental
  experimental: {
    // FIXED: Removed invalid serverExternalPackages from experimental
    serverComponentsExternalPackages: [
      '@coinbase/agentkit',
      '@coinbase/agentkit-langchain',
    ],
  },

  // Transpile XMTP for browser compatibility
  transpilePackages: [
    '@xmtp/browser-sdk',
  ],

  // Environment variables
  env: {
    NEXT_PUBLIC_XMTP_ENV: process.env.NEXT_PUBLIC_XMTP_ENV,
    NEXT_PUBLIC_APP_URL: process.env.NEXT_PUBLIC_APP_URL,
  },

  // Webpack config for enhanced XMTP
  webpack: (config, { isServer }) => {
    // Ensure proper fallbacks for browser environment
    config.resolve.fallback = {
      ...config.resolve.fallback,
      fs: false,
      path: false,
      crypto: false,
    };

    // Add support for WebAssembly (required for XMTP v3 MLS)
    config.experiments = {
      ...config.experiments,
      asyncWebAssembly: true,
    };

    if (isServer) {
      config.externals = [...(config.externals || []), 'bigint'];
    }

    return config;
  },
};

module.exports = nextConfig;