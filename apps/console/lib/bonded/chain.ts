import { createPublicClient, defineChain, http, type Address } from 'viem';
import { privateKeyToAccount, type PrivateKeyAccount } from 'viem/accounts';
import { readFileSync } from 'node:fs';
import path from 'node:path';

/**
 * Server-side chain access for the API routes.
 *
 * Read-only by default. The enforcer signing key is reached only through
 * `enforcerAccount()`, which is used to sign verdicts — never to send
 * transactions. The service deliberately does not settle on an agent's behalf:
 * the agent sends its own settlement, pays its own gas, and the signature it
 * receives authorizes exactly one action and nothing else.
 */

export const arcTestnet = defineChain({
  id: Number(process.env.ARC_CHAIN_ID ?? 5042002),
  name: 'Arc Testnet',
  nativeCurrency: { name: 'USDC', symbol: 'USDC', decimals: 18 },
  rpcUrls: { default: { http: [process.env.ARC_RPC_URL ?? ''] } },
  blockExplorers: { default: { name: 'Arcscan', url: 'https://testnet.arcscan.app' } },
});

export const VAULT = (process.env.BONDED_VAULT_ADDRESS ??
  '0x027C61c1418157b112B82F30894F8aC1F074AF85') as Address;

export const REGISTRY = (process.env.BONDED_REGISTRY_ADDRESS ??
  '0xB825225163aEf4353d0110BA63d0d811A17B8205') as Address;

export const USDC = (process.env.USDC_ADDRESS ??
  '0x3600000000000000000000000000000000000000') as Address;

export const ZERO_ADDRESS = '0x0000000000000000000000000000000000000000' as const;

export function publicClient() {
  return createPublicClient({ chain: arcTestnet, transport: http(process.env.ARC_RPC_URL) });
}

export const REGISTRY_ABI = [
  {
    type: 'function',
    name: 'currentPolicyHash',
    stateMutability: 'view',
    inputs: [{ name: 'owner', type: 'address' }],
    outputs: [{ type: 'bytes32' }],
  },
  {
    type: 'function',
    name: 'policyVersion',
    stateMutability: 'view',
    inputs: [{ name: 'owner', type: 'address' }],
    outputs: [{ type: 'uint256' }],
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
] as const;

/**
 * Read the enforcer signing key.
 *
 * Looked up in the environment first, then in the repo-root .env, so a local
 * checkout does not need the key duplicated into apps/console/.env.local. The
 * value is never logged, returned, or included in any response — only the
 * derived address is, and only where a caller needs to know which signer to
 * expect.
 */
export function enforcerAccount(): PrivateKeyAccount {
  let raw = process.env.ENFORCER_SIGNER_PRIVATE_KEY;

  if (!raw) {
    try {
      const envPath = path.join(process.cwd(), '..', '..', '.env');
      const line = readFileSync(envPath, 'utf8')
        .split(/\r?\n/)
        .find((l) => l.startsWith('ENFORCER_SIGNER_PRIVATE_KEY='));
      raw = line?.slice('ENFORCER_SIGNER_PRIVATE_KEY='.length).trim();
    } catch {
      // An unreadable .env is the same outcome as a missing key.
    }
  }

  if (!raw) {
    throw new Error('ENFORCER_SIGNER_PRIVATE_KEY not found in the environment or the repo-root .env');
  }

  const hex = (raw.startsWith('0x') ? raw : `0x${raw}`) as `0x${string}`;
  return privateKeyToAccount(hex);
}

export function explorerTx(hash: string): string {
  return `https://testnet.arcscan.app/tx/${hash}`;
}
