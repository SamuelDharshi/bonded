import { Shell } from '../../components/shared/Shell';
import { ScrollText } from 'lucide-react';

/**
 * The decision log is backed by our own subgraph indexing BondedRegistry
 * and BondedVault events (see subgraph/schema.graphql) — not a database.
 * Nothing is deployed to Subgraph Studio yet, so this page states that
 * plainly rather than rendering fabricated entries. Once deployed, this
 * becomes a live query against the Gateway URL in .env, one paper record
 * per proposalHash, each hash linking to a real Arc explorer transaction.
 */
export default function LogPage() {
  return (
    <Shell>
      <div className="max-w-content mx-auto px-8 py-10">
        <h1 className="text-h1 text-manifest">Decision log</h1>
        <p className="text-body text-manifest/60 mt-2 max-w-xl">
          Every proposal, premise, re-derivation, and verdict, indexed by our own subgraph —
          not a database.
        </p>

        <div className="mt-16 flex flex-col items-center text-center max-w-md mx-auto">
          <ScrollText size={32} strokeWidth={1.5} className="text-manifest/30" />
          <p className="text-body text-manifest/70 mt-4">
            The subgraph is not deployed to Subgraph Studio yet.
          </p>
          <p className="text-small text-manifest/40 mt-2">
            No decisions have been indexed, because none have been committed on-chain. Deploy{' '}
            <code className="font-mono">subgraph/</code> and set{' '}
            <code className="font-mono">GRAPH_GATEWAY_URL</code> /{' '}
            <code className="font-mono">BONDED_SUBGRAPH_ID</code> in <code className="font-mono">.env</code> to
            populate this page.
          </p>
        </div>
      </div>
    </Shell>
  );
}
