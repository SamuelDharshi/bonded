'use client';

import { useState } from 'react';
import type { Policy } from '@bonded/seam';
import { Button, Field, Input, Panel, Status } from './primitives';
import { formatUSDC, walletClient, waitForReceipt } from '../../../lib/bonded/wallet';

/**
 * Step 1: the rules.
 *
 * This panel used to report a status and then tell the owner to run
 * `pnpm --filter @bonded/settlement publish-policy`. That is not a product — it
 * is a status light next to a terminal instruction. The whole sequence now
 * happens here: edit the intent, compile it, commit the hash from your own
 * wallet, publish the artifact.
 *
 * The three stages are deliberately separate and visible, because they are
 * separate facts about trust:
 *
 *   compile  produces the artifact and its hash, and shows you both
 *   commit   puts the hash on-chain FROM YOUR WALLET, so nobody else can
 *            change what you are enforcing
 *   publish  hands the artifact to the enforcer, which accepts it only if it
 *            hashes to what you just committed
 *
 * Collapsing them into one "Save" button would hide the only step that gives
 * the arrangement its teeth.
 */

const REGISTRY = (process.env.NEXT_PUBLIC_BONDED_REGISTRY_ADDRESS ??
  '0xB825225163aEf4353d0110BA63d0d811A17B8205') as `0x${string}`;

const REGISTRY_ABI = [
  {
    type: 'function',
    name: 'commitPolicy',
    stateMutability: 'nonpayable',
    inputs: [{ name: 'policyHash', type: 'bytes32' }],
    outputs: [],
  },
] as const;

const FORBIDDABLE = [
  { id: 'approve_unlimited', label: 'Unlimited approvals' },
  { id: 'delegatecall', label: 'delegatecall' },
  { id: 'selfdestruct', label: 'selfdestruct' },
] as const;

interface Compiled {
  policy: Policy;
  policyHash: `0x${string}`;
  warnings: string[];
}

export function PolicyPanel({
  account,
  status,
  onchainHash,
  publishedHash,
  wrongChain,
  busy,
  setBusy,
  onChanged,
  startOpen = false,
}: {
  account: `0x${string}`;
  status: 'ok' | 'not-committed' | 'not-published' | 'stale';
  onchainHash: string;
  publishedHash: string | null;
  wrongChain: boolean;
  busy: boolean;
  setBusy: (b: boolean) => void;
  onChanged: () => void;
  /** In the wizard the form is the step, so it opens without a click. */
  startOpen?: boolean;
}) {
  const [editing, setEditing] = useState(startOpen);
  const [budget, setBudget] = useState('500');
  const [threshold, setThreshold] = useState('1');
  const [minTvl, setMinTvl] = useState('50000000');
  const [minAge, setMinAge] = useState('30');
  const [forbidden, setForbidden] = useState<string[]>(FORBIDDABLE.map((f) => f.id));

  const [compiled, setCompiled] = useState<Compiled | null>(null);
  const [note, setNote] = useState<{ kind: 'ok' | 'error' | 'pending'; text: string } | null>(null);

  const ok = status === 'ok';
  const committedMatchesCompiled =
    compiled !== null && compiled.policyHash.toLowerCase() === onchainHash.toLowerCase();

  async function compile() {
    setBusy(true);
    setNote({ kind: 'pending', text: 'Compiling…' });
    setCompiled(null);
    try {
      const res = await fetch('/api/v1/policies/compile', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({
          budgetUSDC: budget,
          irreversibleAboveUSDC: threshold,
          minTvlUSD: minTvl,
          minPoolAgeDays: minAge,
          forbiddenActions: forbidden,
        }),
      });
      const body = await res.json();
      if (!res.ok) {
        setNote({ kind: 'error', text: body.detail ? `${body.error} — ${body.detail}` : body.error });
        return;
      }
      setCompiled(body as Compiled);
      setNote({
        kind: 'ok',
        text: 'Compiled. Check the artifact below, then commit its hash from your wallet.',
      });
    } catch (err) {
      setNote({ kind: 'error', text: err instanceof Error ? err.message : 'compile failed' });
    } finally {
      setBusy(false);
    }
  }

  async function commit() {
    if (!compiled) return;
    setBusy(true);
    setNote({ kind: 'pending', text: 'Confirm the commitment in your wallet…' });
    try {
      const hash = await walletClient(account).writeContract({
        address: REGISTRY,
        abi: REGISTRY_ABI,
        functionName: 'commitPolicy',
        args: [compiled.policyHash],
        chain: null,
        account,
      });
      setNote({ kind: 'pending', text: 'Committed, waiting for the chain…' });
      const { blockNumber } = await waitForReceipt(hash);
      setNote({
        kind: 'ok',
        text: `Committed in block ${blockNumber}. Now publish the artifact so the enforcer can read it.`,
      });
      onChanged();
    } catch (err) {
      const raw = err instanceof Error ? err.message : String(err);
      setNote({
        kind: 'error',
        text: /User rejected|denied transaction/i.test(raw)
          ? 'Commitment cancelled in the wallet.'
          : `Commit failed: ${raw.split('\n')[0]}`,
      });
    } finally {
      setBusy(false);
    }
  }

  async function publish() {
    if (!compiled) return;
    setBusy(true);
    setNote({ kind: 'pending', text: 'Publishing the artifact…' });
    try {
      const res = await fetch('/api/v1/policies', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ owner: account, policy: compiled.policy }),
      });
      const body = await res.json();
      if (!res.ok) {
        // The interesting failure: the artifact does not match what is on-chain.
        // Say which is which rather than "409".
        setNote({
          kind: 'error',
          text:
            body.computedHash && body.onchainHash
              ? `Rejected: this artifact hashes to ${body.computedHash.slice(0, 14)}… but your commitment is ${body.onchainHash.slice(0, 14)}…. Commit this artifact first.`
              : (body.detail ?? body.error),
        });
        return;
      }
      setNote({ kind: 'ok', text: 'Published. The enforcer can now read your rules.' });
      setEditing(false);
      onChanged();
    } catch (err) {
      setNote({ kind: 'error', text: err instanceof Error ? err.message : 'publish failed' });
    } finally {
      setBusy(false);
    }
  }

  return (
    <Panel
      title="Your policy"
      step={1}
      done={ok}
      note="The rules your agents are held to. You commit a hash of them on-chain from your own
            wallet, so nobody — this service included — can change what is being enforced. The
            artifact is published separately and is only accepted if it hashes to what you
            committed."
    >
      <Field label="on-chain commitment" value={onchainHash} />
      <Field label="published artifact" value={publishedHash ?? '—'} />
      <Field
        label="status"
        value={
          <span className={ok ? 'text-seal' : status === 'stale' ? 'text-stamp' : 'text-hold'}>
            {status.replace(/-/g, ' ')}
          </span>
        }
      />

      <p className="text-small text-manifest/50 mt-3 max-w-2xl">
        {ok && 'The published artifact matches your commitment, so your rules are live.'}
        {status === 'not-committed' &&
          'No policy committed yet. Until there is one, every proposal from your agents is refused — which is the correct answer, not a fault.'}
        {status === 'not-published' &&
          'A hash is committed but the artifact behind it was never published, so the enforcer cannot read the rules. Compile the same policy below and publish it.'}
        {status === 'stale' &&
          'The published artifact no longer matches your commitment. Nothing is enforced until the current artifact is published.'}
      </p>

      {!editing && (
        <div className="mt-4">
          <Button tone={ok ? 'default' : 'primary'} onClick={() => setEditing(true)} disabled={busy}>
            {status === 'not-committed' ? 'Set up your policy' : 'Change your policy'}
          </Button>
        </div>
      )}

      {editing && (
        <div className="mt-5 border-t border-hairline pt-5">
          <div className="grid gap-4 sm:grid-cols-2">
            <Input
              label="weekly budget"
              value={budget}
              onChange={setBudget}
              placeholder="500"
              hint="USDC your agents may spend per 7-day period, in total."
            />
            <Input
              label="confirm by hand above"
              value={threshold}
              onChange={setThreshold}
              placeholder="1"
              hint="USDC. Anything larger waits for you. 0.5 is valid."
            />
            <Input
              label="minimum pool TVL"
              value={minTvl}
              onChange={setMinTvl}
              placeholder="50000000"
              hint="Whole USD. A premise the enforcer re-derives from The Graph."
            />
            <Input
              label="minimum pool age"
              value={minAge}
              onChange={setMinAge}
              placeholder="30"
              hint="Days. Rejects pools created moments before the proposal."
            />
          </div>

          <fieldset className="mt-4">
            <legend className="text-small text-manifest/50 mb-2">
              always refuse, whatever the premises say
            </legend>
            <div className="flex flex-wrap gap-4">
              {FORBIDDABLE.map((f) => (
                <label key={f.id} className="flex items-center gap-2 text-small text-manifest">
                  <input
                    type="checkbox"
                    checked={forbidden.includes(f.id)}
                    onChange={(e) =>
                      setForbidden((prev) =>
                        e.target.checked ? [...prev, f.id] : prev.filter((x) => x !== f.id),
                      )
                    }
                    className="accent-manifest"
                  />
                  <span className="font-mono">{f.label}</span>
                </label>
              ))}
            </div>
          </fieldset>

          {/* ── The three stages, each a separate decision ── */}
          <div className="mt-5 flex flex-wrap items-center gap-2">
            <Button tone="primary" onClick={() => void compile()} disabled={busy}>
              1 · Compile
            </Button>
            <Button
              onClick={() => void commit()}
              disabled={busy || !compiled || wrongChain || committedMatchesCompiled}
            >
              2 · Commit from your wallet
            </Button>
            <Button
              onClick={() => void publish()}
              disabled={busy || !compiled || !committedMatchesCompiled}
            >
              3 · Publish artifact
            </Button>
            <Button onClick={() => { setEditing(false); setCompiled(null); setNote(null); }} disabled={busy}>
              Cancel
            </Button>
          </div>

          {compiled && (
            <p className="text-small text-manifest/50 mt-3">
              {committedMatchesCompiled
                ? 'This artifact matches your on-chain commitment — publishing is the last step.'
                : 'Commit this hash before publishing. The enforcer refuses an artifact the chain does not vouch for.'}
            </p>
          )}

          {note && <Status kind={note.kind}>{note.text}</Status>}

          {compiled && (
            <div className="mt-4">
              {compiled.warnings.map((w) => (
                <p key={w} className="text-small text-hold mb-2">
                  {w}
                </p>
              ))}
              <Field label="this artifact hashes to" value={compiled.policyHash} />
              <Field
                label="budget / threshold"
                value={`${formatUSDC(compiled.policy.budget.max)} / ${formatUSDC(compiled.policy.irreversible_above)} USDC`}
              />
              <details className="mt-3">
                <summary className="text-small text-manifest/50 cursor-pointer">
                  the exact artifact that gets hashed
                </summary>
                <pre className="font-mono text-small text-manifest/70 mt-2 overflow-x-auto leading-relaxed">
{JSON.stringify(compiled.policy, null, 2)}
                </pre>
              </details>
            </div>
          )}
        </div>
      )}
    </Panel>
  );
}

export default PolicyPanel;
