import { formatUnits, keccak256 } from 'viem';
import { enforce, hashPolicy } from '@bonded/enforcer';
import {
  ERC20_ABI,
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
import { POLICY, buildProposal, createLiveContext, type ScenarioId } from './policy.js';

/**
 * Settle one verdict on Arc testnet, end to end.
 *
 * This closes the last open loop in the system. Everything upstream of the
 * vault was already real — the enforcer, the live Graph re-derivation, the
 * deployed contracts, the subgraph — but nothing had ever called
 * BondedVault.settle(), so `verdictRecords` was empty and "the vault releases
 * USDC only against a signed Verdict" was a claim about Solidity rather than
 * something anyone could click.
 *
 * The sequence, with no step faked:
 *
 *   1. read the committed policy hash from BondedRegistry
 *   2. re-derive every premise from the live Graph Gateway at a pinned block
 *   3. run the real enforce() — the same function the unit tests call
 *   4. sign the verdict digest with the enrolled signer's key
 *   5. call settle() on Arc; the vault re-verifies the signature itself
 *
 * IT DOES NOT FORCE AN OUTCOME. If the enforcer refuses, this settles the
 * refusal — which is a real on-chain record that the refusal happened, and
 * moves no money. There is no path through this script that settles a CLEARED
 * verdict the enforcer did not produce.
 *
 * Usage:  pnpm --filter @bonded/settlement settle [scenario]
 *         scenario = legit | forbidden-action | tvl-lie | irreversible
 */

const SCENARIOS: ScenarioId[] = ['legit', 'forbidden-action', 'tvl-lie', 'irreversible'];
const OUTCOME_NAME = ['CLEARED', 'REFUSED', 'HELD_FOR_STEPUP'] as const;

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

function fail(msg: string): never {
  console.error(`\n  ✗ ${msg}\n`);
  process.exit(1);
}

async function main(): Promise<void> {
  const scenario = (process.argv[2] ?? 'legit') as ScenarioId;
  if (!SCENARIOS.includes(scenario)) {
    fail(`unknown scenario "${scenario}". One of: ${SCENARIOS.join(', ')}`);
  }

  const { account, publicClient, walletClient } = clients();
  const registry = addr('BONDED_REGISTRY_ADDRESS');
  const vault = addr('BONDED_VAULT_ADDRESS');
  const usdc = addr('USDC_ADDRESS');
  const apiKey = required('GRAPH_API_KEY');

  console.log('\n═══ BONDED — settle a verdict on Arc testnet ═══\n');
  console.log(`  scenario   ${scenario}`);
  console.log(`  signer     ${account.address}`);
  console.log(`  vault      ${vault}`);

  // ── 1. The policy must already be committed on-chain ──────────────────────
  const onchainPolicyHash = await publicClient.readContract({
    address: registry,
    abi: REGISTRY_ABI,
    functionName: 'currentPolicyHash',
    args: [account.address],
  });
  const localPolicyHash = hashPolicy(POLICY);

  console.log(`\n  policy hash (local)    ${localPolicyHash}`);
  console.log(`  policy hash (on-chain) ${onchainPolicyHash}`);

  if (localPolicyHash !== onchainPolicyHash) {
    fail(
      'policy hash mismatch — the vault would reject this settle.\n' +
        '    Run:  pnpm --filter @bonded/settlement commit-policy',
    );
  }
  console.log('  ✓ match');

  // ── 2 + 3. Re-derive from the live Graph, then run the real enforcer ──────
  console.log('\n  re-deriving premises from the Graph Gateway…');
  const live = await createLiveContext(apiKey);
  console.log(`  ✓ pinned at subgraph block ${live.block}`);

  const [tvl, poolAge] = await Promise.all([
    live.query('messari-dex-amm', 'liquidityPool.totalValueLockedUSD', { premiseId: 'tvl' }, live.block),
    live.query('messari-dex-amm', 'liquidityPool.createdTimestamp', { premiseId: 'pool_age' }, live.block),
  ]);
  if (tvl === null || poolAge === null) {
    fail('the Gateway did not return a premise. Fail-closed: nothing is settled.');
  }

  const proposal = buildProposal(scenario, { tvl, pool_age: poolAge }, account.address);

  const { verdict } = await enforce(
    proposal,
    POLICY,
    {
      onchainPolicyHash,
      currentBlock: live.block,
      currentTimestamp: Math.floor(Date.now() / 1000),
      spentThisPeriod: 0n,
    },
    live.query,
  );

  const outcomeName = OUTCOME_NAME[verdict.outcome];
  console.log(`\n  verdict    ${outcomeName}`);
  console.log(`  reason     ${verdict.reasonCode} — ${REASON_NAMES[verdict.reasonCode]}`);
  console.log(`  proposal   ${verdict.proposalHash}`);
  console.log(`  logRef     ${verdict.logRef}`);

  if (verdict.outcome === 2) {
    fail(
      'HELD_FOR_STEPUP. settle() only arms the step-up gate; releasing the funds\n' +
        '    needs confirmStepUp(), which requires a real enclave-custodied\n' +
        '    confirmation. Chainlink CRE is not deployed, so that path stops here —\n' +
        '    deliberately, and this script will not fake it.',
    );
  }

  const valueUSDC = BigInt(proposal.action.valueUSDC);

  // ── A CLEARED settle actually moves money, so check the vault can pay ─────
  if (verdict.outcome === 0) {
    const vaultBalance = await publicClient.readContract({
      address: usdc,
      abi: ERC20_ABI,
      functionName: 'balanceOf',
      args: [vault],
    });
    console.log(`\n  vault USDC ${formatUnits(vaultBalance, 6)}`);
    if (vaultBalance < valueUSDC) {
      fail(
        `vault holds ${formatUnits(vaultBalance, 6)} USDC, needs ${formatUnits(valueUSDC, 6)}.\n` +
          '    Run:  pnpm --filter @bonded/settlement fund-vault 5',
      );
    }
  }

  // ── 3b. The settling address must be an authorized agent ─────────────────
  // In this CLI the one key is enforcer, owner and agent at once, which is a
  // demo convenience rather than the intended split: in the product the owner
  // is a human wallet, the agent is a bot key, and the enforcer is neither.
  {
    const recordedOwner = await publicClient.readContract({
      address: vault, abi: VAULT_ABI, functionName: 'ownerOf', args: [account.address],
    });
    if (recordedOwner === '0x0000000000000000000000000000000000000000') {
      fail(
        `${account.address} is not an authorized agent on this vault.
` +
          '    Run:  pnpm --filter @bonded/settlement fund-vault 5',
      );
    }
  }

  // ── 4. Sign the digest the vault will recompute and verify ───────────────
  // The action is built FIRST, because its hash is part of what gets signed.
  // The digest binds the chain, the vault, the settling agent, the verdict and
  // the action, so this signature authorizes exactly one payment and cannot be
  // reused for a different target or amount. Definition lives in @bonded/seam;
  // the contract recomputes it in verdictDigest().
  const action = encodeTransferAction(proposal.action.target as `0x${string}`, valueUSDC);

  const digest = verdictDigest({
    chainId: BigInt(arcTestnet.id),
    vault,
    agent: account.address,
    proposalHash: verdict.proposalHash,
    policyHash: verdict.policyHash,
    outcome: verdict.outcome,
    reasonCode: verdict.reasonCode,
    blockChecked: verdict.blockChecked,
    logRef: verdict.logRef,
    actionHash: keccak256(action),
  });

  // EIP-191: viem's signMessage({ raw }) applies the same prefix the contract's
  // toEthSignedMessageHash() does.
  const enforcerSig = await account.signMessage({ message: { raw: digest } });

  // ── 5. Settle ─────────────────────────────────────────────────────────────
  console.log('\n  sending settle()…');
  const hash = await walletClient.writeContract({
    address: vault,
    abi: VAULT_ABI,
    functionName: 'settle',
    args: [
      verdict.proposalHash,
      verdict.policyHash,
      verdict.outcome,
      verdict.reasonCode,
      verdict.blockChecked,
      verdict.logRef,
      action,
      enforcerSig,
    ],
  });

  const receipt = await publicClient.waitForTransactionReceipt({ hash });
  if (receipt.status !== 'success') fail(`transaction reverted: ${hash}`);

  console.log(`\n  ✓ settled in block ${receipt.blockNumber}`);
  console.log(`    ${explorerTx(hash)}`);
  if (verdict.outcome === 0) {
    console.log(`    ${formatUnits(valueUSDC, 6)} USDC released to ${proposal.action.target}`);
  } else {
    console.log('    refusal recorded on-chain. No USDC moved — that is the point.');
  }
  console.log('\n  The subgraph will index this as a VerdictRecord; it appears on /log.\n');
}

main().catch((err) => {
  console.error('\n  ✗', err instanceof Error ? err.message : err, '\n');
  process.exit(1);
});
