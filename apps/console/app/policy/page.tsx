import { hashPolicy } from '@bonded/compiler';
import type { Policy } from '@bonded/seam';
import { Shell } from '../../components/shared/Shell';

/**
 * Real compiled policy artifact (packages/compiler/examples/policy.json),
 * hashed server-side with the same hashPolicy() the enforcer uses. No
 * BondedRegistry commitment exists on-chain yet (Arc testnet deployment is
 * pending), so this page states that plainly instead of faking a match —
 * see the empty/failure state pattern in BONDED_PRD.md §6.
 */
const POLICY: Policy = {
  version: 1,
  budget: { asset: 'USDC', period: '7d', max: '500000000' },
  premises: [
    {
      id: 'tvl',
      schema: 'messari-dex-amm',
      field: 'liquidityPool.totalValueLockedUSD',
      op: 'gte',
      value: '50000000000000000000000000',
      tolerance_bps: 200,
    },
    {
      id: 'pool_age',
      schema: 'messari-dex-amm',
      field: 'liquidityPool.createdTimestamp',
      op: 'older_than',
      value: '2592000',
    },
  ],
  forbid: ['approve_unlimited', 'delegatecall', 'selfdestruct'],
  irreversible_above: '100000000',
};

const INTENT_TEXT = `Spend up to 500 USDC every 7 days.

Only swap into pools with at least $50,000,000 in TVL (2% tolerance) that
are at least 30 days old.

Never approve unlimited allowances, delegatecall, or selfdestruct — refuse
these regardless of what the premises say.

Anything over 100 USDC pauses for a human confirmation before it settles.`;

export default function PolicyPage() {
  const policyHash = hashPolicy(POLICY);

  return (
    <Shell>
      <div className="max-w-content mx-auto px-8 py-10">
        <h1 className="text-h1 text-manifest">Policy</h1>
        <p className="text-body text-manifest/60 mt-2 max-w-xl">
          Compiled once, human-confirmed, then immutable until a new version is committed.
        </p>

        <div className="grid grid-cols-2 gap-6 mt-8">
          <div>
            <p className="text-small text-manifest/50 mb-3">Plain-English intent</p>
            <div className="document rounded-doc p-5">
              <pre className="text-body text-ink whitespace-pre-wrap font-sans">{INTENT_TEXT}</pre>
            </div>
          </div>

          <div>
            <p className="text-small text-manifest/50 mb-3">Compiled artifact — v{POLICY.version}</p>
            <div className="document rounded-doc p-5 overflow-x-auto">
              <pre className="text-small text-ink font-mono">{JSON.stringify(POLICY, null, 2)}</pre>
            </div>
          </div>
        </div>

        <div className="mt-6 border border-hairline rounded-control p-4 bg-deepwater flex items-center justify-between">
          <div>
            <p className="text-small text-manifest/50">Computed hash (SHA-256 of canonical JSON)</p>
            <p className="text-small font-mono text-manifest mt-1">{policyHash}</p>
          </div>
          <span className="text-small font-mono border border-hold text-hold px-3 py-1 rounded-control">
            NOT COMMITTED ON-CHAIN
          </span>
        </div>

        <p className="text-small text-manifest/40 mt-3 max-w-xl">
          BondedRegistry is not yet deployed to Arc testnet, so there is no on-chain commitment
          to compare against. Once deployed, this page re-hashes the downloaded artifact
          client-side against the on-chain commitment before rendering — a mismatch means the
          console refuses to render rather than showing stale policy.
        </p>
      </div>
    </Shell>
  );
}
