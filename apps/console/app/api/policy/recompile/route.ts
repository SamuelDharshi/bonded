import { canonicalJson, compilePolicy, hashPolicy } from '@bonded/compiler';
import type { PolicyIntent } from '@bonded/compiler';
import { buildQuery } from '@bonded/standardized';
import type { MessariDexAmmField } from '@bonded/standardized';

/**
 * Recompile the policy from its intent, one real step at a time.
 *
 * BONDED_PRD.md §5.6 asks for "real sequenced steps: parse -> resolve
 * standardized schema -> canonicalise -> hash -> commit on Arc. Each step
 * shows its real artifact." Every step below does actual work and returns
 * the actual artifact it produced — there are no sleeps, no scripted
 * progress, and no step that reports success without having computed
 * something.
 *
 * Steps stream as NDJSON so the client shows each one as it genuinely
 * completes. The first four are near-instant (they are pure computation)
 * and the last is a real RPC round-trip, so the pacing you see is the
 * pacing the work actually has. Padding it out with artificial delay would
 * make the loader a better animation and a worse instrument.
 *
 * ONE DELIBERATE DEVIATION from the PRD's wording: the final step compares
 * against the on-chain commitment rather than writing one. Committing is a
 * state-changing, gas-spending transaction signed by the enrolled key; a
 * button on a page anyone can load must not be able to fire it. The commit
 * path exists as an explicit CLI step
 * (`pnpm --filter @bonded/settlement commit-policy`), and this step tells
 * you whether running it is necessary.
 */
export const dynamic = 'force-dynamic';

/**
 * The human-units intent. Verified to compile to exactly the artifact whose
 * hash is committed on-chain — if this drifts, step 5 reports a mismatch
 * rather than the page quietly showing a different policy than the one the
 * enforcer is bound by.
 */
const INTENT: PolicyIntent = {
  budgetUSDC: '500',
  budgetPeriod: '7d',
  premises: [
    {
      id: 'tvl',
      schema: 'messari-dex-amm',
      field: 'liquidityPool.totalValueLockedUSD',
      op: 'gte',
      value: '50000000',
      toleranceBps: 200,
    },
    {
      id: 'pool_age',
      schema: 'messari-dex-amm',
      field: 'liquidityPool.createdTimestamp',
      op: 'older_than',
      value: '2592000',
    },
  ],
  forbiddenActions: ['approve_unlimited', 'delegatecall', 'selfdestruct'],
  irreversibleAboveUSDC: '1',
};

/**
 * Registry address and committed owner are constants, matching
 * app/policy/page.tsx rather than reading ENFORCER_SIGNER_ADDRESS from the
 * environment: the console's .env.local does not carry the signer address
 * (it has no reason to hold anything signer-related), and a fresh clone
 * would silently fail this step on a missing variable it was never told to
 * set. The RPC URL genuinely is environment-specific, so that one is read.
 */
const REGISTRY = process.env.BONDED_REGISTRY_ADDRESS ?? '0xB825225163aEf4353d0110BA63d0d811A17B8205';
const AGENT = '0xac13a62FC7E50d08945ba2e79B5Eaa190d8D7D9a';
const RPC = process.env.ARC_RPC_URL;
/** currentPolicyHash(address) — selector verified with `cast sig`. */
const CURRENT_POLICY_HASH_SELECTOR = '0x92fd5c7d';

interface Step {
  n: number;
  name: string;
  ok: boolean;
  detail: string;
  artifact: string | null;
}

async function readOnchainPolicyHash(): Promise<`0x${string}`> {
  if (!RPC) throw new Error('ARC_RPC_URL not set');
  const data = `${CURRENT_POLICY_HASH_SELECTOR}${AGENT.slice(2).toLowerCase().padStart(64, '0')}`;
  const res = await fetch(RPC, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    cache: 'no-store',
    body: JSON.stringify({
      jsonrpc: '2.0',
      id: 1,
      method: 'eth_call',
      params: [{ to: REGISTRY, data }, 'latest'],
    }),
  });
  const json = (await res.json()) as { result?: string; error?: { message?: string } };
  if (json.error) throw new Error(json.error.message ?? 'eth_call failed');
  if (!json.result || json.result === '0x') throw new Error('registry returned empty data');
  return json.result as `0x${string}`;
}

export async function POST(): Promise<Response> {
  const encoder = new TextEncoder();

  const stream = new ReadableStream({
    async start(controller) {
      const send = (step: Step) => {
        controller.enqueue(encoder.encode(JSON.stringify(step) + '\n'));
      };

      try {
        // ── 1. Parse the intent ───────────────────────────────────────────
        // Real check: the intent must carry every field compilePolicy reads.
        // A missing budget or an empty premise list is a compile error, not
        // a silently smaller policy.
        const missing: string[] = [];
        if (!INTENT.budgetUSDC) missing.push('budgetUSDC');
        if (!INTENT.budgetPeriod) missing.push('budgetPeriod');
        if (!INTENT.irreversibleAboveUSDC) missing.push('irreversibleAboveUSDC');
        if (INTENT.premises.length === 0) missing.push('premises');

        if (missing.length > 0) {
          send({
            n: 1,
            name: 'Parse intent',
            ok: false,
            detail: `intent is missing: ${missing.join(', ')}`,
            artifact: null,
          });
          controller.close();
          return;
        }

        send({
          n: 1,
          name: 'Parse intent',
          ok: true,
          detail: `${INTENT.premises.length} premises, ${INTENT.forbiddenActions.length} forbidden actions, budget ${INTENT.budgetUSDC} USDC / ${INTENT.budgetPeriod}`,
          artifact: JSON.stringify(INTENT, null, 2),
        });

        // ── 2. Resolve the standardized schema ────────────────────────────
        // Real check: every premise's field must be one @bonded/standardized
        // can actually build a query for. buildQuery() throws on an unknown
        // field, so this exercises the shipped resolver rather than a
        // duplicated list of field names that could drift from it.
        const resolved: string[] = [];
        for (const p of INTENT.premises) {
          if (p.schema !== 'messari-dex-amm') {
            send({
              n: 2,
              name: 'Resolve standardized schema',
              ok: false,
              detail: `premise "${p.id}" uses unknown schema "${p.schema}"`,
              artifact: null,
            });
            controller.close();
            return;
          }
          try {
            buildQuery(p.field as MessariDexAmmField);
            resolved.push(`${p.id} -> ${p.field}`);
          } catch {
            send({
              n: 2,
              name: 'Resolve standardized schema',
              ok: false,
              detail: `premise "${p.id}": field "${p.field}" is not resolvable in messari-dex-amm`,
              artifact: null,
            });
            controller.close();
            return;
          }
        }

        send({
          n: 2,
          name: 'Resolve standardized schema',
          ok: true,
          detail: `all ${resolved.length} premises resolve against messari-dex-amm`,
          artifact: resolved.join('\n'),
        });

        // ── 3. Compile and canonicalise ───────────────────────────────────
        // The fixed-point conversions happen here: 500 USDC -> 500000000
        // (6dp), $50,000,000 -> 50000000000000000000000000 (18dp). Keys are
        // sorted so the same intent always produces byte-identical JSON.
        const policy = compilePolicy(INTENT);
        const canonical = canonicalJson(policy);

        send({
          n: 3,
          name: 'Compile and canonicalise',
          ok: true,
          detail: `${canonical.length} bytes of canonical JSON — budget ${INTENT.budgetUSDC} USDC became ${policy.budget.max} (6dp)`,
          artifact: canonical,
        });

        // ── 4. Hash ───────────────────────────────────────────────────────
        const hash = hashPolicy(policy);
        send({
          n: 4,
          name: 'Hash',
          ok: true,
          detail: 'SHA-256 over the canonical JSON above',
          artifact: hash,
        });

        // ── 5. Compare against the on-chain commitment ────────────────────
        // The only step that touches the network. A mismatch means the
        // artifact drifted from what the enforcer is actually bound by, and
        // every proposal would refuse with STALE_POLICY until recommitted.
        try {
          const onchain = await readOnchainPolicyHash();
          const matches = onchain.toLowerCase() === hash.toLowerCase();
          send({
            n: 5,
            name: 'Compare against on-chain commitment',
            ok: matches,
            detail: matches
              ? 'recomputed hash matches BondedRegistry — nothing to commit'
              : 'recomputed hash does NOT match the on-chain commitment; run `pnpm --filter @bonded/settlement commit-policy`',
            artifact: `recomputed: ${hash}\non-chain:   ${onchain}`,
          });
        } catch (err) {
          send({
            n: 5,
            name: 'Compare against on-chain commitment',
            ok: false,
            detail: `could not read BondedRegistry: ${err instanceof Error ? err.message : String(err)}`,
            artifact: null,
          });
        }
      } catch (err) {
        send({
          n: 0,
          name: 'Recompile',
          ok: false,
          detail: err instanceof Error ? err.message : String(err),
          artifact: null,
        });
      } finally {
        controller.close();
      }
    },
  });

  return new Response(stream, {
    headers: {
      'content-type': 'application/x-ndjson; charset=utf-8',
      'cache-control': 'no-store',
    },
  });
}
