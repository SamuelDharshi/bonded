'use client';

import {
  createWalletClient,
  custom,
  defineChain,
  getAddress,
  type Address,
  type WalletClient,
} from 'viem';

/**
 * Browser wallet access over injected EIP-1193.
 *
 * No wagmi, no WalletConnect, no connector library. The owner actions here are
 * a handful of contract calls against one testnet chain, and viem already ships
 * everything needed for that. Adding a connector stack would mean a
 * WalletConnect project id and a large client bundle to gain reconnect UX this
 * page does not need.
 *
 * What the browser never gets: the enforcer signing key, the Graph API key, or
 * an RPC URL. Reads come from /api/v1/owners/:owner; writes go from the owner's
 * own wallet straight to the contracts. The page is not a privileged client.
 */

export const ARC_CHAIN_ID = Number(process.env.NEXT_PUBLIC_ARC_CHAIN_ID ?? 5042002);

export const arcTestnet = defineChain({
  id: ARC_CHAIN_ID,
  name: 'Arc Testnet',
  // Arc pays gas in USDC rather than a separate native token, which is why an
  // agent with a spending account never has to hold a second asset just to
  // transact.
  nativeCurrency: { name: 'USDC', symbol: 'USDC', decimals: 18 },
  rpcUrls: { default: { http: [process.env.NEXT_PUBLIC_ARC_RPC_URL ?? ''] } },
  blockExplorers: { default: { name: 'Arcscan', url: 'https://testnet.arcscan.app' } },
});

interface Eip1193Provider {
  request(args: { method: string; params?: unknown[] }): Promise<unknown>;
  on?(event: string, handler: (...args: unknown[]) => void): void;
  removeListener?(event: string, handler: (...args: unknown[]) => void): void;
}

declare global {
  interface Window {
    ethereum?: Eip1193Provider;
  }
}

export function hasWallet(): boolean {
  return typeof window !== 'undefined' && Boolean(window.ethereum);
}

export function provider(): Eip1193Provider {
  if (!hasWallet()) {
    throw new Error('No browser wallet found. Install MetaMask or another EIP-1193 wallet.');
  }
  return window.ethereum!;
}

export async function connect(): Promise<Address> {
  const accounts = (await provider().request({ method: 'eth_requestAccounts' })) as string[];
  const first = accounts[0];
  if (!first) throw new Error('Wallet returned no accounts');
  return getAddress(first);
}

/** Accounts already granted, without prompting. */
export async function currentAccount(): Promise<Address | null> {
  if (!hasWallet()) return null;
  try {
    const accounts = (await provider().request({ method: 'eth_accounts' })) as string[];
    const first = accounts[0];
    return first ? getAddress(first) : null;
  } catch {
    return null;
  }
}

export async function currentChainId(): Promise<number | null> {
  if (!hasWallet()) return null;
  try {
    const hex = (await provider().request({ method: 'eth_chainId' })) as string;
    return Number.parseInt(hex, 16);
  } catch {
    return null;
  }
}

/**
 * Switch the wallet to Arc, adding the network if it does not know it.
 *
 * Arc is not in any wallet's default list, so the add path is the normal one
 * rather than an edge case. 4902 is "unrecognized chain".
 */
export async function ensureArc(): Promise<void> {
  const hexId = `0x${ARC_CHAIN_ID.toString(16)}`;
  try {
    await provider().request({
      method: 'wallet_switchEthereumChain',
      params: [{ chainId: hexId }],
    });
  } catch (err) {
    const code = (err as { code?: number } | null)?.code;
    if (code !== 4902) throw err;

    const rpc = process.env.NEXT_PUBLIC_ARC_RPC_URL;
    if (!rpc) {
      throw new Error(
        'This wallet does not know Arc testnet, and NEXT_PUBLIC_ARC_RPC_URL is not set, ' +
          'so it cannot be added automatically. Add the network manually.',
      );
    }

    await provider().request({
      method: 'wallet_addEthereumChain',
      params: [
        {
          chainId: hexId,
          chainName: 'Arc Testnet',
          nativeCurrency: { name: 'USDC', symbol: 'USDC', decimals: 18 },
          rpcUrls: [rpc],
          blockExplorerUrls: ['https://testnet.arcscan.app'],
        },
      ],
    });
  }
}

export function walletClient(account: Address): WalletClient {
  return createWalletClient({
    account,
    chain: arcTestnet,
    transport: custom(provider()),
  });
}

export function explorerTx(hash: string): string {
  return `https://testnet.arcscan.app/tx/${hash}`;
}

export function explorerAddress(addr: string): string {
  return `https://testnet.arcscan.app/address/${addr}`;
}

/**
 * Wait for a receipt through the wallet's own provider.
 *
 * Polling eth_getTransactionReceipt rather than using a public client, because
 * the browser has no RPC URL of its own — the wallet is the only transport it
 * has. Resolves on success, throws on revert or timeout.
 */
export async function waitForReceipt(hash: string, timeoutMs = 120_000): Promise<{ blockNumber: number }> {
  const started = Date.now();

  while (Date.now() - started < timeoutMs) {
    const receipt = (await provider().request({
      method: 'eth_getTransactionReceipt',
      params: [hash],
    })) as { status?: string; blockNumber?: string } | null;

    if (receipt?.status) {
      if (receipt.status === '0x0') throw new Error(`Transaction reverted: ${hash}`);
      return { blockNumber: Number.parseInt(receipt.blockNumber ?? '0x0', 16) };
    }
    await new Promise((r) => setTimeout(r, 1500));
  }

  throw new Error(`Timed out waiting for ${hash}. It may still land — check the explorer.`);
}

/** 6-decimal USDC as a display string. BigInt only; never parseFloat. */
export function formatUSDC(raw: string | bigint): string {
  const v = typeof raw === 'bigint' ? raw : BigInt(raw);
  const whole = v / 1_000_000n;
  const frac = (v % 1_000_000n).toString().padStart(6, '0').replace(/0+$/, '');
  return frac ? `${whole}.${frac}` : whole.toString();
}

/**
 * Parse a typed USDC amount to 6-decimal units.
 *
 * Deliberately string arithmetic. parseFloat on "0.1" then multiplying by 1e6
 * is the classic way to lose a unit at the bottom, and this value ends up in a
 * signed transaction.
 */
export function parseUSDC(input: string): bigint {
  const trimmed = input.trim();
  if (!/^\d*(\.\d*)?$/.test(trimmed) || trimmed === '' || trimmed === '.') {
    throw new Error(`Not a valid amount: ${input}`);
  }
  const [whole = '0', frac = ''] = trimmed.split('.');
  if (frac.length > 6) throw new Error('USDC has at most 6 decimal places');
  return BigInt(whole || '0') * 1_000_000n + BigInt((frac + '000000').slice(0, 6) || '0');
}
