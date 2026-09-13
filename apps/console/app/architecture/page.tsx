import Image from 'next/image';
import { Shell } from '../../components/shared/Shell';
import { NextStep } from '../../components/shared/NextStep';

/**
 * Each layer carries its own live/pending status rather than letting the
 * diagram imply all four are equally wired. Three are running in the path a
 * visitor can exercise right now; the authority layer is not, and saying so
 * per-card is more honest than a single banner and more useful than softened
 * prose that leaves a reader guessing which parts are real.
 */
type LayerStatus = { label: string; live: boolean };

const LAYERS: {
  name: string;
  sponsor: string;
  /** Sponsor mark, where the layer has one. The enforcer core is ours. */
  logo?: string;
  pkg: string;
  detail: string;
  status: LayerStatus;
}[] = [
  {
    name: 'Truth',
    sponsor: 'The Graph',
    logo: '/media/thegraph_logo.png',
    pkg: '@bonded/standardized',
    detail:
      'Re-derives every claimed premise from Messari-standardized subgraphs through the Graph Gateway, at a single pinned block. cache: no-store on the enforcement path — a stale premise is a correctness bug, not a latency optimisation.',
    status: { label: 'Live — every proposal through /api/v1/proposals', live: true },
  },
  {
    name: 'Enforcer',
    sponsor: '— (non-generative core)',
    pkg: '@bonded/enforcer',
    detail:
      'Zero LLM calls, never sees prompt text. Six-step fail-closed algorithm: policy hash -> forbidden action -> premises -> budget -> irreversible threshold -> clear. This is the product.',
    status: { label: 'Live — 44 unit tests, the same function the API calls', live: true },
  },
  {
    name: 'Authority',
    sponsor: 'Chainlink CRE',
    logo: '/media/chainlink_Logo.png',
    pkg: '@bonded/authority',
    detail:
      'A handlerInTee workflow reads irreversible_above as a Vault DON secret inside an AWS Nitro enclave and returns only a boolean, so the threshold cannot be binary-searched by probing the enforcer. Deployed and ACTIVE on the CRE DON as bonded-stepup-threshold-staging (id 00771462…, registered in the Workflow Registry on Ethereum mainnet), and the enforcer calls it: every proposal over the line issues a JWT signed by the enrolled key to the CRE gateway, and those invocations appear in cre execution list. Chainlink currently returns the execution asynchronously and its confidential-workflow DON reports "DON members not set" — private beta provisioning on their side — so the enclave cannot yet return a verdict in time to decide. requiresStepUp then falls back to comparing the policy artifact, and every response says which path decided it. The seam fails closed by design: set CRE_REQUIRE_ENCLAVE=true and an unreachable enclave holds instead.',
    status: { label: 'Deployed and invoked — enclave verdict pending Chainlink provisioning', live: true },
  },
  {
    name: 'Settlement',
    sponsor: 'Arc',
    logo: '/media/arc_logo.jpg',
    pkg: 'contracts/BondedVault.sol',
    detail:
      'Holds USDC. settle() accepts only a signed Verdict, in strict mark -> check -> call -> settle -> emit order. HELD_FOR_STEPUP cannot execute via settle() alone — confirmStepUp() requires a separate, independently verified confirmation.',
    status: { label: 'Live — real verdicts settled on Arc testnet, see /log', live: true },
  },
];

export default function ArchitecturePage() {
  return (
    <Shell>
      <div className="max-w-content mx-auto px-8 py-10">
        <h1 className="text-h1 text-manifest">Architecture</h1>
        <p className="text-body text-manifest/60 mt-2 max-w-xl">
          Four layers, meeting only at the <code className="font-mono text-small">Verdict</code> struct — frozen in{' '}
          <code className="font-mono text-small">packages/seam</code>.
        </p>

        <div className="mt-10 flex flex-col gap-0">
          {LAYERS.map((layer, i) => (
            <div key={layer.name}>
              <div className="border border-hairline rounded-control p-5 bg-deepwater">
                <div className="flex items-center justify-between gap-4">
                  <p className="text-h2 text-manifest">{layer.name}</p>
                  {/* The mark in its own colours, rounded, sized to sit level
                      with the layer name. No plate and no grayscale — three
                      brand logos greyed out read as disabled controls. */}
                  <div className="flex items-center gap-3 shrink-0">
                    {layer.logo && (
                      <Image
                        src={layer.logo}
                        alt={layer.sponsor}
                        width={160}
                        height={44}
                        className="h-[26px] md:h-[30px] w-auto object-contain rounded-[6px]"
                      />
                    )}
                    <p className="text-small font-mono text-manifest/40">{layer.sponsor}</p>
                  </div>
                </div>
                <p className="text-small font-mono text-manifest/50 mt-1">{layer.pkg}</p>

                <div className="flex items-center gap-2 mt-3">
                  <span
                    className={`inline-block w-2 h-2 rounded-full shrink-0 ${
                      layer.status.live ? 'bg-seal' : 'bg-hold'
                    }`}
                  />
                  <span
                    className={`text-small font-mono ${
                      layer.status.live ? 'text-seal' : 'text-hold'
                    }`}
                  >
                    {layer.status.label}
                  </span>
                </div>

                <p className="text-body text-manifest/70 mt-3 max-w-2xl">{layer.detail}</p>
              </div>
              {i < LAYERS.length - 1 && (
                <div className="flex justify-center py-2">
                  <div className="w-px h-6 bg-hairline" />
                </div>
              )}
            </div>
          ))}
        </div>

        <div className="mt-10 border-t border-hairline pt-6">
          <p className="text-small text-manifest/50 mb-3">The seam</p>
          <div className="document rounded-doc p-5 overflow-x-auto">
            <pre className="text-small text-ink font-mono">{`interface Verdict {
  proposalHash: Hash32;
  policyHash:   Hash32;
  outcome:      0 | 1 | 2;   // CLEARED | REFUSED | HELD_FOR_STEPUP
  reasonCode:   ReasonCode;  // enumerated, never a free string
  blockChecked: bigint;
  logRef:       Hash32;
}`}</pre>
          </div>
          <p className="text-small text-manifest/40 mt-3 max-w-xl">
            <code className="font-mono">reasonCode</code> is an enum, never a free string — free strings are
            how injected text reaches a UI. Defined in{' '}
            <code className="font-mono">packages/seam/src/types.ts</code>, frozen after the seam-v1 tag.
          </p>
        </div>
        <NextStep
          lead="Three layers, of which the vault and the enforcer are deployed and settling today. Putting your own money behind them takes four steps in your account."
          secondary={{ label: 'See what it settled', href: '/log' }}
        />
      </div>
    </Shell>
  );
}
