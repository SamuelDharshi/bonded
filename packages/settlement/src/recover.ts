import { encodeAbiParameters, encodePacked, formatUnits, keccak256 } from 'viem';
import { enforce, hashPolicy } from '@bonded/enforcer';
import { ERC20_ABI, REGISTRY_ABI, VAULT_ABI, addr, clients, explorerTx, required } from './chain.js';
import { POLICY, buildProposal, createLiveContext } from './policy.js';

/**
 * Drain a vault back to the enrolled signer.
 *
 * BondedVault has no withdraw function by design — USDC only leaves through
 * settle(), against a verdict the enforcer actually produced. So "recovering"
 * funds is not an escape hatch: it is the ordinary settlement path, pointed at
 * the signer instead of a counterparty, and it still has to satisfy every
 * premise and stay under the policy's thresholds like anything else.
 *
 * That constraint is why this drains in chunks at or below
 * policy.irreversible_above rather than in one transfer: a larger single
 * action would be held for step-up, which is correct behaviour and exactly
 * what this script must not route around.
 *
 * Needed when migrating to a redeployed vault, since enrolledSigner is
 * immutable and a new deployment cannot adopt the old one's balance.
 *
 * Usage: pnpm --filter @bonded/settlement recover
 */

const OUTCOME_NAME = ['CLEARED', 'REFUSED', 'HELD_FOR_STEPUP'] as const;

async function main(): Promise<void> {
  const { account, publicClient, walletClient } = clients();
  const vault = addr('BONDED_VAULT_ADDRESS');
  const registry = addr('BONDED_REGISTRY_ADDRESS');
  const usdc = addr('USDC_ADDRESS');
  const apiKey = required('GRAPH_API_KEY');

  console.log('\n═══ BONDED — recover vault balance to the enrolled signer ═══\n');
  console.log(`  vault   ${vault}`);
  console.log(`  signer  ${account.address}`);

  const onchainPolicyHash = await publicClient.readContract({
    address: registry, abi: REGISTRY_ABI, functionName: 'currentPolicyHash', args: [account.address],
  });
  if (hashPolicy(POLICY) !== onchainPolicyHash) {
    throw new Error('policy hash mismatch — run commit-policy first');
  }

  // One chunk per settle, capped at the threshold so each stays CLEARED.
  const chunk = BigInt(POLICY.irreversible_above);

  for (let round = 0; round < 20; round++) {
    const balance = await publicClient.readContract({
      address: usdc, abi: ERC20_ABI, functionName: 'balanceOf', args: [vault],
    });
    if (balance === 0n) {
      console.log('\n  ✓ vault is empty\n');
      return;
    }

    const amount = balance < chunk ? balance : chunk;
    console.log(`\n  vault holds ${formatUnits(balance, 6)} USDC — recovering ${formatUnits(amount, 6)}`);

    const live = await createLiveContext(apiKey);
    const [tvl, poolAge] = await Promise.all([
      live.query('messari-dex-amm', 'liquidityPool.totalValueLockedUSD', { premiseId: 'tvl' }, live.block),
      live.query('messari-dex-amm', 'liquidityPool.createdTimestamp', { premiseId: 'pool_age' }, live.block),
    ]);
    if (tvl === null || poolAge === null) throw new Error('Gateway returned no premise — nothing settled');

    // Same builder as every other settle, then retargeted to the signer and
    // resized to this chunk. Building it by hand here would be a second,
    // divergent definition of what a proposal looks like.
    const base = buildProposal('legit', { tvl, pool_age: poolAge }, account.address);
    const proposal = {
      ...base,
      action: { ...base.action, target: account.address, valueUSDC: amount.toString() },
    };

    const { verdict } = await enforce(proposal, POLICY, {
      onchainPolicyHash,
      currentBlock: live.block,
      currentTimestamp: Math.floor(Date.now() / 1000),
      spentThisPeriod: 0n,
    }, live.query);

    if (verdict.outcome !== 0) {
      throw new Error(
        `enforcer returned ${OUTCOME_NAME[verdict.outcome]} (reason ${verdict.reasonCode}) — not settling`,
      );
    }

    const digest = keccak256(encodePacked(
      ['bytes32', 'bytes32', 'uint8', 'uint16', 'uint64', 'bytes32'],
      [verdict.proposalHash, verdict.policyHash, 0, 0, verdict.blockChecked, verdict.logRef],
    ));
    const sig = await account.signMessage({ message: { raw: digest } });
    const action = encodeAbiParameters(
      [{ type: 'address' }, { type: 'bytes' }, { type: 'uint256' }],
      [account.address, '0x', amount],
    );

    const hash = await walletClient.writeContract({
      address: vault, abi: VAULT_ABI, functionName: 'settle',
      args: [verdict.proposalHash, verdict.policyHash, 0, 0, verdict.blockChecked, verdict.logRef, action, sig],
    });
    const receipt = await publicClient.waitForTransactionReceipt({ hash });
    if (receipt.status !== 'success') throw new Error(`reverted: ${hash}`);
    console.log(`  ✓ ${formatUnits(amount, 6)} USDC recovered — ${explorerTx(hash)}`);
  }

  throw new Error('stopped after 20 rounds — vault still not empty');
}

main().catch((err) => {
  console.error('\n  ✗', err instanceof Error ? err.message : err, '\n');
  process.exit(1);
});
