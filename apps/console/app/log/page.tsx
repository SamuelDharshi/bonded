import { Shell } from '../../components/shared/Shell';
import { ScrollText } from 'lucide-react';

/**
 * The decision log is backed by our own subgraph indexing BondedRegistry
 * and BondedVault events (see subgraph/schema.graphql) — not a database.
 * Live query against the real Gateway URL in .env. bonded-subgraph is
 * deployed and confirmed syncing against the real Arc testnet contracts
 * (see FEEDBACK/THEGRAPH.md) -- this is real chain data, not a fixture.
 */
export const dynamic = 'force-dynamic';

interface PolicyEntity {
  id: string;
  owner: string;
  policyHash: string;
  version: string;
  committedAt: string;
  transactionHash: string;
}

interface VerdictEntity {
  id: string;
  agent: string;
  outcome: number;
  reasonCode: number;
  valueUSDC: string;
  blockNumber: string;
  transactionHash: string;
}

interface LogData {
  policies: PolicyEntity[];
  verdictRecords: VerdictEntity[];
  blockNumber: string | null;
  error: string | null;
}

async function loadLog(): Promise<LogData> {
  const url = process.env.GRAPH_GATEWAY_URL;
  if (!url) {
    return { policies: [], verdictRecords: [], blockNumber: null, error: 'GRAPH_GATEWAY_URL not set' };
  }

  try {
    const res = await fetch(url, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      cache: 'no-store',
      body: JSON.stringify({
        query: `{
          _meta { block { number } }
          policies(first: 20, orderBy: committedAt, orderDirection: desc) {
            id owner policyHash version committedAt transactionHash
          }
          verdictRecords(first: 20, orderBy: timestamp, orderDirection: desc) {
            id agent outcome reasonCode valueUSDC blockNumber transactionHash
          }
        }`,
      }),
    });

    const json = await res.json();
    if (json.errors) {
      return { policies: [], verdictRecords: [], blockNumber: null, error: json.errors[0]?.message ?? 'unknown error' };
    }

    return {
      policies: json.data.policies,
      verdictRecords: json.data.verdictRecords,
      blockNumber: json.data._meta.block.number,
      error: null,
    };
  } catch (err) {
    return { policies: [], verdictRecords: [], blockNumber: null, error: err instanceof Error ? err.message : String(err) };
  }
}

// Verified against docs.arc.io/arc/references/connect-to-arc and confirmed
// live by loading our own deploy transaction there (200, real page).
const EXPLORER_TX = (hash: string) => `https://testnet.arcscan.app/tx/${hash}`;

/* The same verdict vocabulary /live uses. Kept identical on purpose: a
   reader who has just watched a refusal stream past on /live should meet the
   same words and the same colours when they come here to find its receipt,
   not a second encoding of the same enum. */
const OUTCOME_NAMES = ['CLEARED', 'REFUSED', 'HELD_FOR_STEPUP'] as const;

const OUTCOME_STYLES: Record<number, string> = {
  0: 'text-seal border-seal',
  1: 'text-stamp border-stamp',
  2: 'text-hold border-hold',
};

const REASON_NAMES: Record<number, string> = {
  0: 'OK',
  1: 'PREMISE_MISMATCH',
  2: 'PREMISE_UNRESOLVABLE',
  3: 'POLICY_FORBIDDEN_ACTION',
  4: 'BUDGET_EXCEEDED',
  5: 'STALE_POLICY',
  6: 'IRREVERSIBLE_UNCONFIRMED',
  7: 'ATTESTATION_MISSING',
};

/** USDC is 6-decimal. BigInt, never parseFloat — PRD §12.6. */
function formatUSDC(raw: string): string {
  const v = BigInt(raw);
  const whole = v / 1_000_000n;
  const frac = (v % 1_000_000n).toString().padStart(6, '0').slice(0, 2);
  return `${whole.toLocaleString('en-US')}.${frac}`;
}

export default async function LogPage() {
  const data = await loadLog();

  return (
    <Shell>
      <div className="max-w-content mx-auto px-8 py-10">
        <h1 className="text-h1 text-manifest">Decision log</h1>
        <p className="text-body text-manifest/60 mt-2 max-w-xl">
          Every policy commitment and settled verdict, indexed by our own subgraph — not a
          database.
          {data.blockNumber && (
            <span className="text-manifest/40"> Synced to block {data.blockNumber}.</span>
          )}
        </p>

        {data.error && (
          <div className="mt-8 border border-hold/40 rounded-control p-4 bg-hold/10">
            <p className="text-small text-hold">Subgraph query error: {data.error}</p>
          </div>
        )}

        {!data.error && data.policies.length === 0 && data.verdictRecords.length === 0 && (
          <div className="mt-16 flex flex-col items-center text-center max-w-md mx-auto">
            <ScrollText size={32} strokeWidth={1.5} className="text-manifest/30" />
            <p className="text-body text-manifest/70 mt-4">
              The subgraph is live and synced, but nothing has been committed on-chain yet.
            </p>
          </div>
        )}

        {data.policies.length > 0 && (
          <div className="mt-8">
            <p className="text-small text-manifest/50 mb-3">Policy commitments</p>
            <div className="space-y-3">
              {data.policies.map((p) => (
                <div key={p.id} className="document rounded-doc p-4">
                  <div className="flex items-center justify-between">
                    <p className="text-small font-mono text-ink">{p.owner}</p>
                    <span className="text-small font-mono text-ink/50">v{p.version}</span>
                  </div>
                  <p className="text-small font-mono text-ink/60 mt-1 break-all">{p.policyHash}</p>
                  <a
                    href={EXPLORER_TX(p.transactionHash)}
                    target="_blank"
                    rel="noreferrer"
                    className="text-small font-mono text-seal mt-2 inline-block hover:underline"
                  >
                    {p.transactionHash.slice(0, 18)}... ↗
                  </a>
                </div>
              ))}
            </div>
          </div>
        )}

        {data.verdictRecords.length === 0 ? (
          <div className="mt-8 border border-hairline rounded-control p-4 bg-deepwater">
            {/* Reachable again only if the subgraph is re-deployed or resyncs
                from scratch. It is no longer true that settlement has never
                run — two verdicts are settled on Arc — so this state now means
                "indexing hasn't caught up", not "this was never built". */}
            <p className="text-small text-manifest/50">
              No verdicts indexed yet. Settled verdicts appear here once the subgraph has
              indexed the <code className="font-mono">VerdictSettled</code> event —
              run <code className="font-mono">pnpm --filter @bonded/settlement settle</code> to
              submit one, or wait for the subgraph to catch up if one was just sent.
            </p>
          </div>
        ) : (
          <div className="mt-8">
            <p className="text-small text-manifest/50 mb-3">Settled verdicts</p>
            <div className="space-y-3">
              {data.verdictRecords.map((v) => (
                <div key={v.id} className="document rounded-doc p-4">
                  <div className="flex items-start justify-between gap-4">
                    <div className="min-w-0">
                      <p className="text-small font-mono text-ink truncate">{v.agent}</p>
                      <p className="text-small font-mono text-ink/60 mt-1">
                        {REASON_NAMES[v.reasonCode] ?? `reasonCode ${v.reasonCode}`}
                        {' · '}
                        {/* A REFUSED verdict moves nothing, so printing "0.00 USDC"
                            next to it invites reading it as a zero-value transfer
                            rather than as money that never left the vault. */}
                        {v.outcome === 0
                          ? `${formatUSDC(v.valueUSDC)} USDC released`
                          : 'no USDC moved'}
                        {' · block '}
                        {v.blockNumber}
                      </p>
                    </div>
                    <span
                      className={`shrink-0 text-small font-mono border px-3 py-1 rounded-control ${
                        OUTCOME_STYLES[v.outcome] ?? 'text-manifest border-hairline'
                      }`}
                    >
                      {OUTCOME_NAMES[v.outcome] ?? `outcome ${v.outcome}`}
                    </span>
                  </div>

                  <a
                    href={EXPLORER_TX(v.transactionHash)}
                    target="_blank"
                    rel="noreferrer"
                    className="text-small font-mono text-seal mt-3 inline-block hover:underline break-all"
                  >
                    {v.transactionHash.slice(0, 18)}... ↗
                  </a>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    </Shell>
  );
}
