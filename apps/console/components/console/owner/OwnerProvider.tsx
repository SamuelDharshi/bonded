'use client';

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from 'react';
import {
  ARC_CHAIN_ID,
  connect as connectWallet,
  currentAccount,
  currentChainId,
  ensureArc,
  hasWallet,
  provider,
  waitForReceipt,
} from '../../../lib/bonded/wallet';

/**
 * One source of owner state for every page under /app.
 *
 * The dashboard used to be a single component holding all of this, which is why
 * it ended up as one long scroll — there was nowhere else for anything to live.
 * Splitting it into routes needed the state to move somewhere shared first.
 *
 * Deliberately holds no write logic beyond `send`, which every action funnels
 * through so that none of them can leave the page showing pre-transaction
 * numbers. Writes themselves are issued by the pages, against the owner's own
 * wallet.
 */

export interface OwnerState {
  owner: string;
  vault: `0x${string}`;
  usdc: `0x${string}`;
  funds: { creditedToYou: string; inYourWallet: string; allowanceToVault: string };
  limits: {
    irreversibleAbove: string;
    budgetMax: string;
    spentThisPeriod: string;
    periodStart: string;
    periodDurationSeconds: number;
  };
  policy: {
    status: 'ok' | 'not-committed' | 'not-published' | 'stale';
    onchainHash: string;
    publishedHash: string | null;
  };
  agents: Array<{
    agent: string;
    authorized: boolean;
    indexedAsRevoked: boolean;
    agreesWithChain: boolean;
    authorizedAt: string;
    transactionHash: string;
  }>;
  holds: Array<{
    proposalHash: string;
    agent: string;
    valueUSDC: string | null;
    recipient: string | null;
    amountVerifiedAgainstChain: boolean;
    armedTxHash: string | null;
    armed: boolean;
    confirmed: boolean;
    settled: boolean;
    awaitingYourConfirmation: boolean;
  }>;
  subgraphError: string | null;
}

export type Message = { kind: 'ok' | 'error' | 'pending'; text: string } | null;

/** The four things that have to be true before an agent can spend anything. */
export interface Progress {
  policyReady: boolean;
  funded: boolean;
  hasAgent: boolean;
  limitsReviewed: boolean;
  done: boolean;
  /** 0-based index of the first incomplete step, or 4 when finished. */
  nextStep: number;
}

interface OwnerContextValue {
  mounted: boolean;
  walletPresent: boolean;
  account: `0x${string}` | null;
  chainId: number | null;
  wrongChain: boolean;
  state: OwnerState | null;
  loading: boolean;
  loadError: string | null;
  message: Message;
  busy: string | null;
  progress: Progress;
  connect: () => Promise<void>;
  switchChain: () => Promise<void>;
  refresh: () => Promise<void>;
  setMessage: (m: Message) => void;
  send: (label: string, run: () => Promise<`0x${string}`>) => Promise<boolean>;
}

const OwnerContext = createContext<OwnerContextValue | null>(null);

export function useOwner(): OwnerContextValue {
  const ctx = useContext(OwnerContext);
  if (!ctx) throw new Error('useOwner must be used inside <OwnerProvider>');
  return ctx;
}

function computeProgress(state: OwnerState | null): Progress {
  const policyReady = state?.policy.status === 'ok';
  const funded = state ? BigInt(state.funds.creditedToYou) > 0n : false;
  const hasAgent = (state?.agents.filter((a) => a.authorized).length ?? 0) > 0;

  // Limits always have a value, so "reviewed" cannot be read from the chain.
  // Treated as satisfied once the other three are: the defaults are real limits,
  // not a placeholder, and blocking someone on acknowledging them would be
  // ceremony rather than safety.
  const limitsReviewed = policyReady && funded && hasAgent;

  const steps = [policyReady, funded, hasAgent, limitsReviewed];
  const nextStep = steps.findIndex((s) => !s);

  return {
    policyReady,
    funded,
    hasAgent,
    limitsReviewed,
    done: policyReady && funded && hasAgent,
    nextStep: nextStep === -1 ? 4 : nextStep,
  };
}

export function OwnerProvider({ children }: { children: ReactNode }) {
  // Whether a wallet exists is only knowable in the browser, so the first client
  // render has to match the server's or React reports a hydration mismatch.
  const [mounted, setMounted] = useState(false);
  const [account, setAccount] = useState<`0x${string}` | null>(null);
  const [chainId, setChainId] = useState<number | null>(null);
  const [state, setState] = useState<OwnerState | null>(null);
  const [loading, setLoading] = useState(false);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [message, setMessage] = useState<Message>(null);
  const [busy, setBusy] = useState<string | null>(null);

  useEffect(() => setMounted(true), []);

  const load = useCallback(async (addr: string) => {
    setLoading(true);
    setLoadError(null);
    try {
      const res = await fetch(`/api/v1/owners/${addr}`, { cache: 'no-store' });
      const body = await res.json();
      if (!res.ok) {
        setLoadError(body.error ?? `read failed (${res.status})`);
        return;
      }
      setState(body as OwnerState);
    } catch (err) {
      setLoadError(err instanceof Error ? err.message : 'could not read your account');
    } finally {
      setLoading(false);
    }
  }, []);

  const refresh = useCallback(async () => {
    if (account) await load(account);
  }, [account, load]);

  useEffect(() => {
    if (!mounted || !hasWallet()) return;

    void (async () => {
      const [acct, cid] = await Promise.all([currentAccount(), currentChainId()]);
      setAccount(acct);
      setChainId(cid);
      if (acct) void load(acct);
    })();

    // An owner switching accounts must not keep reading the previous account's
    // balances — clear first, then reload.
    const onAccounts = (...args: unknown[]) => {
      const next = (args[0] as string[] | undefined)?.[0] ?? null;
      setAccount(next as `0x${string}` | null);
      setState(null);
      setMessage(null);
      if (next) void load(next);
    };
    const onChain = (...args: unknown[]) => {
      const hex = args[0] as string | undefined;
      setChainId(hex ? Number.parseInt(hex, 16) : null);
      if (account) void load(account);
    };

    const p = provider();
    p.on?.('accountsChanged', onAccounts);
    p.on?.('chainChanged', onChain);
    return () => {
      p.removeListener?.('accountsChanged', onAccounts);
      p.removeListener?.('chainChanged', onChain);
    };
    // `account` is intentionally absent: re-subscribing on every account change
    // would detach the very listener that reported it.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [mounted, load]);

  const connect = useCallback(async () => {
    try {
      const addr = await connectWallet();
      setAccount(addr);
      setChainId(await currentChainId());
      await load(addr);
    } catch (err) {
      setMessage({ kind: 'error', text: err instanceof Error ? err.message : 'could not connect' });
    }
  }, [load]);

  const switchChain = useCallback(async () => {
    try {
      await ensureArc();
      setChainId(await currentChainId());
    } catch (err) {
      setMessage({
        kind: 'error',
        text: err instanceof Error ? err.message : 'could not switch network',
      });
    }
  }, []);

  const send = useCallback(
    async (label: string, run: () => Promise<`0x${string}`>): Promise<boolean> => {
      if (!account) return false;
      setBusy(label);
      setMessage({ kind: 'pending', text: `${label}: confirm in your wallet…` });
      try {
        const hash = await run();
        setMessage({ kind: 'pending', text: `${label}: sent, waiting for the chain…` });
        const { blockNumber } = await waitForReceipt(hash);
        setMessage({ kind: 'ok', text: `${label} confirmed in block ${blockNumber}.` });
        await load(account);
        return true;
      } catch (err) {
        const raw = err instanceof Error ? err.message : String(err);
        // A wallet rejection is a normal outcome, not a fault to shout about.
        setMessage({
          kind: 'error',
          text: /User rejected|denied transaction/i.test(raw)
            ? `${label} cancelled in your wallet.`
            : `${label} failed: ${raw.split('\n')[0]}`,
        });
        return false;
      } finally {
        setBusy(null);
      }
    },
    [account, load],
  );

  const value = useMemo<OwnerContextValue>(
    () => ({
      mounted,
      walletPresent: mounted && hasWallet(),
      account,
      chainId,
      wrongChain: account !== null && chainId !== null && chainId !== ARC_CHAIN_ID,
      state,
      loading,
      loadError,
      message,
      busy,
      progress: computeProgress(state),
      connect,
      switchChain,
      refresh,
      setMessage,
      send,
    }),
    [mounted, account, chainId, state, loading, loadError, message, busy, connect, switchChain, refresh, send],
  );

  return <OwnerContext.Provider value={value}>{children}</OwnerContext.Provider>;
}

export default OwnerProvider;
