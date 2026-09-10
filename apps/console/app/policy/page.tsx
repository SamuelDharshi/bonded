import { hashPolicy } from '@bonded/compiler';
import type { Policy } from '@bonded/seam';
import { Shell } from '../../components/shared/Shell';

export const dynamic = 'force-dynamic';

/**
 * Real compiled policy artifact (packages/compiler/examples/policy.json),
 * hashed server-side with the same hashPolicy() the enforcer uses, then
 * checked against BondedRegistry.currentPolicyHash() on Arc testnet via a
 * live eth_call -- real chain read, not a fixture, same discipline as
 * /live and /log.
 */
const REGISTRY_ADDRESS = '0xB825225163aEf4353d0110BA63d0d811A17B8205';
const COMMITTED_OWNER = '0xac13a62FC7E50d08945ba2e79B5Eaa190d8D7D9a'; // the deployer address this example was committed under

async function fetchOnchainPolicyHash(): Promise<`0x${string}` | null> {
  const rpcUrl = process.env.ARC_RPC_URL;
  if (!rpcUrl) return null;

  // currentPolicyHash(address) selector, verified via `cast sig` against
  // the real ABI -- not assumed.
  const paddedAddress = COMMITTED_OWNER.slice(2).toLowerCase().padStart(64, '0');
  const data = `0x92fd5c7d${paddedAddress}`;

  try {
    const res = await fetch(rpcUrl, {
      method: 'POST',
      cache: 'no-store',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({
        jsonrpc: '2.0',
        id: 1,
        method: 'eth_call',
        params: [{ to: REGISTRY_ADDRESS, data }, 'latest'],
      }),
    });
    const json = await res.json();
    return json.result ?? null;
  } catch {
    return null;
  }
}
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

export default async function PolicyPage() {
  const policyHash = hashPolicy(POLICY);
  const onchainHash = await fetchOnchainPolicyHash();
  const matches = onchainHash !== null && onchainHash.toLowerCase() === policyHash.toLowerCase();

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
          {matches ? (
            <span className="text-small font-mono border border-seal text-seal px-3 py-1 rounded-control">
              MATCHES ON-CHAIN
            </span>
          ) : (
            <span className="text-small font-mono border border-hold text-hold px-3 py-1 rounded-control">
              {onchainHash ? 'HASH MISMATCH' : 'RPC UNREACHABLE'}
            </span>
          )}
        </div>

        {matches ? (
          <p className="text-small text-manifest/40 mt-3 max-w-xl">
            Committed on-chain to <code className="font-mono">BondedRegistry</code> at{' '}
            <a
              href={`https://testnet.arcscan.app/address/${REGISTRY_ADDRESS}`}
              target="_blank"
              rel="noreferrer"
              className="text-seal hover:underline"
            >
              {REGISTRY_ADDRESS}
            </a>
            . This page re-hashes the artifact above server-side and reads{' '}
            <code className="font-mono">currentPolicyHash()</code> live from Arc testnet on every
            load — a mismatch would render as a refusal, not a stale display.
          </p>
        ) : (
          <p className="text-small text-manifest/40 mt-3 max-w-xl">
            Could not confirm the on-chain commitment right now (RPC unreachable or hash
            differs) — refusing to claim a match rather than showing a stale one.
          </p>
        )}
      </div>
    </Shell>
  );
}
