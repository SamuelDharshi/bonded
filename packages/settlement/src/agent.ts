import { writeFileSync, readFileSync, existsSync, mkdirSync } from 'node:fs';
import path from 'node:path';
import { formatUnits, keccak256, stringToHex } from 'viem';
import { privateKeyToAccount, generatePrivateKey } from 'viem/accounts';
import { proposalDigest } from '@bonded/seam';
import {
  ERC20_ABI,
  VAULT_ABI,
  addr,
  arcTestnet,
  clients,
  explorerTx,
  required,
} from './chain.js';
import { POLICY, createLiveContext } from './policy.js';

/**
 * A minimal agent, exactly as a customer would write one.
 *
 * It talks to the Bonded API over HTTP and settles the result itself. It does
 * not import the enforcer, does not know the policy, and has no privileged
 * access to anything: everything it needs it gets from a public endpoint plus
 * its own key.
 *
 * That is the point of running it. The enforcement path is only real if an
 * outside caller can reach it the way a customer would, so this script is the
 * integration test for the product rather than for the library.
 *
 * Notice what never happens here: no API key, no secret handed to the service,
 * no transaction sent on the agent's behalf. The agent signs its proposal with
 * the key it already has, receives a signature valid for one exact transfer,
 * and broadcasts that transfer itself.
 *
 * Usage:
 *   pnpm --filter @bonded/settlement agent            # honest proposal
 *   pnpm --filter @bonded/settlement agent lie        # inflate the claimed TVL
 *   pnpm --filter @bonded/settlement agent big        # over the step-up threshold
 *   pnpm --filter @bonded/settlement agent forbidden  # a forbidden action kind
 *   pnpm --filter @bonded/settlement agent rogue      # an agent nobody authorized
 *   pnpm --filter @bonded/settlement agent resume     # retry a held proposal after confirmation
 *
 * BONDED_API_URL overrides the default http://localhost:3000.
 */

type Mode = 'honest' | 'lie' | 'big' | 'forbidden' | 'rogue' | 'resume';

const API = process.env.BONDED_API_URL ?? 'http://localhost:3000';
const RECIPIENT = '0x000000000000000000000000000000000000dEaD' as const;

/** 412M USD at 18-decimal scale, against a pool holding roughly 125M. */
const INFLATED_TVL = '412000000000000000000000000';

/**
 * Where a held proposal is parked.
 *
 * A hold is bound to one proposal id AND one action hash, so resuming it means
 * resubmitting exactly what was armed — same id, same createdAt, same
 * signature. A real agent would persist its pending proposals for the same
 * reason; regenerating one would produce a different hash and lose the human
 * confirmation that had already been given for the original.
 */
const PENDING_FILE = path.join(process.cwd(), '.pending-proposal.json');

interface Pending {
  proposal: {
    id: `0x${string}`;
    agent: `0x${string}`;
    action: { kind: string; target: `0x${string}`; calldata: '0x'; valueUSDC: string };
    premises: Array<{ premiseId: string; claimedValue: string }>;
    createdAt: number;
  };
  signature: `0x${string}`;
}

interface ApiVerdict {
  verdict: {
    outcome: 0 | 1 | 2;
    outcomeName: string;
    reasonCode: number;
    reasonName: string;
    proposalHash: `0x${string}`;
    policyHash: `0x${string}`;
    blockChecked: string;
    logRef: `0x${string}`;
  };
  authority: { owner: string; agent: string; spentThisPeriod: string; budgetMax: string };
  premises: Array<{
    premiseId: string;
    claimed: string;
    rederived: string | null;
    passed: boolean;
  }>;
  settlement: {
    args: [string, string, number, number, string, string, `0x${string}`, `0x${string}`];
    note: string;
  };
  evidence: { queryPath: string; pinnedBlock: string };
}

function parseMode(arg: string | undefined): Mode {
  if (!arg || arg === 'honest') return 'honest';
  if (arg === 'lie' || arg === 'big' || arg === 'forbidden' || arg === 'rogue' || arg === 'resume') {
    return arg;
  }
  throw new Error(`unknown mode '${arg}' — use honest | lie | big | forbidden | rogue | resume`);
}

async function main(): Promise<void> {
  const mode = parseMode(process.argv[2]);
  const { account: enrolled, publicClient, walletClient } = clients();

  // In `rogue` mode the proposal is signed by a freshly generated key that no
  // owner has authorized on the vault. The signature is perfectly valid — the
  // point is that a valid signature is not authority. Generated rather than
  // hardcoded so it holds nothing and can never be funded by accident.
  const account = mode === 'rogue' ? privateKeyToAccount(generatePrivateKey()) : enrolled;
  const vault = addr('BONDED_VAULT_ADDRESS');
  const usdc = addr('USDC_ADDRESS');

  console.log('\n═══ a customer agent, talking to Bonded over HTTP ═══\n');
  console.log(`  api     ${API}`);
  console.log(`  agent   ${account.address}`);
  console.log(`  mode    ${mode}`);

  let proposal: Pending['proposal'];
  let signature: Pending['signature'];

  if (mode === 'resume') {
    // Resubmit byte-for-byte what was armed. Rebuilding it would change the
    // proposal id and the action hash, and the vault binds the owner's
    // confirmation to both — a "close enough" resubmission is a different
    // proposal that nobody confirmed.
    if (!existsSync(PENDING_FILE)) {
      throw new Error(
        `nothing to resume — no ${PENDING_FILE}. Run 'agent big' first to arm a hold.`,
      );
    }
    const pending = JSON.parse(readFileSync(PENDING_FILE, 'utf8')) as Pending;
    proposal = pending.proposal;
    signature = pending.signature;

    const armed = await publicClient.readContract({
      address: vault, abi: VAULT_ABI, functionName: 'stepUpArmed', args: [proposal.id],
    });
    const confirmed = await publicClient.readContract({
      address: vault, abi: VAULT_ABI, functionName: 'stepUpConfirmed', args: [proposal.id],
    });

    console.log(`\n  resuming  ${proposal.id}`);
    console.log(`  armed     ${armed}`);
    console.log(`  confirmed ${confirmed}`);

    if (!armed) throw new Error('that proposal is not armed on-chain — nothing to resume');
    if (!confirmed) {
      throw new Error(
        'the owner has not confirmed yet. Run: pnpm --filter @bonded/settlement owner-confirm',
      );
    }
  } else {
    // ── What an honest agent would read for itself ──────────────────────────
    // Read from the same standardized subgraph the enforcer will use. In `lie`
    // mode the claim is replaced afterwards; everything else stays identical, so
    // the only difference the enforcer can see is the claim itself.
    const live = await createLiveContext(required('GRAPH_API_KEY'));
    const [tvl, poolAge] = await Promise.all([
      live.query('messari-dex-amm', 'liquidityPool.totalValueLockedUSD', { premiseId: 'tvl' }, live.block),
      live.query('messari-dex-amm', 'liquidityPool.createdTimestamp', { premiseId: 'pool_age' }, live.block),
    ]);
    if (tvl === null || poolAge === null) throw new Error('could not read the pool — nothing to propose');

    const claimedTvl = mode === 'lie' ? INFLATED_TVL : tvl;
    const valueUSDC = mode === 'big' ? '2000000' : '500000';
    const kind = mode === 'forbidden' ? 'approve_unlimited' : 'swap';

    const createdAt = Math.floor(Date.now() / 1000);
    proposal = {
      // Unique per run: the vault refuses a proposalHash it has already settled.
      id: keccak256(stringToHex(`${account.address}:${mode}:${createdAt}`)),
      agent: account.address,
      action: { kind, target: RECIPIENT, calldata: '0x' as const, valueUSDC },
      premises: [
        { premiseId: 'tvl', claimedValue: claimedTvl },
        { premiseId: 'pool_age', claimedValue: poolAge },
      ],
      createdAt,
    };

    console.log(`\n  proposing ${formatUnits(BigInt(valueUSDC), 6)} USDC to ${RECIPIENT}`);
    console.log(`  claiming  tvl=${claimedTvl}`);
    if (mode === 'lie') console.log(`  (the pool actually reports ${tvl})`);

    // ── Sign the proposal. This is the only credential involved. ────────────
    signature = await account.signMessage({
      message: {
        raw: proposalDigest({
          chainId: BigInt(arcTestnet.id),
          vault,
          agent: account.address,
          proposalId: proposal.id,
          action: proposal.action,
          premises: proposal.premises,
          createdAt,
        }),
      },
    });
  }

  // ── Ask Bonded ────────────────────────────────────────────────────────────
  const res = await fetch(`${API}/api/v1/proposals`, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ proposal, signature }),
  });

  const text = await res.text();

  if (mode === 'rogue') {
    // The expected outcome is a refusal. Receiving a verdict here would mean
    // the API hands signatures to anyone who can sign, which is exactly what
    // the on-chain authorization exists to prevent.
    console.log(`\n  API responded ${res.status}`);
    console.log(`  ${text}`);
    if (res.ok) {
      console.error('\n  ✗ UNEXPECTED: an unauthorized agent received a verdict\n');
      process.exit(1);
    }
    console.log('\n  ✓ refused, as it must be — a valid signature is not authority\n');
    return;
  }

  if (!res.ok) {
    console.error(`\n  ✗ ${res.status} from the API\n`);
    console.error(text);
    process.exit(1);
  }

  const body = JSON.parse(text) as ApiVerdict;

  console.log(`\n  verdict   ${body.verdict.outcomeName} (${body.verdict.reasonName})`);
  console.log(`  premises re-derived at block ${body.evidence.pinnedBlock} via ${body.evidence.queryPath}:`);
  for (const p of body.premises) {
    console.log(`    ${p.passed ? '✓' : '✗'} ${p.premiseId}`);
    console.log(`        claimed    ${p.claimed}`);
    console.log(`        re-derived ${p.rederived ?? '(unresolvable)'}`);
  }
  console.log(`\n  ${body.settlement.note}`);

  // ── Settle it. The agent sends its own transaction. ───────────────────────
  const a = body.settlement.args;
  const before = await publicClient.readContract({
    address: usdc, abi: ERC20_ABI, functionName: 'balanceOf', args: [RECIPIENT],
  });

  console.log('\n  sending settle() from the agent key…');
  const hash = await walletClient.writeContract({
    address: vault,
    abi: VAULT_ABI,
    functionName: 'settle',
    args: [
      a[0] as `0x${string}`, a[1] as `0x${string}`, a[2], a[3],
      BigInt(a[4]), a[5] as `0x${string}`, a[6], a[7],
    ],
  });
  const receipt = await publicClient.waitForTransactionReceipt({ hash });
  if (receipt.status !== 'success') throw new Error(`reverted: ${hash}`);

  const after = await publicClient.readContract({
    address: usdc, abi: ERC20_ABI, functionName: 'balanceOf', args: [RECIPIENT],
  });

  console.log(`  ✓ block ${receipt.blockNumber} — ${explorerTx(hash)}`);
  console.log(`  recipient moved ${formatUnits(after - before, 6)} USDC`);

  if (body.verdict.outcome === 2) {
    // Park it so the identical proposal can be resubmitted after confirmation.
    // Rebuilding it later would change the id and the action hash, and the
    // vault binds the confirmation to both.
    mkdirSync(path.dirname(PENDING_FILE), { recursive: true });
    writeFileSync(PENDING_FILE, JSON.stringify({ proposal, signature }, null, 2), 'utf8');

    console.log(
      `\n  Held. The OWNER must now confirm ${body.verdict.proposalHash} from their own wallet:`,
    );
    console.log('    pnpm --filter @bonded/settlement owner-confirm');
    console.log('  then the agent resubmits the identical proposal:');
    console.log('    pnpm --filter @bonded/settlement agent resume');
  }

  if (mode === 'resume' && body.verdict.outcome === 0) {
    console.log('\n  The confirmed action settled.');
  }

  const credited = await publicClient.readContract({
    address: vault, abi: VAULT_ABI, functionName: 'balanceOf', args: [body.authority.owner as `0x${string}`],
  });
  console.log(`  owner still credited ${formatUnits(credited, 6)} USDC`);
  console.log(`  budget used ${formatUnits(BigInt(body.authority.spentThisPeriod), 6)} / ${formatUnits(BigInt(POLICY.budget.max), 6)} USDC this period\n`);
}

main().catch((err) => {
  console.error('\n  ✗', err instanceof Error ? err.message : err, '\n');
  process.exit(1);
});
