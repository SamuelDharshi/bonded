import { NextResponse } from 'next/server';
import { recoverMessageAddress, keccak256, isAddress, getAddress } from 'viem';
import { enforce } from '@bonded/enforcer';
import {
  ReasonCode,
  VAULT_ABI,
  encodeTransferAction,
  proposalDigest,
  verdictDigest,
  type Proposal,
} from '@bonded/seam';
import {
  REGISTRY,
  REGISTRY_ABI,
  VAULT,
  ZERO_ADDRESS,
  arcTestnet,
  enforcerAccount,
  publicClient,
} from '../../../../lib/bonded/chain';
import { createLiveContext } from '../../../../lib/bonded/graph';
import { loadPolicy } from '../../../../lib/bonded/policyStore';

export const dynamic = 'force-dynamic';

/**
 * POST /api/v1/proposals — the endpoint an agent actually calls.
 *
 * The agent submits what it wants to do and the facts it claims justify it.
 * This service re-derives every one of those facts from The Graph, at a pinned
 * block, without reading the agent's prompt or reasoning, and returns a verdict.
 * On CLEARED it also returns a signature the vault will accept — for that exact
 * transfer and nothing else.
 *
 * Request:
 *   {
 *     "proposal": {
 *       "id": "0x…32 bytes",
 *       "agent": "0x…",
 *       "action": { "kind": "swap", "target": "0x…", "calldata": "0x", "valueUSDC": "500000" },
 *       "premises": [{ "premiseId": "tvl", "claimedValue": "…" }],
 *       "createdAt": 1789283000
 *     },
 *     "signature": "0x…"   // EIP-191 over proposalDigest(), by proposal.agent
 *   }
 *
 * Notable properties, each load-bearing:
 *
 *  - No API key. The agent signs its proposal with the key it already needs to
 *    settle, and the owner already authorized that address on-chain. A
 *    server-issued credential would prove less and add an attack surface.
 *
 *  - The service never sends a transaction. It returns the signature and the
 *    exact arguments; the agent settles and pays its own gas. So this service
 *    cannot move anyone's money even if it wanted to — it has no path to the
 *    vault that does not run through the agent.
 *
 *  - No fixture fallback. If the Gateway cannot be reached, the premises are
 *    unresolvable and the enforcer refuses. An unreachable fact is not an
 *    approval.
 */

const OUTCOME_NAME = ['CLEARED', 'REFUSED', 'HELD_FOR_STEPUP'] as const;

/** How long a signed proposal stays usable. */
const MAX_AGE_SECONDS = 300;

/**
 * The same limit for a proposal the vault has already armed.
 *
 * The step-up loop requires the agent to resubmit the IDENTICAL proposal after
 * the owner confirms, because the confirmation is bound to that proposal and to
 * that action hash. A five-minute window would make the loop unusable: it would
 * expire while a human was deciding, which is the one thing a human gate must
 * allow time for. An armed hold is on-chain evidence that this exact proposal
 * was already accepted, and the premises are re-derived at current chain state
 * on every submission regardless, so an older signature is not judged against
 * stale facts.
 */
const ARMED_MAX_AGE_SECONDS = 86_400;

/** Tolerance for a client clock running ahead. */
const MAX_SKEW_SECONDS = 60;

function reasonName(code: number): string {
  return ReasonCode[code] ?? `UNKNOWN_${code}`;
}

function bad(error: string, detail?: string, status = 400): NextResponse {
  return NextResponse.json(detail ? { error, detail } : { error }, { status });
}

/** Validate the submitted shape without trusting any of it. */
function parseProposal(input: unknown): { proposal: Proposal } | { error: string } {
  if (!input || typeof input !== 'object') return { error: 'proposal must be an object' };
  const p = input as Record<string, unknown>;

  if (typeof p['id'] !== 'string' || !/^0x[0-9a-fA-F]{64}$/.test(p['id'])) {
    return { error: 'proposal.id must be 32 bytes of hex' };
  }
  if (typeof p['agent'] !== 'string' || !isAddress(p['agent'])) {
    return { error: 'proposal.agent must be an address' };
  }
  if (typeof p['createdAt'] !== 'number' || !Number.isInteger(p['createdAt'])) {
    return { error: 'proposal.createdAt must be an integer unix timestamp' };
  }

  const a = p['action'];
  if (!a || typeof a !== 'object') return { error: 'proposal.action is required' };
  const action = a as Record<string, unknown>;

  if (typeof action['kind'] !== 'string' || action['kind'].length === 0) {
    return { error: 'proposal.action.kind is required' };
  }
  if (typeof action['target'] !== 'string' || !isAddress(action['target'])) {
    return { error: 'proposal.action.target must be an address' };
  }
  if (typeof action['calldata'] !== 'string' || !/^0x([0-9a-fA-F]{2})*$/.test(action['calldata'])) {
    return { error: 'proposal.action.calldata must be hex (use "0x" for none)' };
  }
  // Fixed point, never a float. A JSON number here would already have lost
  // precision before it arrived, so only a decimal string is accepted.
  if (typeof action['valueUSDC'] !== 'string' || !/^[0-9]+$/.test(action['valueUSDC'])) {
    return {
      error: 'proposal.action.valueUSDC must be a decimal string of 6-decimal USDC units',
    };
  }

  if (!Array.isArray(p['premises'])) return { error: 'proposal.premises must be an array' };
  for (const entry of p['premises']) {
    if (!entry || typeof entry !== 'object') return { error: 'each premise must be an object' };
    const e = entry as Record<string, unknown>;
    if (typeof e['premiseId'] !== 'string' || typeof e['claimedValue'] !== 'string') {
      return { error: 'each premise needs a string premiseId and a string claimedValue' };
    }
  }

  return { proposal: input as unknown as Proposal };
}

export async function POST(req: Request): Promise<NextResponse> {
  // ── Parse ─────────────────────────────────────────────────────────────────
  let body: { proposal?: unknown; signature?: unknown };
  try {
    body = (await req.json()) as typeof body;
  } catch {
    return bad('body must be JSON');
  }

  const parsed = parseProposal(body.proposal);
  if ('error' in parsed) return bad(parsed.error);
  const { proposal } = parsed;

  if (typeof body.signature !== 'string' || !/^0x[0-9a-fA-F]+$/.test(body.signature)) {
    return bad(
      'signature is required',
      'Sign proposalDigest() from @bonded/seam as EIP-191 with the agent key. ' +
        'This is what proves the proposal is yours; without it, anyone could spend ' +
        'the budget of another owner by claiming to be their agent.',
    );
  }

  // ── Freshness, before anything expensive ──────────────────────────────────
  // proposal.id IS the on-chain proposalHash, so the vault can be asked whether
  // this exact proposal is already held awaiting a human. If it is, the longer
  // window applies — see ARMED_MAX_AGE_SECONDS.
  const now = Math.floor(Date.now() / 1000);
  const age = now - proposal.createdAt;

  let alreadyArmed = false;
  try {
    alreadyArmed = await publicClient().readContract({
      address: VAULT, abi: VAULT_ABI, functionName: 'stepUpArmed', args: [proposal.id],
    });
  } catch {
    // Treat an unreachable vault as not-armed: the stricter window, never the
    // looser one.
    alreadyArmed = false;
  }

  const ageLimit = alreadyArmed ? ARMED_MAX_AGE_SECONDS : MAX_AGE_SECONDS;
  if (age > ageLimit) {
    return bad(
      'proposal has expired',
      `createdAt is ${age}s old and the limit is ${ageLimit}s` +
        (alreadyArmed
          ? ' for a proposal already held on-chain.'
          : '. Premises are re-derived at current chain state, so an old proposal would ' +
            'be judged against facts it never saw.'),
    );
  }
  if (age < -MAX_SKEW_SECONDS) {
    return bad('proposal.createdAt is in the future', `by ${-age}s — check the agent clock`);
  }

  // ── Authenticate the agent ────────────────────────────────────────────────
  const digest = proposalDigest({
    chainId: BigInt(arcTestnet.id),
    vault: VAULT,
    agent: getAddress(proposal.agent),
    proposalId: proposal.id,
    action: {
      kind: proposal.action.kind,
      target: getAddress(proposal.action.target),
      calldata: proposal.action.calldata,
      valueUSDC: proposal.action.valueUSDC,
    },
    premises: proposal.premises,
    createdAt: proposal.createdAt,
  });

  let recovered: `0x${string}`;
  try {
    recovered = await recoverMessageAddress({
      message: { raw: digest },
      signature: body.signature as `0x${string}`,
    });
  } catch {
    return bad('signature could not be recovered', 'It must be an EIP-191 signature over proposalDigest()', 401);
  }

  if (getAddress(recovered) !== getAddress(proposal.agent)) {
    return bad(
      'signature does not match proposal.agent',
      `recovered ${recovered}. The signature must be produced by the agent address in the proposal.`,
      401,
    );
  }

  const agent = getAddress(proposal.agent);
  const client = publicClient();

  // ── Is this agent authorized, and by whom? ────────────────────────────────
  let owner: `0x${string}`;
  try {
    owner = await client.readContract({
      address: VAULT, abi: VAULT_ABI, functionName: 'ownerOf', args: [agent],
    });
  } catch (err) {
    return bad(
      'could not reach the vault',
      err instanceof Error ? err.message : undefined,
      502,
    );
  }

  if (owner === ZERO_ADDRESS) {
    return bad(
      'agent is not authorized',
      `No owner has authorized ${agent} on vault ${VAULT}. The owner must call ` +
        'authorizeAgent(agent) from their own wallet. Authorizing names an address — ' +
        'it never involves handing over the agent key.',
      403,
    );
  }

  // ── Whose rules apply, and are they current? ──────────────────────────────
  const lookup = await loadPolicy(owner);
  if (lookup.status !== 'ok') {
    return NextResponse.json(
      {
        error: `policy unavailable for owner ${owner}`,
        status: lookup.status,
        onchainHash: lookup.onchainHash,
        detail:
          lookup.status === 'not-committed'
            ? 'The owner has not committed a policy hash to BondedRegistry.'
            : lookup.status === 'not-published'
              ? 'A hash is committed but the artifact is not published — POST it to /api/v1/policies.'
              : 'The published artifact no longer matches the commitment. Nothing is enforced until it does.',
      },
      { status: 409 },
    );
  }
  const policy = lookup.stored.policy;

  // ── The vault only performs transfers ─────────────────────────────────────
  // Rejected here rather than at settle time so the agent gets a reason instead
  // of an opaque revert. A policy cannot reason about the effects of a call it
  // has not modelled, so the vault refuses arbitrary calldata outright.
  if (proposal.action.calldata !== '0x') {
    return bad(
      'action.calldata must be empty',
      'The vault performs USDC transfers only. Arbitrary calls are refused, because a ' +
        'policy cannot bound the effects of a call it has not modelled.',
      422,
    );
  }

  // ── Real budget state, read from the chain ────────────────────────────────
  let spentThisPeriod: bigint;
  try {
    spentThisPeriod = await client.readContract({
      address: VAULT, abi: VAULT_ABI, functionName: 'spentThisPeriod', args: [owner],
    });
  } catch {
    spentThisPeriod = 0n;
  }

  // ── Re-derive the premises. No fallback. ──────────────────────────────────
  const apiKey = process.env.GRAPH_API_KEY;
  if (!apiKey) {
    return bad(
      'premise re-derivation is unavailable',
      'GRAPH_API_KEY is not configured, so claimed facts cannot be independently ' +
        'checked. This refuses rather than taking the claim on trust.',
      503,
    );
  }

  let query: Awaited<ReturnType<typeof createLiveContext>>['query'];
  let block: bigint;
  try {
    const live = await createLiveContext(apiKey);
    query = live.query;
    block = live.block;
  } catch (err) {
    return bad(
      'the Graph Gateway could not be reached',
      (err instanceof Error ? err.message : 'unknown error') +
        ' — premises are unverifiable, so nothing is signed.',
      502,
    );
  }

  const onchainHash = lookup.onchainHash;

  /**
   * Step 5's delegation seam, wired to the chain.
   *
   * Without this the enforcer compares the amount to the threshold and holds —
   * every time, forever. It has no way to know a human already confirmed, so a
   * held proposal could never progress: the owner would confirm, the agent would
   * resubmit, and the enforcer would hold the same proposal again. The
   * confirmation lives on-chain, which is the only place it should live, so the
   * question "is step-up still required" has to be asked there.
   *
   * Over the threshold and unconfirmed -> still required, hold. Over the
   * threshold and confirmed -> satisfied, proceed. Under the threshold -> never
   * required.
   *
   * Fail-closed by construction: enforce() treats a throw here as
   * ATTESTATION_MISSING and holds, so an unreachable vault cannot clear
   * anything. When the CRE enclave is deployed it replaces the threshold
   * comparison below; the confirmation check still belongs here, because
   * "already confirmed" is a fact about the chain and not about the threshold.
   */
  const requiresStepUp = async ({
    proposalHash,
    valueUSDC: amount,
  }: {
    proposalHash: `0x${string}`;
    valueUSDC: bigint;
  }): Promise<boolean> => {
    if (amount <= BigInt(policy.irreversible_above)) return false;

    const confirmed = await client.readContract({
      address: VAULT, abi: VAULT_ABI, functionName: 'stepUpConfirmed', args: [proposalHash],
    });
    return !confirmed;
  };

  const { verdict, record } = await enforce(
    proposal,
    policy,
    {
      onchainPolicyHash: onchainHash,
      currentBlock: block,
      currentTimestamp: now,
      spentThisPeriod,
      requiresStepUp,
    },
    query,
  );

  // ── Build the settlement payload ──────────────────────────────────────────
  // The action is constructed here from the proposal the enforcer just judged,
  // and its hash goes into the signature. That is the whole fix behind this
  // endpoint's existence: the signature authorizes one payment, not a decision
  // that some other payment can be attached to later.
  const valueUSDC = BigInt(proposal.action.valueUSDC);
  const action = encodeTransferAction(getAddress(proposal.action.target), valueUSDC);

  const signer = enforcerAccount();
  const enforcerSignature = await signer.signMessage({
    message: {
      raw: verdictDigest({
        chainId: BigInt(arcTestnet.id),
        vault: VAULT,
        agent,
        proposalHash: verdict.proposalHash,
        policyHash: verdict.policyHash,
        outcome: verdict.outcome,
        reasonCode: verdict.reasonCode,
        blockChecked: verdict.blockChecked,
        logRef: verdict.logRef,
        actionHash: keccak256(action),
      }),
    },
  });

  const settlementNote =
    verdict.outcome === 0
      ? 'Send this to release the funds.'
      : verdict.outcome === 1
        ? 'Sending this records the refusal on-chain. No USDC moves.'
        : 'Sending this arms the step-up gate. The owner must then call confirmStepUp(proposalHash) ' +
          'from their own wallet, after which resubmit the same proposal to receive a CLEARED verdict.';

  return NextResponse.json({
    verdict: {
      outcome: verdict.outcome,
      outcomeName: OUTCOME_NAME[verdict.outcome],
      reasonCode: verdict.reasonCode,
      reasonName: reasonName(verdict.reasonCode),
      proposalHash: verdict.proposalHash,
      policyHash: verdict.policyHash,
      blockChecked: verdict.blockChecked.toString(),
      logRef: verdict.logRef,
    },
    authority: {
      owner,
      agent,
      policyVersion: record.policyVersion,
      spentThisPeriod: spentThisPeriod.toString(),
      budgetMax: policy.budget.max,
      irreversibleAbove: policy.irreversible_above,
    },
    // What the agent claimed next to what was independently re-derived. This is
    // the audit trail: it shows the check happened rather than asserting it did.
    premises: record.premises.map((p) => ({
      premiseId: p.premiseId,
      schema: p.schema,
      field: p.field,
      op: p.op,
      claimed: p.claimedValue,
      rederived: p.derivedValue,
      toleranceBps: p.toleranceBps,
      passed: p.passed,
      blockChecked: p.blockChecked.toString(),
    })),
    settlement: {
      chainId: arcTestnet.id,
      vault: VAULT,
      registry: REGISTRY,
      function:
        'settle(bytes32,bytes32,uint8,uint16,uint64,bytes32,bytes,bytes)',
      args: [
        verdict.proposalHash,
        verdict.policyHash,
        verdict.outcome,
        verdict.reasonCode,
        verdict.blockChecked.toString(),
        verdict.logRef,
        action,
        enforcerSignature,
      ],
      note:
        settlementNote +
        ` Send it from ${agent}; the signature names that address and the vault will ` +
        'reject it from any other.',
    },
    evidence: {
      queryPath: 'live-gateway',
      pinnedBlock: block.toString(),
      alreadyArmed,
      note: 'Every premise above was re-derived at this block, independent of the agent.',
    },
  });
}

/** Tell a curious caller what to send. */
export async function GET(): Promise<NextResponse> {
  const client = publicClient();
  let policyVersionReadable = true;
  try {
    await client.readContract({
      address: REGISTRY, abi: REGISTRY_ABI, functionName: 'policyVersion', args: [VAULT],
    });
  } catch {
    policyVersionReadable = false;
  }

  return NextResponse.json({
    endpoint: 'POST /api/v1/proposals',
    chainId: arcTestnet.id,
    vault: VAULT,
    registry: REGISTRY,
    enforcerSigner: (() => {
      try {
        return enforcerAccount().address;
      } catch {
        return null;
      }
    })(),
    chainReachable: policyVersionReadable,
    graphConfigured: Boolean(process.env.GRAPH_API_KEY),
    howToUse: [
      '1. Owner: commitPolicy(policyHash) on BondedRegistry, from the owner wallet.',
      '2. Owner: POST the artifact to /api/v1/policies so the enforcer can read the rules.',
      '3. Owner: deposit(amount) on the vault, after approving USDC to it.',
      '4. Owner: authorizeAgent(agentAddress) on the vault. An address, never a key.',
      '5. Agent: POST a proposal here, signed with proposalDigest() from @bonded/seam.',
      '6. Agent: send the returned settlement args yourself. This service never transacts.',
    ],
    maxProposalAgeSeconds: MAX_AGE_SECONDS,
    maxProposalAgeSecondsWhenHeld: ARMED_MAX_AGE_SECONDS,
  });
}
