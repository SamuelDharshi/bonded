import { NextResponse } from 'next/server';
import { decodeAbiParameters, decodeFunctionData, getAddress, isAddress, keccak256 } from 'viem';
import { VAULT_ABI } from '@bonded/seam';
import {
  ERC20_ABI,
  USDC,
  VAULT,
  publicClient,
} from '../../../../../lib/bonded/chain';
import { loadPolicy } from '../../../../../lib/bonded/policyStore';

export const dynamic = 'force-dynamic';

/**
 * GET /api/v1/owners/:owner — everything the dashboard needs in one read.
 *
 * Reads happen here rather than in the browser so the page has no RPC
 * credentials and no Graph API key. Writes deliberately do NOT happen here:
 * deposit, withdraw, authorize, revoke, commit and confirm are all sent by the
 * owner's own wallet, straight to the contracts. This endpoint cannot move
 * anything.
 */

interface SubgraphAgent {
  id: string;
  agent: string;
  owner: string;
  revoked: boolean;
  authorizedAt: string;
  transactionHash: string;
}

interface SubgraphHold {
  id: string;
  proposalHash: string;
  agent: string;
  owner: string | null;
  armedAt: string;
  armedTxHash: string;
  confirmed: boolean;
  verdict: { valueUSDC: string; reasonCode: number } | null;
}

/**
 * Recover what a pending hold would actually pay, and prove it.
 *
 * The StepUpArmed event carries only the proposal hash and the agent — the
 * amount and recipient live in the `action` bytes passed to settle(), and the
 * vault stores only their hash. So the arming transaction is fetched, its
 * calldata decoded, and the resulting action hashed and compared against
 * stepUpActionHash on-chain.
 *
 * That last comparison is the point. Without it this would be a plausible
 * amount read off a transaction; with it, it is provably the action the hold is
 * bound to. An owner asked to confirm a payment has to be shown the payment,
 * and showing an unverified number would be worse than showing none.
 */
async function recoverHeldAction(
  client: ReturnType<typeof publicClient>,
  armedTxHash: string,
  expectedActionHash: string,
): Promise<{ target: string; valueUSDC: string; verifiedAgainstChain: boolean } | null> {
  try {
    const tx = await client.getTransaction({ hash: armedTxHash as `0x${string}` });

    const { functionName, args } = decodeFunctionData({ abi: VAULT_ABI, data: tx.input });
    if (functionName !== 'settle' || !args) return null;

    // settle(proposalHash, policyHash, outcome, reasonCode, blockChecked, logRef, action, sig)
    const action = args[6] as `0x${string}`;
    const [target, , valueUSDC] = decodeAbiParameters(
      [{ type: 'address' }, { type: 'bytes' }, { type: 'uint256' }],
      action,
    );

    return {
      target: getAddress(target),
      valueUSDC: valueUSDC.toString(),
      verifiedAgainstChain: keccak256(action).toLowerCase() === expectedActionHash.toLowerCase(),
    };
  } catch {
    return null;
  }
}

/**
 * Agents and holds come from the subgraph because the vault cannot enumerate
 * them — `ownerOf` is a mapping, and a mapping has no keys. Everything
 * security-relevant is still re-read from the chain below; the subgraph is used
 * only to discover WHICH addresses to ask about.
 */
async function fromSubgraph(
  owner: string,
): Promise<{ agents: SubgraphAgent[]; holds: SubgraphHold[]; error: string | null }> {
  const url = process.env.GRAPH_GATEWAY_URL;
  if (!url) return { agents: [], holds: [], error: 'GRAPH_GATEWAY_URL not set' };

  const query = `{
    agents(where: { owner: "${owner.toLowerCase()}" }, orderBy: authorizedAt, orderDirection: desc) {
      id agent owner revoked authorizedAt transactionHash
    }
    stepUpRecords(where: { owner: "${owner.toLowerCase()}", confirmed: false }, orderBy: armedAt, orderDirection: desc) {
      id proposalHash agent owner armedAt armedTxHash confirmed
      verdict { valueUSDC reasonCode }
    }
  }`;

  try {
    const res = await fetch(url, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      cache: 'no-store',
      body: JSON.stringify({ query }),
    });
    const json = (await res.json()) as {
      data?: { agents: SubgraphAgent[]; stepUpRecords: SubgraphHold[] };
      errors?: Array<{ message: string }>;
    };
    // A GraphQL response may carry partial data alongside errors. Returning
    // nothing on any error meant one bad field took down every list in the same
    // query — an unrelated schema problem in holds emptied the agents list and
    // told the owner they had authorized nobody.
    return {
      agents: json.data?.agents ?? [],
      holds: json.data?.stepUpRecords ?? [],
      error: json.errors?.[0]?.message ?? null,
    };
  } catch (err) {
    return { agents: [], holds: [], error: err instanceof Error ? err.message : 'subgraph unreachable' };
  }
}

export async function GET(
  _req: Request,
  { params }: { params: Promise<{ owner: string }> },
): Promise<NextResponse> {
  const { owner: raw } = await params;
  if (!isAddress(raw)) {
    return NextResponse.json({ error: 'owner must be an address' }, { status: 400 });
  }
  const owner = getAddress(raw);
  const client = publicClient();

  let credited: bigint;
  let walletUSDC: bigint;
  let allowance: bigint;
  let limits: readonly [bigint, bigint];
  let spent: bigint;
  let periodStart: bigint;

  try {
    [credited, walletUSDC, limits, spent, periodStart] = await Promise.all([
      client.readContract({ address: VAULT, abi: VAULT_ABI, functionName: 'balanceOf', args: [owner] }),
      client.readContract({ address: USDC, abi: ERC20_ABI, functionName: 'balanceOf', args: [owner] }),
      client.readContract({ address: VAULT, abi: VAULT_ABI, functionName: 'effectiveLimits', args: [owner] }),
      client.readContract({ address: VAULT, abi: VAULT_ABI, functionName: 'spentThisPeriod', args: [owner] }),
      client.readContract({ address: VAULT, abi: VAULT_ABI, functionName: 'periodStart', args: [owner] }),
    ]);
    allowance = await client.readContract({
      address: USDC, abi: ERC20_ABI, functionName: 'allowance', args: [owner, VAULT],
    });
  } catch (err) {
    return NextResponse.json(
      { error: 'could not reach the chain', detail: err instanceof Error ? err.message : undefined },
      { status: 502 },
    );
  }

  const policy = await loadPolicy(owner);
  const { agents, holds, error: subgraphError } = await fromSubgraph(owner);

  // Re-read authorization from the chain for every agent the subgraph named.
  // The subgraph is an index, not an authority: if the two ever disagree, the
  // vault is right, and the dashboard must not tell an owner that a revoked
  // agent is still live (or the reverse).
  const agentRows = await Promise.all(
    agents.map(async (a) => {
      let onchainOwner = '0x0000000000000000000000000000000000000000';
      try {
        onchainOwner = await client.readContract({
          address: VAULT, abi: VAULT_ABI, functionName: 'ownerOf', args: [getAddress(a.agent) ],
        });
      } catch {
        // Leave as unauthorized; a failed read must not imply authority.
      }
      const authorizedOnChain = onchainOwner.toLowerCase() === owner.toLowerCase();
      return {
        agent: getAddress(a.agent),
        authorized: authorizedOnChain,
        indexedAsRevoked: a.revoked,
        agreesWithChain: authorizedOnChain === !a.revoked,
        authorizedAt: a.authorizedAt,
        transactionHash: a.transactionHash,
      };
    }),
  );

  // Same rule for holds as for agents: the subgraph says WHICH proposals to ask
  // about, the vault says what is actually true of them. A proposal can be armed
  // more than once, and the index has been wrong about confirmation before, so
  // "does this still need me" is answered on-chain — otherwise an owner is shown
  // a confirm button whose transaction reverts.
  const holdRows = await Promise.all(
    holds.map(async (h) => {
      const hash = h.proposalHash as `0x${string}`;
      let confirmed = false;
      let settled = false;
      let armed = false;
      let onchainActionHash = '0x';
      try {
        [armed, confirmed, settled, onchainActionHash] = await Promise.all([
          client.readContract({ address: VAULT, abi: VAULT_ABI, functionName: 'stepUpArmed', args: [hash] }),
          client.readContract({ address: VAULT, abi: VAULT_ABI, functionName: 'stepUpConfirmed', args: [hash] }),
          client.readContract({ address: VAULT, abi: VAULT_ABI, functionName: 'settled', args: [hash] }),
          client.readContract({ address: VAULT, abi: VAULT_ABI, functionName: 'stepUpActionHash', args: [hash] }),
        ]);
      } catch {
        // An unreadable vault must not present a hold as actionable.
        return null;
      }

      const action = h.armedTxHash
        ? await recoverHeldAction(client, h.armedTxHash, onchainActionHash)
        : null;

      return {
        proposalHash: hash,
        agent: getAddress(h.agent),
        // Prefer the action decoded from the arming transaction and checked
        // against the chain; fall back to the settled verdict's amount, which
        // only exists once something has settled.
        valueUSDC: action?.valueUSDC ?? h.verdict?.valueUSDC ?? null,
        recipient: action?.target ?? null,
        amountVerifiedAgainstChain: action?.verifiedAgainstChain ?? false,
        armedAt: h.armedAt,
        armedTxHash: h.armedTxHash ?? null,
        armed,
        confirmed,
        settled,
        // The only state where the owner has something to do.
        awaitingYourConfirmation: armed && !confirmed && !settled,
      };
    }),
  );

  const actionableHolds = holdRows.filter(
    (h): h is NonNullable<typeof h> => h !== null,
  );

  return NextResponse.json({
    owner,
    vault: VAULT,
    usdc: USDC,
    funds: {
      creditedToYou: credited.toString(),
      inYourWallet: walletUSDC.toString(),
      allowanceToVault: allowance.toString(),
    },
    limits: {
      irreversibleAbove: limits[0].toString(),
      budgetMax: limits[1].toString(),
      spentThisPeriod: spent.toString(),
      periodStart: periodStart.toString(),
      periodDurationSeconds: 7 * 24 * 60 * 60,
    },
    policy: {
      status: policy.status,
      onchainHash: policy.onchainHash,
      publishedHash: 'stored' in policy ? policy.stored.policyHash : null,
      artifact: policy.status === 'ok' ? policy.stored.policy : null,
    },
    agents: agentRows,
    holds: actionableHolds,
    subgraphError,
  });
}
