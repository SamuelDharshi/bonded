'use client';

import { useCallback, useEffect, useState } from 'react';
import { VAULT_ABI } from '@bonded/seam';
import {
  ARC_CHAIN_ID,
  connect,
  currentAccount,
  currentChainId,
  ensureArc,
  formatUSDC,
  hasWallet,
  parseUSDC,
  provider,
  waitForReceipt,
  walletClient,
} from '../../../lib/bonded/wallet';
import { Addr, Button, Field, Input, Panel, Status, TxLink } from './primitives';
import { PolicyPanel } from './PolicyPanel';

/**
 * The owner's console.
 *
 * Everything here is a write the OWNER makes with their own wallet: deposit,
 * withdraw, authorize an agent, set limits, confirm a hold. Nothing on this page
 * asks the server to act — the server only reads and reports, so a compromised
 * or dishonest backend still could not move funds.
 *
 * The steps are numbered because the order matters and skipping one produces a
 * confusing failure much later. An agent with no published policy gets a 409; an
 * unauthorized agent gets a 403; an authorized agent with no deposit gets a
 * revert at settle time. Better to make the sequence visible than to explain
 * those errors afterwards.
 */

const USDC = (process.env.NEXT_PUBLIC_USDC_ADDRESS ??
  '0x3600000000000000000000000000000000000000') as `0x${string}`;

const ERC20_ABI = [
  {
    type: 'function',
    name: 'approve',
    stateMutability: 'nonpayable',
    inputs: [
      { name: 'spender', type: 'address' },
      { name: 'amount', type: 'uint256' },
    ],
    outputs: [{ type: 'bool' }],
  },
] as const;

interface OwnerState {
  owner: string;
  vault: `0x${string}`;
  funds: { creditedToYou: string; inYourWallet: string; allowanceToVault: string };
  limits: {
    irreversibleAbove: string;
    budgetMax: string;
    spentThisPeriod: string;
    periodStart: string;
  };
  policy: {
    status: 'ok' | 'not-committed' | 'not-published' | 'stale';
    onchainHash: string;
    publishedHash: string | null;
  };
  agents: Array<{
    agent: string;
    authorized: boolean;
    agreesWithChain: boolean;
    authorizedAt: string;
  }>;
  holds: Array<{
    proposalHash: string;
    agent: string;
    valueUSDC: string | null;
    recipient: string | null;
    amountVerifiedAgainstChain: boolean;
    armedTxHash: string | null;
    awaitingYourConfirmation: boolean;
  }>;
  subgraphError: string | null;
}

type Busy = string | null;

export function OwnerDashboard() {
  // Whether a wallet exists is only knowable in the browser, so the first client
  // render has to match what the server produced or React reports a hydration
  // mismatch. This gate keeps both sides identical until after mount, then lets
  // the real state take over.
  const [mounted, setMounted] = useState(false);
  const [account, setAccount] = useState<string | null>(null);
  const [chainId, setChainId] = useState<number | null>(null);
  const [state, setState] = useState<OwnerState | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [busy, setBusy] = useState<Busy>(null);
  const [message, setMessage] = useState<{ kind: 'ok' | 'error' | 'pending'; text: string } | null>(null);

  const [depositAmt, setDepositAmt] = useState('');
  const [withdrawAmt, setWithdrawAmt] = useState('');
  const [agentAddr, setAgentAddr] = useState('');
  const [thresholdAmt, setThresholdAmt] = useState('');
  const [budgetAmt, setBudgetAmt] = useState('');

  const refresh = useCallback(async (addr: string) => {
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
      setLoadError(err instanceof Error ? err.message : 'could not read owner state');
    }
  }, []);

  useEffect(() => setMounted(true), []);

  // Pick up an already-connected wallet without prompting, and follow account
  // or network changes — an owner switching accounts must not keep looking at
  // the previous account's balances.
  useEffect(() => {
    if (!hasWallet()) return;

    void (async () => {
      const [acct, cid] = await Promise.all([currentAccount(), currentChainId()]);
      setAccount(acct);
      setChainId(cid);
      if (acct) void refresh(acct);
    })();

    const onAccounts = (...args: unknown[]) => {
      const accounts = args[0] as string[] | undefined;
      const next = accounts?.[0] ?? null;
      setAccount(next);
      setState(null);
      if (next) void refresh(next);
    };
    const onChain = (...args: unknown[]) => {
      const hex = args[0] as string | undefined;
      setChainId(hex ? Number.parseInt(hex, 16) : null);
    };

    const p = provider();
    p.on?.('accountsChanged', onAccounts);
    p.on?.('chainChanged', onChain);
    return () => {
      p.removeListener?.('accountsChanged', onAccounts);
      p.removeListener?.('chainChanged', onChain);
    };
  }, [refresh]);

  const wrongChain = account !== null && chainId !== null && chainId !== ARC_CHAIN_ID;

  /**
   * Run one wallet write: send, wait, refresh, report.
   *
   * Centralised so every action reports the same way and none of them can
   * silently leave the page showing pre-transaction state.
   */
  const send = useCallback(
    async (label: string, run: () => Promise<`0x${string}`>) => {
      if (!account) return;
      setBusy(label);
      setMessage({ kind: 'pending', text: `${label}: confirm in your wallet…` });
      try {
        const hash = await run();
        setMessage({ kind: 'pending', text: `${label}: sent, waiting for the chain…` });
        const { blockNumber } = await waitForReceipt(hash);
        setMessage({ kind: 'ok', text: `${label} confirmed in block ${blockNumber} · ${hash}` });
        await refresh(account);
      } catch (err) {
        const raw = err instanceof Error ? err.message : String(err);
        // Wallet rejection is a normal outcome, not a failure worth shouting about.
        const text = /User rejected|denied transaction/i.test(raw)
          ? `${label} cancelled in the wallet.`
          : `${label} failed: ${raw.split('\n')[0]}`;
        setMessage({ kind: 'error', text });
      } finally {
        setBusy(null);
      }
    },
    [account, refresh],
  );

  if (!mounted) {
    return (
      <Panel title="Connect a wallet">
        <p className="text-small text-manifest/40 font-mono">checking for a wallet…</p>
      </Panel>
    );
  }

  if (!hasWallet()) {
    return (
      <Panel title="Connect a wallet">
        <p className="text-small text-manifest/60 max-w-xl">
          No browser wallet detected. This page needs one because every action on it is signed
          by you — depositing, authorizing an agent, and confirming a held payment are all
          transactions from your own address. Nothing here is done on your behalf.
        </p>
      </Panel>
    );
  }

  if (!account) {
    return (
      <Panel title="Connect a wallet" step={0}>
        <p className="text-small text-manifest/60 max-w-xl mb-4">
          Your address is your account. There is no signup and no password, and you are never
          asked for a private key — not here and not by the API your agent talks to.
        </p>
        <Button
          tone="primary"
          onClick={() =>
            void (async () => {
              try {
                const addr = await connect();
                setAccount(addr);
                setChainId(await currentChainId());
                void refresh(addr);
              } catch (err) {
                setMessage({
                  kind: 'error',
                  text: err instanceof Error ? err.message : 'could not connect',
                });
              }
            })()
          }
        >
          Connect wallet
        </Button>
        {message && <Status kind={message.kind}>{message.text}</Status>}
      </Panel>
    );
  }

  const credited = state ? BigInt(state.funds.creditedToYou) : 0n;
  const inWallet = state ? BigInt(state.funds.inYourWallet) : 0n;
  const allowance = state ? BigInt(state.funds.allowanceToVault) : 0n;
  const policyOk = state?.policy.status === 'ok';
  const liveAgents = state?.agents.filter((a) => a.authorized) ?? [];
  const pendingHolds = state?.holds.filter((h) => h.awaitingYourConfirmation) ?? [];

  return (
    <div className="space-y-5">
      {/* ── Identity ──────────────────────────────────────────────────────── */}
      <div className="flex flex-wrap items-baseline justify-between gap-3 px-5 py-3 border border-hairline rounded-doc bg-deepwater">
        <div className="text-small">
          <span className="text-manifest/50">connected&nbsp;</span>
          <Addr value={account} />
        </div>
        <div className="text-small font-mono">
          {wrongChain ? (
            <span className="text-stamp">
              wrong network (chain {chainId}) ·{' '}
              <button className="underline" onClick={() => void ensureArc()}>
                switch to Arc
              </button>
            </span>
          ) : (
            <span className="text-seal">Arc testnet · {chainId}</span>
          )}
        </div>
      </div>

      {loadError && (
        <div className="px-5 py-3 border border-stamp/40 rounded-doc bg-stamp/5">
          <p className="text-small text-stamp font-mono">could not read your state: {loadError}</p>
        </div>
      )}

      {state?.subgraphError && (
        <div className="px-5 py-3 border border-hold/40 rounded-doc bg-hold/5">
          <p className="text-small text-hold">
            Agent and hold lists come from the subgraph, which is unavailable: {state.subgraphError}.
            Balances and limits below are read straight from the chain and are unaffected.
          </p>
        </div>
      )}

      {message && (
        <div className="px-5 py-3 border border-hairline rounded-doc bg-harbor">
          <Status kind={message.kind}>{message.text}</Status>
        </div>
      )}

      {/* ── Holds first: this is the only thing that is waiting on a human ── */}
      {pendingHolds.length > 0 && (
        <Panel
          title={`${pendingHolds.length} payment${pendingHolds.length > 1 ? 's' : ''} waiting for you`}
          note="Every premise passed; the amount is what held these. The vault will not release them
                until you confirm, and it only accepts a confirmation sent from your address — not a
                signature from the enforcer, and not from the agent. Confirming releases exactly the
                action that was held and nothing else."
        >
          <div className="space-y-3">
            {pendingHolds.map((h) => (
              <div
                key={h.proposalHash}
                className="border border-hold/40 rounded-control bg-hold/5 px-4 py-3"
              >
                <div className="flex flex-wrap items-baseline justify-between gap-3">
                  <div className="text-small">
                    <span className="font-mono text-manifest">
                      {h.valueUSDC ? `${formatUSDC(h.valueUSDC)} USDC` : 'amount unavailable'}
                    </span>
                    {h.recipient && (
                      <>
                        <span className="text-manifest/50"> to </span>
                        <Addr value={h.recipient} />
                      </>
                    )}
                    <span className="text-manifest/50">, proposed by </span>
                    <Addr value={h.agent} />
                  </div>
                  <Button
                    tone="primary"
                    disabled={busy !== null || wrongChain}
                    onClick={() =>
                      void send('Confirm', () =>
                        walletClient(account as `0x${string}`).writeContract({
                          address: state!.vault,
                          abi: VAULT_ABI,
                          functionName: 'confirmStepUp',
                          args: [h.proposalHash as `0x${string}`],
                          chain: null,
                          account: account as `0x${string}`,
                        }),
                      )
                    }
                  >
                    Confirm this payment
                  </Button>
                </div>
                {h.valueUSDC && !h.amountVerifiedAgainstChain && (
                  <p className="text-small text-stamp mt-2">
                    This amount could not be checked against the action hash the vault recorded, so
                    treat it as unverified. Confirming still releases only what the vault has bound
                    to this proposal — but read the arming transaction before you do.
                  </p>
                )}
                {h.valueUSDC && h.amountVerifiedAgainstChain && (
                  <p className="text-small text-manifest/50 mt-2">
                    Amount and recipient decoded from the arming transaction and matched against the
                    action hash the vault recorded — this is what will move, and nothing else can.
                  </p>
                )}
                <p className="text-small text-manifest/40 font-mono mt-2 break-all">
                  {h.proposalHash}
                  {h.armedTxHash && (
                    <>
                      {' · armed in '}
                      <TxLink hash={h.armedTxHash} />
                    </>
                  )}
                </p>
              </div>
            ))}
          </div>
        </Panel>
      )}

      {/* ── Step 1: policy ────────────────────────────────────────────────── */}
      {state && (
        <PolicyPanel
          account={account as `0x${string}`}
          status={state.policy.status}
          onchainHash={state.policy.onchainHash}
          publishedHash={state.policy.publishedHash}
          wrongChain={wrongChain}
          busy={busy !== null}
          setBusy={(b) => setBusy(b ? 'Policy' : null)}
          onChanged={() => void refresh(account)}
        />
      )}

      {/* ── Step 2: funds ─────────────────────────────────────────────────── */}
      <Panel
        title="Spending money"
        step={2}
        done={credited > 0n}
        note="Deposited USDC is credited to your address. Agents are never credited anything, so no
              agent key can withdraw — withdrawing returns your own funds to your own address, which
              is why it is allowed to exist at all. A plain transfer to the vault is credited to
              nobody and cannot be spent, so deposits go through deposit()."
      >
        {!state ? (
          <p className="text-small text-manifest/40 font-mono">reading…</p>
        ) : (
          <>
            <Field label="credited to you" value={`${formatUSDC(credited)} USDC`} />
            <Field label="in your wallet" value={`${formatUSDC(inWallet)} USDC`} />
            <Field label="approved to the vault" value={`${formatUSDC(allowance)} USDC`} />

            <div className="grid gap-4 sm:grid-cols-2 mt-4">
              <div className="space-y-2">
                <Input
                  label="deposit"
                  value={depositAmt}
                  onChange={setDepositAmt}
                  placeholder="2.5"
                  hint="USDC. Needs an approval first if your allowance is lower."
                />
                <div className="flex gap-2">
                  <Button
                    disabled={busy !== null || wrongChain || depositAmt === ''}
                    onClick={() => {
                      let amount: bigint;
                      try {
                        amount = parseUSDC(depositAmt);
                      } catch (err) {
                        setMessage({ kind: 'error', text: (err as Error).message });
                        return;
                      }
                      void send('Approve', () =>
                        walletClient(account as `0x${string}`).writeContract({
                          address: USDC,
                          abi: ERC20_ABI,
                          functionName: 'approve',
                          args: [state.vault, amount],
                          chain: null,
                          account: account as `0x${string}`,
                        }),
                      );
                    }}
                  >
                    Approve
                  </Button>
                  <Button
                    tone="primary"
                    disabled={busy !== null || wrongChain || depositAmt === ''}
                    onClick={() => {
                      let amount: bigint;
                      try {
                        amount = parseUSDC(depositAmt);
                      } catch (err) {
                        setMessage({ kind: 'error', text: (err as Error).message });
                        return;
                      }
                      if (amount > allowance) {
                        setMessage({
                          kind: 'error',
                          text: `Approve at least ${formatUSDC(amount)} USDC first — the vault can only pull what you allowed.`,
                        });
                        return;
                      }
                      void send('Deposit', () =>
                        walletClient(account as `0x${string}`).writeContract({
                          address: state.vault,
                          abi: VAULT_ABI,
                          functionName: 'deposit',
                          args: [amount],
                          chain: null,
                          account: account as `0x${string}`,
                        }),
                      );
                    }}
                  >
                    Deposit
                  </Button>
                </div>
              </div>

              <div className="space-y-2">
                <Input
                  label="withdraw"
                  value={withdrawAmt}
                  onChange={setWithdrawAmt}
                  placeholder="1.0"
                  hint="Returns your own credited balance to your own address."
                />
                <Button
                  disabled={busy !== null || wrongChain || withdrawAmt === '' || credited === 0n}
                  onClick={() => {
                    let amount: bigint;
                    try {
                      amount = parseUSDC(withdrawAmt);
                    } catch (err) {
                      setMessage({ kind: 'error', text: (err as Error).message });
                      return;
                    }
                    if (amount > credited) {
                      setMessage({
                        kind: 'error',
                        text: `You are credited ${formatUSDC(credited)} USDC — cannot withdraw ${formatUSDC(amount)}.`,
                      });
                      return;
                    }
                    void send('Withdraw', () =>
                      walletClient(account as `0x${string}`).writeContract({
                        address: state.vault,
                        abi: VAULT_ABI,
                        functionName: 'withdraw',
                        args: [amount],
                        chain: null,
                        account: account as `0x${string}`,
                      }),
                    );
                  }}
                >
                  Withdraw
                </Button>
              </div>
            </div>
          </>
        )}
      </Panel>

      {/* ── Step 3: agents ────────────────────────────────────────────────── */}
      <Panel
        title="Your agents"
        step={3}
        done={liveAgents.length > 0}
        note="Authorizing an agent means naming its address. You never hand over its key, and this
              service never sees one — the agent proves each proposal by signing it with the key it
              already has. Revoking takes effect immediately for everything not already settled."
      >
        {!state ? (
          <p className="text-small text-manifest/40 font-mono">reading…</p>
        ) : (
          <>
            {state.agents.length === 0 ? (
              <p className="text-small text-manifest/50">
                No agents yet. Until you authorize one, every proposal is refused with 403 — which is
                the correct answer, not an error to work around.
              </p>
            ) : (
              <div className="space-y-2">
                {state.agents.map((a) => (
                  <div
                    key={a.agent}
                    className="flex flex-wrap items-baseline justify-between gap-3 py-2 border-b border-hairline/50 last:border-0"
                  >
                    <div className="text-small">
                      <Addr value={a.agent} />
                      <span
                        className={`ml-3 font-mono ${a.authorized ? 'text-seal' : 'text-manifest/40'}`}
                      >
                        {a.authorized ? 'authorized' : 'revoked'}
                      </span>
                      {!a.agreesWithChain && (
                        <span className="ml-3 text-hold font-mono" title="the index disagrees with the vault">
                          index out of date
                        </span>
                      )}
                    </div>
                    {a.authorized && (
                      <Button
                        tone="danger"
                        disabled={busy !== null || wrongChain}
                        onClick={() =>
                          void send('Revoke', () =>
                            walletClient(account as `0x${string}`).writeContract({
                              address: state.vault,
                              abi: VAULT_ABI,
                              functionName: 'revokeAgent',
                              args: [a.agent as `0x${string}`],
                              chain: null,
                              account: account as `0x${string}`,
                            }),
                          )
                        }
                      >
                        Revoke
                      </Button>
                    )}
                  </div>
                ))}
              </div>
            )}

            <div className="mt-4 flex flex-wrap items-end gap-2">
              <div className="flex-1 min-w-[18rem]">
                <Input
                  label="authorize an agent"
                  value={agentAddr}
                  onChange={setAgentAddr}
                  placeholder="0x…"
                  hint="The public address your bot signs with."
                />
              </div>
              <Button
                tone="primary"
                disabled={busy !== null || wrongChain || !/^0x[0-9a-fA-F]{40}$/.test(agentAddr.trim())}
                onClick={() =>
                  void send('Authorize', () =>
                    walletClient(account as `0x${string}`).writeContract({
                      address: state.vault,
                      abi: VAULT_ABI,
                      functionName: 'authorizeAgent',
                      args: [agentAddr.trim() as `0x${string}`],
                      chain: null,
                      account: account as `0x${string}`,
                    }),
                  )
                }
              >
                Authorize
              </Button>
            </div>
          </>
        )}
      </Panel>

      {/* ── Step 4: limits ────────────────────────────────────────────────── */}
      <Panel
        title="Your limits"
        step={4}
        note="Enforced by the vault itself, not only by the policy. Above the confirmation threshold
              nothing settles without you; the budget is a rolling ceiling per 7-day period. These
              should agree with your policy artifact — the contract enforces these numbers regardless
              of what the artifact says."
      >
        {!state ? (
          <p className="text-small text-manifest/40 font-mono">reading…</p>
        ) : (
          <>
            <Field
              label="confirmation needed above"
              value={`${formatUSDC(state.limits.irreversibleAbove)} USDC`}
            />
            <Field label="budget ceiling (7d)" value={`${formatUSDC(state.limits.budgetMax)} USDC`} />
            <Field
              label="spent this period"
              value={`${formatUSDC(state.limits.spentThisPeriod)} USDC`}
            />

            <div className="grid gap-4 sm:grid-cols-2 mt-4">
              <Input
                label="new threshold"
                value={thresholdAmt}
                onChange={setThresholdAmt}
                placeholder={formatUSDC(state.limits.irreversibleAbove)}
                hint="USDC above which you must confirm by hand."
              />
              <Input
                label="new budget ceiling"
                value={budgetAmt}
                onChange={setBudgetAmt}
                placeholder={formatUSDC(state.limits.budgetMax)}
                hint="USDC per 7-day period, across all your agents."
              />
            </div>

            <div className="mt-3">
              <Button
                disabled={busy !== null || wrongChain || thresholdAmt === '' || budgetAmt === ''}
                onClick={() => {
                  let threshold: bigint;
                  let budget: bigint;
                  try {
                    threshold = parseUSDC(thresholdAmt);
                    budget = parseUSDC(budgetAmt);
                  } catch (err) {
                    setMessage({ kind: 'error', text: (err as Error).message });
                    return;
                  }
                  if (threshold > budget) {
                    setMessage({
                      kind: 'error',
                      text: 'The threshold is above the budget ceiling, so the budget would stop every payment before the confirmation gate could apply. Lower the threshold or raise the ceiling.',
                    });
                    return;
                  }
                  void send('Set limits', () =>
                    walletClient(account as `0x${string}`).writeContract({
                      address: state.vault,
                      abi: VAULT_ABI,
                      functionName: 'setLimits',
                      args: [threshold, budget],
                      chain: null,
                      account: account as `0x${string}`,
                    }),
                  );
                }}
              >
                Set limits
              </Button>
            </div>
          </>
        )}
      </Panel>

      {/* ── What the agent does next ──────────────────────────────────────── */}
      <Panel
        title="Then your agent works"
        note="Nothing below needs you. Your agent posts what it wants to do plus the facts it claims
              justify it; the enforcer re-derives every one of those facts from The Graph without
              reading the agent's reasoning, and signs only what survives that check."
      >
        <pre className="font-mono text-small text-manifest/70 overflow-x-auto leading-relaxed">
{`POST /api/v1/proposals
{
  "proposal": {
    "id":        "0x…",              // 32 bytes, yours to choose
    "agent":     "${account}",
    "action":    { "kind": "swap", "target": "0x…",
                   "calldata": "0x", "valueUSDC": "500000" },
    "premises":  [{ "premiseId": "tvl", "claimedValue": "…" }],
    "createdAt": ${Math.floor(Date.now() / 1000)}
  },
  "signature": "0x…"   // EIP-191 over proposalDigest(), by the agent key
}`}
        </pre>
        <p className="text-small text-manifest/50 mt-3 max-w-2xl">
          The response carries the verdict, the claimed-versus-re-derived premise table, and on
          CLEARED a signature the vault accepts for that exact transfer. Your agent sends the
          settlement itself and pays its own gas — this service never transacts, so it has no path to
          your funds that does not run through your agent.
        </p>
      </Panel>
    </div>
  );
}

export default OwnerDashboard;
