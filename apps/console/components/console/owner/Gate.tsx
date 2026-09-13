'use client';

import Link from 'next/link';
import type { ReactNode } from 'react';
import { Addr, Button, Panel, Status } from './primitives';
import { useOwner, type OwnerState } from './OwnerProvider';

/**
 * Everything every /app page needs before it can show anything: a wallet, an
 * account, the right network, and loaded state.
 *
 * Each page used to repeat this, or worse, render controls against `state` that
 * might be null. Wrapping the page body in one place means a page only ever sees
 * a connected owner and loaded state, and the connect flow is written once.
 */
export function Gate({
  children,
  requireOnboarded = false,
}: {
  children: (state: OwnerState, account: `0x${string}`) => ReactNode;
  /** Management pages need setup finished; the overview and wizard do not. */
  requireOnboarded?: boolean;
}) {
  const {
    mounted,
    walletPresent,
    account,
    wrongChain,
    chainId,
    state,
    loading,
    loadError,
    message,
    connect,
    switchChain,
    progress,
  } = useOwner();

  if (!mounted) {
    return (
      <Panel title="Your account">
        <p className="text-small text-manifest/40 font-mono">checking for a wallet…</p>
      </Panel>
    );
  }

  if (!walletPresent) {
    return (
      <Panel title="A wallet is needed">
        <p className="text-small text-manifest/60 max-w-xl">
          No browser wallet detected. Every action in here is signed by you — setting your rules,
          depositing, authorizing an agent, releasing a held payment. None of it is done on your
          behalf, which is why there is nothing useful to show without one.
        </p>
        <p className="text-small text-manifest/50 mt-3 max-w-xl">
          Install MetaMask or any EIP-1193 wallet and reload. You will never be asked for a private
          key.
        </p>
      </Panel>
    );
  }

  if (!account) {
    return (
      <Panel title="Connect to begin">
        <p className="text-small text-manifest/60 max-w-xl mb-4">
          Your address is your account — no signup, no password, no private key. Connecting only
          reads your address; nothing is signed until you choose an action.
        </p>
        <Button tone="primary" onClick={() => void connect()}>
          Connect wallet
        </Button>
        {message && <Status kind={message.kind}>{message.text}</Status>}
      </Panel>
    );
  }

  if (wrongChain) {
    return (
      <Panel title="Wrong network">
        <p className="text-small text-manifest/60 max-w-xl mb-4">
          Your wallet is on chain {chainId}. This account lives on Arc testnet, where gas is paid in
          USDC — so an agent with a spending balance never has to hold a second asset just to
          transact.
        </p>
        <Button tone="primary" onClick={() => void switchChain()}>
          Switch to Arc testnet
        </Button>
        {message && <Status kind={message.kind}>{message.text}</Status>}
      </Panel>
    );
  }

  if (loadError) {
    return (
      <Panel title="Could not read your account">
        <p className="text-small text-stamp font-mono">{loadError}</p>
        <p className="text-small text-manifest/50 mt-3 max-w-xl">
          Nothing is shown rather than showing stale or partial figures — this page decides how much
          money an agent may spend.
        </p>
      </Panel>
    );
  }

  if (!state) {
    return (
      <Panel title="Your account">
        <p className="text-small text-manifest/40 font-mono">
          {loading ? 'reading your account…' : 'no data yet'}
        </p>
      </Panel>
    );
  }

  if (requireOnboarded && !progress.done) {
    return (
      <Panel title="Finish setting up first">
        <p className="text-small text-manifest/60 max-w-xl mb-4">
          This page acts on a policy, a balance and an authorized agent. Until all three exist there
          is nothing here to manage — and doing these out of order just produces a failure later.
        </p>
        <Link
          href="/app/start"
          className="inline-block font-mono text-small font-bold text-harbor bg-[#1E7BB8] tracking-wide px-4 py-2.5 rounded-control hover:bg-[#17618F] transition-colors"
        >
          Continue setting up
        </Link>
      </Panel>
    );
  }

  return (
    <>
      <div className="flex flex-wrap items-baseline justify-between gap-3 px-5 py-3 border border-hairline rounded-doc bg-deepwater">
        <div className="text-small">
          <span className="text-manifest/50">connected&nbsp;</span>
          <Addr value={account} />
        </div>
        <span className="text-small font-mono text-seal">Arc testnet · {chainId}</span>
      </div>

      {state.subgraphError && (
        <div className="px-5 py-3 border border-hold/40 rounded-doc bg-hold/5">
          <p className="text-small text-hold">
            Agent and activity lists come from the subgraph, which is unavailable:{' '}
            {state.subgraphError}. Balances and limits are read straight from the chain and are
            unaffected.
          </p>
        </div>
      )}

      {message && (
        <div className="px-5 py-3 border border-hairline rounded-doc bg-harbor">
          <Status kind={message.kind}>{message.text}</Status>
        </div>
      )}

      {children(state, account)}
    </>
  );
}

export default Gate;
