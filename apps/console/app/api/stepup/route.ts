import { createPublicClient, createWalletClient, defineChain, http, keccak256 } from 'viem';
import { privateKeyToAccount } from 'viem/accounts';
import { enforce, hashPolicy, type QueryFn } from '@bonded/enforcer';
import {
  createStandardizedQueryFn,
  executeQuery,
  KNOWN_DEPLOYMENTS,
  type GatewayConfig,
} from '@bonded/standardized';
import {
  VAULT_ABI,
  encodeTransferAction,
  verdictDigest,
  type Policy,
  type Proposal,
} from '@bonded/seam';
import { readFileSync } from 'node:fs';
import path from 'node:path';

/**
 * The step-up authorization gate, in two acts.
 *
 *   POST { phase: 'hold' }       run the real enforcer, and if it holds,
 *                                arm the gate on-chain
 *   POST { phase: 'authorize' }  record the human authorization on-chain,
 *                                then execute
 *
 * WHY THE SERVER RE-DERIVES EVERYTHING
 * The client never supplies verdict fields. It sends a phase and, for
 * authorize, a proposalHash that this process must already have armed. The
 * server signs only what its own enforce() produced, for an action it chose.
 * The alternative — signing a verdict posted by the browser — would let
 * anyone with the page open have the enrolled key sign a CLEARED transfer to
 * an address of their choosing, which is a vault drain with extra steps.
 *
 * PENDING is the memory of what was armed. An authorize for a hash that is
 * not in it is refused outright rather than reconstructed from the request.
 *
 * SIGNING IN THE WEB TIER
 * This route holds the enrolled signing key, which the rest of the console
 * deliberately does not. It is therefore off unless STEPUP_DEMO_SIGNING is
 * explicitly set. Never set it on a public deployment: anyone who can reach
 * the route can then move funds up to the policy budget. The long-term
 * answer is the key living in the CRE enclave and this route asking the
 * enclave to sign — see docs/CRE_ADAPTATION.md.
 */
export const dynamic = 'force-dynamic';

const SIGNING_ENABLED = process.env.STEPUP_DEMO_SIGNING === 'true';

const arcTestnet = defineChain({
  id: Number(process.env.ARC_CHAIN_ID ?? 5042002),
  name: 'Arc Testnet',
  nativeCurrency: { name: 'USDC', symbol: 'USDC', decimals: 18 },
  rpcUrls: { default: { http: [process.env.ARC_RPC_URL ?? ''] } },
});

const VAULT = (process.env.BONDED_VAULT_ADDRESS ?? '0x027C61c1418157b112B82F30894F8aC1F074AF85') as `0x${string}`;
const USDC = (process.env.USDC_ADDRESS ?? '0x3600000000000000000000000000000000000000') as `0x${string}`;
const REGISTRY = (process.env.BONDED_REGISTRY_ADDRESS ?? '0xB825225163aEf4353d0110BA63d0d811A17B8205') as `0x${string}`;
const LIVE_POOL_ID = '0x6c561b446416e1a00e8e93e221854d6ea4171372';
const RECIPIENT = '0x000000000000000000000000000000000000dEaD' as `0x${string}`;

/** Byte-identical to apps/console/app/api/enforce/route.ts and
    packages/settlement — a drift here means STALE_POLICY, loudly. */
const POLICY: Policy = {
  version: 1,
  budget: { asset: 'USDC', period: '7d', max: '500000000' },
  premises: [
    { id: 'tvl', schema: 'messari-dex-amm', field: 'liquidityPool.totalValueLockedUSD', op: 'gte', value: '50000000000000000000000000', tolerance_bps: 200 },
    { id: 'pool_age', schema: 'messari-dex-amm', field: 'liquidityPool.createdTimestamp', op: 'older_than', value: '2592000' },
  ],
  forbid: ['approve_unlimited', 'delegatecall', 'selfdestruct'],
  irreversible_above: '1000000',
};

/** 2 USDC — above the policy's 1 USDC irreversible_above, and small
    enough that the vault can actually cover the release. */
const DEMO_VALUE_USDC = 2_000_000n;

// ABI and digest both come from @bonded/seam, the single definition the
// contract tests recompute from first principles. This route used to carry its
// own copy of each, which is how the digest came to omit the action.
const ERC20_ABI = [
  { type: 'function', name: 'balanceOf', stateMutability: 'view', inputs: [{ type: 'address' }], outputs: [{ type: 'uint256' }] },
] as const;

const REGISTRY_ABI = [
  { type: 'function', name: 'currentPolicyHash', stateMutability: 'view', inputs: [{ type: 'address' }], outputs: [{ type: 'bytes32' }] },
] as const;

interface Armed {
  proposal: Proposal;
  policyHash: `0x${string}`;
  blockChecked: bigint;
  logRef: `0x${string}`;
}

/** What this process armed, and is therefore willing to authorize. Cleared
    on restart, which is correct: an unrecognised hash must be refused. */
const PENDING = new Map<string, Armed>();

interface Step {
  n: number;
  name: string;
  ok: boolean;
  detail: string;
  artifact: string | null;
  tx?: string;
}

/**
 * Read the enrolled key from the repo-root .env rather than expecting a copy
 * in apps/console/.env.local.
 *
 * Deliberate: the key already exists in exactly one file, and duplicating it
 * into a second one is the change that actually increases risk — two files to
 * keep out of git, two to rotate, two to forget about. This reads the
 * existing one and never writes it anywhere.
 *
 * ENFORCER_SIGNER_PRIVATE_KEY, not CRE_ETH_PRIVATE_KEY. The two held the same
 * value for part of this project's life and are not the same thing: the CRE
 * key is registered with Chainlink's platform and gets rotated independently,
 * while this one must derive BondedVault.enrolledSigner, which is immutable.
 * Sharing one name meant rotating the CRE key silently repointed vault
 * signing at an address the vault has never heard of — every settle() would
 * have reverted with BadSigner, and enforce() refused with STALE_POLICY
 * because it was reading the policy of a wallet that had never committed one.
 */
function account() {
  let raw = process.env.ENFORCER_SIGNER_PRIVATE_KEY;

  if (!raw) {
    try {
      const envPath = path.join(process.cwd(), '..', '..', '.env');
      const line = readFileSync(envPath, 'utf8')
        .split('\n')
        .find((l) => l.startsWith('ENFORCER_SIGNER_PRIVATE_KEY='));
      raw = line?.slice('ENFORCER_SIGNER_PRIVATE_KEY='.length).trim();
    } catch {
      // fall through to the error below — an unreadable .env is the same
      // situation as an unset key as far as this route is concerned
    }
  }

  if (!raw) {
    throw new Error(
      'ENFORCER_SIGNER_PRIVATE_KEY not found in the environment or in the repo-root .env',
    );
  }
  return privateKeyToAccount((raw.startsWith('0x') ? raw : `0x${raw}`) as `0x${string}`);
}

function clients() {
  const transport = http(process.env.ARC_RPC_URL);
  const acct = account();
  return {
    acct,
    pub: createPublicClient({ chain: arcTestnet, transport }),
    wallet: createWalletClient({ account: acct, chain: arcTestnet, transport }),
  };
}

async function liveQuery(): Promise<{ query: QueryFn; block: bigint }> {
  const apiKey = process.env.GRAPH_API_KEY;
  if (!apiKey) throw new Error('GRAPH_API_KEY not set');
  const config: GatewayConfig = {
    gatewayBaseUrl: process.env.GRAPH_GATEWAY_BASE_URL ?? 'https://gateway.thegraph.com/api',
    apiKey,
    subgraphId: KNOWN_DEPLOYMENTS['uniswap-v3-base'],
  };
  const meta = await executeQuery<{ _meta: { block: { number: number } } }>(
    config, 'query Head { _meta { block { number } } }', {},
  );
  const standardized = createStandardizedQueryFn({ 'messari-dex-amm': config });
  const query: QueryFn = (s, f, p, at) => standardized(s, f, { ...p, poolId: LIVE_POOL_ID }, at);
  return { query, block: BigInt(meta._meta.block.number) };
}

/** The digest BondedVault.settle recomputes, then EIP-191. The action hash is
    part of it, so a signature authorizes one exact payment. */
function digestFor(v: {
  agent: `0x${string}`;
  proposalHash: `0x${string}`; policyHash: `0x${string}`; outcome: number;
  reasonCode: number; blockChecked: bigint; logRef: `0x${string}`; action: `0x${string}`;
}) {
  return verdictDigest({
    chainId: BigInt(arcTestnet.id),
    vault: VAULT,
    agent: v.agent,
    proposalHash: v.proposalHash,
    policyHash: v.policyHash,
    outcome: v.outcome,
    reasonCode: v.reasonCode,
    blockChecked: v.blockChecked,
    logRef: v.logRef,
    actionHash: keccak256(v.action),
  });
}

function actionBytes(value: bigint) {
  return encodeTransferAction(RECIPIENT, value);
}

function fmtUSDC(v: bigint): string {
  return `${(v / 1_000_000n).toLocaleString('en-US')}.${(v % 1_000_000n).toString().padStart(6, '0').slice(0, 2)}`;
}

function stream(run: (send: (s: Step) => void) => Promise<void>): Response {
  const encoder = new TextEncoder();
  const body = new ReadableStream({
    async start(controller) {
      const send = (s: Step) => controller.enqueue(encoder.encode(JSON.stringify(s) + '\n'));
      try {
        await run(send);
      } catch (err) {
        send({ n: 0, name: 'Step-up', ok: false, detail: err instanceof Error ? err.message : String(err), artifact: null });
      } finally {
        controller.close();
      }
    },
  });
  return new Response(body, { headers: { 'content-type': 'application/x-ndjson; charset=utf-8', 'cache-control': 'no-store' } });
}

export async function POST(req: Request): Promise<Response> {
  const body = (await req.json().catch(() => ({}))) as { phase?: string; proposalHash?: string };

  if (!SIGNING_ENABLED) {
    return Response.json(
      {
        disabled: true,
        reason:
          'STEPUP_DEMO_SIGNING is not set. This route signs with the enrolled key, so it stays off unless explicitly enabled. Set STEPUP_DEMO_SIGNING=true in apps/console/.env.local to run it locally — never on a public deployment.',
      },
      { status: 503 },
    );
  }

  if (body.phase === 'hold') return holdPhase();
  if (body.phase === 'authorize') return authorizePhase(body.proposalHash ?? '');
  return Response.json({ error: "phase must be 'hold' or 'authorize'" }, { status: 400 });
}

function holdPhase(): Response {
  return stream(async (send) => {
    const { acct, pub, wallet } = clients();

    // ── 1. Re-derive premises and run the real enforcer ──────────────────
    const onchainPolicyHash = await pub.readContract({
      address: REGISTRY, abi: REGISTRY_ABI, functionName: 'currentPolicyHash', args: [acct.address],
    });
    const live = await liveQuery();
    const [tvl, poolAge] = await Promise.all([
      live.query('messari-dex-amm', 'liquidityPool.totalValueLockedUSD', { premiseId: 'tvl' }, live.block),
      live.query('messari-dex-amm', 'liquidityPool.createdTimestamp', { premiseId: 'pool_age' }, live.block),
    ]);
    if (tvl === null || poolAge === null) throw new Error('Gateway returned no premise — nothing armed');

    const now = Math.floor(Date.now() / 1000);
    const nonce = `stepup-${now}`;
    const proposal: Proposal = {
      id: `0x${Buffer.from(nonce).toString('hex').padEnd(64, '0').slice(0, 64)}` as `0x${string}`,
      agent: acct.address,
      createdAt: now,
      action: { kind: 'swap', target: RECIPIENT, calldata: '0x', valueUSDC: DEMO_VALUE_USDC.toString() },
      premises: [
        { premiseId: 'tvl', claimedValue: tvl },
        { premiseId: 'pool_age', claimedValue: poolAge },
      ],
    };

    const { verdict } = await enforce(proposal, POLICY, {
      onchainPolicyHash, currentBlock: live.block,
      currentTimestamp: now, spentThisPeriod: 0n,
    }, live.query);

    if (verdict.outcome !== 2) {
      send({ n: 1, name: 'Enforce', ok: false,
        detail: `expected HELD_FOR_STEPUP, enforcer returned outcome ${verdict.outcome} reasonCode ${verdict.reasonCode}. Nothing armed.`,
        artifact: null });
      return;
    }

    send({ n: 1, name: 'Enforce', ok: true,
      detail: `HELD_FOR_STEPUP — ${fmtUSDC(DEMO_VALUE_USDC)} USDC exceeds the ${fmtUSDC(BigInt(POLICY.irreversible_above))} USDC threshold. Every premise passed; the amount is what holds it.`,
      artifact: `proposal   ${verdict.proposalHash}\nreason     ${verdict.reasonCode} IRREVERSIBLE_UNCONFIRMED\nblock      ${verdict.blockChecked}\ntvl        claimed ${tvl}\n           derived ${tvl}` });

    // ── 2. Funding preflight, stated before anything is spent ────────────
    // The vault spends an OWNER's credited deposit, not whatever USDC happens
    // to sit at the address, so that is what has to be checked. A raw transfer
    // into the vault credits nobody and cannot be spent.
    const [credited, recordedOwner] = await Promise.all([
      pub.readContract({ address: VAULT, abi: VAULT_ABI, functionName: 'balanceOf', args: [acct.address] }),
      pub.readContract({ address: VAULT, abi: VAULT_ABI, functionName: 'ownerOf', args: [acct.address] }),
    ]);
    const authorized = recordedOwner !== '0x0000000000000000000000000000000000000000';
    const fundsOk = credited >= DEMO_VALUE_USDC;

    if (!authorized) {
      send({ n: 2, name: 'Vault preflight', ok: false,
        detail: `${acct.address} is not an authorized agent on this vault, so the vault will refuse to settle for it. Run: pnpm --filter @bonded/settlement fund-vault 5`,
        artifact: null });
      return;
    }

    send({ n: 2, name: 'Vault preflight', ok: fundsOk,
      detail: fundsOk
        ? `${fmtUSDC(credited)} USDC credited to this owner — enough to execute`
        : `${fmtUSDC(credited)} USDC credited to this owner, this action needs ${fmtUSDC(DEMO_VALUE_USDC)}. Arming and authorization are on-chain regardless; execution will be refused by the vault until it is funded.`,
      artifact: null });

    // ── 3. Arm the gate on-chain ─────────────────────────────────────────
    const armAction = actionBytes(DEMO_VALUE_USDC);
    const sig = await acct.signMessage({ message: { raw: digestFor({
      agent: acct.address,
      proposalHash: verdict.proposalHash, policyHash: verdict.policyHash,
      outcome: 2, reasonCode: verdict.reasonCode,
      blockChecked: verdict.blockChecked, logRef: verdict.logRef,
      action: armAction,
    }) } });

    const hash = await wallet.writeContract({
      address: VAULT, abi: VAULT_ABI, functionName: 'settle',
      args: [verdict.proposalHash, verdict.policyHash, 2, verdict.reasonCode,
             verdict.blockChecked, verdict.logRef, armAction, sig],
    });
    const receipt = await pub.waitForTransactionReceipt({ hash });
    if (receipt.status !== 'success') throw new Error(`arming reverted: ${hash}`);

    PENDING.set(verdict.proposalHash.toLowerCase(), {
      proposal, policyHash: verdict.policyHash,
      blockChecked: verdict.blockChecked, logRef: verdict.logRef,
    });

    send({ n: 3, name: 'Gate armed on-chain', ok: true,
      detail: `StepUpArmed recorded in block ${receipt.blockNumber}. The vault will now refuse to execute this proposal until a confirmation is recorded.`,
      artifact: verdict.proposalHash, tx: hash });
  });
}

function authorizePhase(proposalHash: string): Response {
  return stream(async (send) => {
    const armed = PENDING.get(proposalHash.toLowerCase());
    if (!armed) {
      send({ n: 4, name: 'Authorize', ok: false,
        detail: 'this proposal was not armed by this server process — refusing to sign a verdict it did not produce',
        artifact: null });
      return;
    }

    const { acct, pub, wallet } = clients();
    const hash32 = proposalHash as `0x${string}`;

    // ── 4. Record the human authorization on-chain ───────────────────────
    // confirmStepUp takes no signature: the vault requires the transaction to
    // come FROM the owner whose funds are at stake. It used to accept a
    // signature from enrolledSigner, which made the enforcer the confirmer of
    // its own holds — a human gate in name only.
    const confirmTx = await wallet.writeContract({
      address: VAULT, abi: VAULT_ABI, functionName: 'confirmStepUp', args: [hash32],
    });
    const confirmReceipt = await pub.waitForTransactionReceipt({ hash: confirmTx });
    if (confirmReceipt.status !== 'success') throw new Error(`confirmStepUp reverted: ${confirmTx}`);

    send({ n: 4, name: 'Authorization recorded on-chain', ok: true,
      detail: `StepUpConfirmed in block ${confirmReceipt.blockNumber}. The gate is open for this proposal only.`,
      artifact: null, tx: confirmTx });

    // ── 5. Execute — the vault decides, not us ───────────────────────────
    const credited = await pub.readContract({
      address: VAULT, abi: VAULT_ABI, functionName: 'balanceOf', args: [acct.address],
    });
    if (credited < DEMO_VALUE_USDC) {
      send({ n: 5, name: 'Execute', ok: false,
        detail: `not attempted — ${fmtUSDC(credited)} USDC is credited to this owner and this releases ${fmtUSDC(DEMO_VALUE_USDC)}. Sending it would revert and waste gas. Deposit more and the same authorization still stands; it is recorded on-chain.`,
        artifact: null });
      return;
    }

    // Exactly the action that was armed and confirmed. The vault compares its
    // hash against what it recorded at arm time and refuses anything else.
    const execAction = actionBytes(DEMO_VALUE_USDC);
    const clearedSig = await acct.signMessage({ message: { raw: digestFor({
      agent: acct.address,
      proposalHash: hash32, policyHash: armed.policyHash, outcome: 0, reasonCode: 0,
      blockChecked: armed.blockChecked, logRef: armed.logRef, action: execAction,
    }) } });
    const execTx = await wallet.writeContract({
      address: VAULT, abi: VAULT_ABI, functionName: 'settle',
      args: [hash32, armed.policyHash, 0, 0, armed.blockChecked, armed.logRef,
             execAction, clearedSig],
    });
    const execReceipt = await pub.waitForTransactionReceipt({ hash: execTx });
    if (execReceipt.status !== 'success') throw new Error(`execution reverted: ${execTx}`);

    PENDING.delete(proposalHash.toLowerCase());
    send({ n: 5, name: 'Executed', ok: true,
      detail: `${fmtUSDC(DEMO_VALUE_USDC)} USDC released in block ${execReceipt.blockNumber}.`,
      artifact: null, tx: execTx });
  });
}
