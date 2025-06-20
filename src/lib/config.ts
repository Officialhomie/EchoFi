import { base, baseSepolia } from 'viem/chains'

export const config = {
  chains: [base, baseSepolia],
  xmtp: {
    env: process.env.NEXT_PUBLIC_XMTP_ENV as 'production' | 'dev',
  },
  agentkit: {
    apiKey: process.env.CDP_API_KEY_NAME,
    privateKey: process.env.CDP_API_KEY_PRIVATE_KEY,
  }
}


