import {
  createPublicClient,
  createWalletClient,
  defineChain,
  http,
  type Chain,
  type PublicClient,
  type Transport,
  type WalletClient,
} from 'viem';
import { privateKeyToAccount, type PrivateKeyAccount } from 'viem/accounts';

/**
 * Shared chain plumbing for the settlement scripts.
 *
 * Arc testnet pays gas in USDC rather than a separate native token, which is
 * the reason this layer exists at all — an agent with a spending account never
 * has to acquire a second asset just to pay for its own transactions.
 */
export const arcTestnet = defineChain({
  id: Number(process.env.ARC_CHAIN_ID ?? 5042002),
  name: 'Arc Testnet',
  nativeCurrency: { name: 'USDC', symbol: 'USDC', decimals: 18 },
  rpcUrls: { default: { http: [required('ARC_RPC_URL')] } },
  blockExplorers: {
    default: { name: 'Arcscan', url: 'https://testnet.arcscan.app' },
  },
});

export function required(name: string): string {
  const v = process.env[name];
  if (!v) {
    console.error(`\n  ${name} is not set. Copy .env.example to .env and fill it in.\n`);
    process.exit(1);
  }
  return v;
}

export function addr(name: string): `0x${string}` {
  return required(name) as `0x${string}`;
}

/**
 * The enforcer's signing key.
 *
 * TODAY this is a local key read from the environment, and that is a real
 * limitation rather than a design choice: BondedVault.enrolledSigner is the
 * address this key derives, so whoever holds the file can produce a signature
 * the vault accepts. The whole point of the authority layer (packages/authority,
 * cre/stepup-threshold) is that this key should live inside a TEE and never
 * exist in a readable file. That is blocked on Chainlink CRE deploy access.
 *
 * It is named honestly here so nobody reads this and assumes the enclave is
 * already in the path. It is not.
 */
export function localEnforcerAccount(): PrivateKeyAccount {
  const raw = required('CRE_ETH_PRIVATE_KEY');
  const key = (raw.startsWith('0x') ? raw : `0x${raw}`) as `0x${string}`;
  return privateKeyToAccount(key);
}

/**
 * Return type is annotated rather than inferred. viem's inferred client types
 * reference deep internal module paths, which TypeScript then reports as
 * non-portable (TS2742) the moment this function is exported across a package
 * boundary. Naming the types is the fix; widening to `any` would not be.
 */
export function clients(): {
  account: PrivateKeyAccount;
  publicClient: PublicClient<Transport, Chain>;
  walletClient: WalletClient<Transport, Chain, PrivateKeyAccount>;
} {
  const account = localEnforcerAccount();
  const transport = http(required('ARC_RPC_URL'));
  return {
    account,
    publicClient: createPublicClient({ chain: arcTestnet, transport }),
    walletClient: createWalletClient({ account, chain: arcTestnet, transport }),
  };
}

export function explorerTx(hash: string): string {
  return `https://testnet.arcscan.app/tx/${hash}`;
}

export const REGISTRY_ABI = [
  {
    type: 'function',
    name: 'currentPolicyHash',
    stateMutability: 'view',
    inputs: [{ name: 'agent', type: 'address' }],
    outputs: [{ type: 'bytes32' }],
  },
  {
    type: 'function',
    name: 'commitPolicy',
    stateMutability: 'nonpayable',
    inputs: [{ name: 'policyHash', type: 'bytes32' }],
    outputs: [],
  },
  {
    type: 'function',
    name: 'currentVersion',
    stateMutability: 'view',
    inputs: [{ name: 'agent', type: 'address' }],
    outputs: [{ type: 'uint256' }],
  },
] as const;

export const VAULT_ABI = [
  {
    type: 'function',
    name: 'settle',
    stateMutability: 'nonpayable',
    inputs: [
      { name: 'proposalHash', type: 'bytes32' },
      { name: 'policyHash', type: 'bytes32' },
      { name: 'outcome', type: 'uint8' },
      { name: 'reasonCode', type: 'uint16' },
      { name: 'blockChecked', type: 'uint64' },
      { name: 'logRef', type: 'bytes32' },
      { name: 'action', type: 'bytes' },
      { name: 'enforcerSig', type: 'bytes' },
    ],
    outputs: [],
  },
  {
    type: 'function',
    name: 'enrolledSigner',
    stateMutability: 'view',
    inputs: [],
    outputs: [{ type: 'address' }],
  },
  {
    type: 'function',
    name: 'settled',
    stateMutability: 'view',
    inputs: [{ name: 'proposalHash', type: 'bytes32' }],
    outputs: [{ type: 'bool' }],
  },
] as const;

export const ERC20_ABI = [
  {
    type: 'function',
    name: 'balanceOf',
    stateMutability: 'view',
    inputs: [{ name: 'account', type: 'address' }],
    outputs: [{ type: 'uint256' }],
  },
  {
    type: 'function',
    name: 'transfer',
    stateMutability: 'nonpayable',
    inputs: [
      { name: 'to', type: 'address' },
      { name: 'amount', type: 'uint256' },
    ],
    outputs: [{ type: 'bool' }],
  },
] as const;
