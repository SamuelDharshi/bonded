import { formatUnits, keccak256 } from 'viem';
import { enforce, hashPolicy } from '@bonded/enforcer';
import {
  REGISTRY_ABI,
  VAULT_ABI,
  addr,
  arcTestnet,
  clients,
  encodeTransferAction,
  explorerTx,
  required,
  verdictDigest,
} from './chain.js';
import { POLICY, buildProposal, createLiveContext } from './policy.js';

/**
 * Run the full step-up arc from the CLI: arm, confirm, execute.
 *
 * Three separate transactions, in an order the vault enforces rather than the
 * caller. It will not release on the confirmation alone, and it will not accept
 * the execution without a confirmation recorded first — and the confirmation is
 * bound to one exact action hash, so what was confirmed is what settles.
 *
 * The confirmation is a direct call from the OWNER. It takes no signature,
 * because a signature from the enforcer is what made the gate meaningless in
 * an earlier revision: the same key that signed the verdict also signed its own
 * release. Here the owner and agent happen to be the same key, which is a CLI
 * convenience — in the product the owner is a human wallet and the agent is a
 * bot key the owner authorized by address.
 *
 * Usage: pnpm --filter @bonded/settlement stepup
 */

const OUTCOME_NAME = ['CLEARED', 'REFUSED', 'HELD_FOR_STEPUP'] as const;
const ZERO = '0x0000000000000000000000000000000000000000';

async function main(): Promise<void> {
  const { account, publicClient, walletClient } = clients();
  const vault = addr('BONDED_VAULT_ADDRESS');
  const registry = addr('BONDED_REGISTRY_ADDRESS');
  const apiKey = required('GRAPH_API_KEY');

  console.log('\n═══ BONDED — step-up arc: arm, confirm, execute ═══\n');
  console.log(`  vault   ${vault}`);
  console.log(`  owner   ${account.address}`);

  // ── Preflight ─────────────────────────────────────────────────────────────
  const [recordedOwner, credited, onchainPolicyHash] = await Promise.all([
    publicClient.readContract({
      address: vault, abi: VAULT_ABI, functionName: 'ownerOf', args: [account.address],
    }),
    publicClient.readContract({
      address: vault, abi: VAULT_ABI, functionName: 'balanceOf', args: [account.address],
    }),
    publicClient.readContract({
      address: registry, abi: REGISTRY_ABI, functionName: 'currentPolicyHash', args: [account.address],
    }),
  ]);

  if (recordedOwner === ZERO) {
    throw new Error('not an authorized agent — run: pnpm --filter @bonded/settlement fund-vault 6');
  }
  if (hashPolicy(POLICY) !== onchainPolicyHash) {
    throw new Error('policy hash mismatch — run commit-policy first');
  }

  // ── The enforcer decides, against premises re-derived from the Graph ──────
  const live = await createLiveContext(apiKey);
  const [tvl, poolAge] = await Promise.all([
    live.query('messari-dex-amm', 'liquidityPool.totalValueLockedUSD', { premiseId: 'tvl' }, live.block),
    live.query('messari-dex-amm', 'liquidityPool.createdTimestamp', { premiseId: 'pool_age' }, live.block),
  ]);
  if (tvl === null || poolAge === null) throw new Error('Gateway returned no premise — nothing settled');

  const proposal = buildProposal('irreversible', { tvl, pool_age: poolAge }, account.address);
  const valueUSDC = BigInt(proposal.action.valueUSDC);

  const { verdict } = await enforce(proposal, POLICY, {
    onchainPolicyHash,
    currentBlock: live.block,
    currentTimestamp: Math.floor(Date.now() / 1000),
    spentThisPeriod: 0n,
  }, live.query);

  console.log(`\n  amount     ${formatUnits(valueUSDC, 6)} USDC`);
  console.log(`  threshold  ${formatUnits(BigInt(POLICY.irreversible_above), 6)} USDC`);
  console.log(`  verdict    ${OUTCOME_NAME[verdict.outcome]} (reason ${verdict.reasonCode})`);
  console.log(`  credited   ${formatUnits(credited, 6)} USDC`);

  if (verdict.outcome !== 2) {
    throw new Error(
      `expected HELD_FOR_STEPUP, enforcer returned ${OUTCOME_NAME[verdict.outcome]} — nothing armed`,
    );
  }

  // One action, hashed into every signature and into the hold itself.
  const action = encodeTransferAction(proposal.action.target as `0x${string}`, valueUSDC);

  const sign = (outcome: number, reasonCode: number) =>
    account.signMessage({
      message: {
        raw: verdictDigest({
          chainId: BigInt(arcTestnet.id),
          vault,
          agent: account.address,
          proposalHash: verdict.proposalHash,
          policyHash: verdict.policyHash,
          outcome,
          reasonCode,
          blockChecked: verdict.blockChecked,
          logRef: verdict.logRef,
          actionHash: keccak256(action),
        }),
      },
    });

  const send = async (label: string, run: () => Promise<`0x${string}`>) => {
    const hash = await run();
    const receipt = await publicClient.waitForTransactionReceipt({ hash });
    if (receipt.status !== 'success') throw new Error(`${label} reverted: ${hash}`);
    console.log(`  ✓ ${label} — block ${receipt.blockNumber}`);
    console.log(`    ${explorerTx(hash)}`);
    return hash;
  };

  // ── 1. Arm ────────────────────────────────────────────────────────────────
  console.log('\n  1. arming the gate…');
  const heldSig = await sign(2, verdict.reasonCode);
  await send('armed', () => walletClient.writeContract({
    address: vault, abi: VAULT_ABI, functionName: 'settle',
    args: [verdict.proposalHash, verdict.policyHash, 2, verdict.reasonCode,
           verdict.blockChecked, verdict.logRef, action, heldSig],
  }));

  // The vault must refuse to execute while the hold stands.
  const armed = await publicClient.readContract({
    address: vault, abi: VAULT_ABI, functionName: 'stepUpArmed', args: [verdict.proposalHash],
  });
  if (!armed) throw new Error('arming did not record — refusing to continue');

  // ── 2. Confirm, as the owner ───────────────────────────────────────────────
  console.log('\n  2. confirming as the owner…');
  await send('confirmed', () => walletClient.writeContract({
    address: vault, abi: VAULT_ABI, functionName: 'confirmStepUp', args: [verdict.proposalHash],
  }));

  // ── 3. Execute ────────────────────────────────────────────────────────────
  console.log('\n  3. executing the confirmed action…');
  const clearedSig = await sign(0, 0);
  await send('executed', () => walletClient.writeContract({
    address: vault, abi: VAULT_ABI, functionName: 'settle',
    args: [verdict.proposalHash, verdict.policyHash, 0, 0,
           verdict.blockChecked, verdict.logRef, action, clearedSig],
  }));

  const after = await publicClient.readContract({
    address: vault, abi: VAULT_ABI, functionName: 'balanceOf', args: [account.address],
  });
  console.log(`\n  ✓ ${formatUnits(valueUSDC, 6)} USDC released`);
  console.log(`    credited ${formatUnits(credited, 6)} -> ${formatUnits(after, 6)} USDC\n`);
}

main().catch((err) => {
  console.error('\n  ✗', err instanceof Error ? err.message : err, '\n');
  process.exit(1);
});
