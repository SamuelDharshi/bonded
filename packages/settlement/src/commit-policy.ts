import { hashPolicy } from '@bonded/enforcer';
import { REGISTRY_ABI, addr, clients, explorerTx } from './chain.js';
import { POLICY } from './policy.js';

/**
 * Commit the policy artifact's hash to BondedRegistry.
 *
 * The registry stores a hash per agent address, versioned and monotonic. The
 * artifact itself is never uploaded — only its hash — so the on-chain record
 * proves which policy was in force without publishing the thresholds.
 *
 * settle() reads currentPolicyHash(msg.sender) and rejects any verdict whose
 * policyHash disagrees, which is what makes a policy change visible rather
 * than silent: change the artifact without committing it and every subsequent
 * proposal refuses with STALE_POLICY.
 */
async function main(): Promise<void> {
  const { account, publicClient, walletClient } = clients();
  const registry = addr('BONDED_REGISTRY_ADDRESS');
  const policyHash = hashPolicy(POLICY);

  const current = await publicClient.readContract({
    address: registry, abi: REGISTRY_ABI, functionName: 'currentPolicyHash', args: [account.address],
  });

  console.log('\n═══ BONDED — commit policy ═══\n');
  console.log(`  agent      ${account.address}`);
  console.log(`  current    ${current}`);
  console.log(`  new        ${policyHash}`);

  if (current === policyHash) {
    console.log('\n  ✓ already committed — nothing to do.\n');
    return;
  }

  const hash = await walletClient.writeContract({
    address: registry, abi: REGISTRY_ABI, functionName: 'commitPolicy', args: [policyHash],
  });
  const receipt = await publicClient.waitForTransactionReceipt({ hash });
  if (receipt.status !== 'success') throw new Error(`reverted: ${hash}`);

  const version = await publicClient.readContract({
    address: registry, abi: REGISTRY_ABI, functionName: 'policyVersion', args: [account.address],
  });

  console.log(`\n  ✓ committed as version ${version} in block ${receipt.blockNumber}`);
  console.log(`    ${explorerTx(hash)}\n`);
}

main().catch((err) => { console.error('\n  ✗', err instanceof Error ? err.message : err, '\n'); process.exit(1); });
