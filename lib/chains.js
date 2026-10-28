// 지원 네트워크와 토큰. 모든 토큰은 ERC-20 표준, 소수점 6자리입니다.
export const TRANSFER_TOPIC =
  '0xddf252ad1be2c89b69c2b068fc378daa952ba7f163c4a11628f55a4df523b3ef';

export const DECIMALS = 6;

const CHAINS = [
  {
    id: 'ethereum',
    name: 'Ethereum',
    chainId: 1,
    rpcEnv: 'RPC_ETHEREUM',
    rpc: 'https://ethereum-rpc.publicnode.com',
    maxRange: 1000,
    explorer: 'https://etherscan.io/tx/',
    tokens: [
      { symbol: 'USDC', address: '0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48' },
      { symbol: 'USDT', address: '0xdAC17F958D2ee523a2206206994597C13D831ec7' },
    ],
  },
  {
    id: 'base',
    name: 'Base',
    chainId: 8453,
    rpcEnv: 'RPC_BASE',
    rpc: 'https://base-rpc.publicnode.com',
    maxRange: 2000,
    explorer: 'https://basescan.org/tx/',
    tokens: [{ symbol: 'USDC', address: '0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913' }],
  },
  {
    id: 'arbitrum',
    name: 'Arbitrum One',
    chainId: 42161,
    rpcEnv: 'RPC_ARBITRUM',
    rpc: 'https://arbitrum-one-rpc.publicnode.com',
    maxRange: 5000,
    explorer: 'https://arbiscan.io/tx/',
    tokens: [
      { symbol: 'USDC', address: '0xaf88d065e77c8cC2239327C5EDb3A432268e5831' },
      { symbol: 'USDT', address: '0xFd086bC7CD5C481DCC9C85ebE478A1C0b69FCbb9' },
    ],
  },
];

export function enabledChains() {
  const wanted = (process.env.ENABLED_CHAINS || 'ethereum,base,arbitrum')
    .split(',')
    .map((s) => s.trim().toLowerCase())
    .filter(Boolean);
  return CHAINS.filter((c) => wanted.includes(c.id)).map((c) => ({
    ...c,
    rpc: process.env[c.rpcEnv] || c.rpc,
  }));
}

// 브라우저에 보낼 때는 RPC 주소를 빼고 보냅니다.
export function publicNetworks() {
  return enabledChains().map(({ id, name, chainId, explorer, tokens }) => ({
    id,
    name,
    chainId,
    explorer,
    tokens,
  }));
}
