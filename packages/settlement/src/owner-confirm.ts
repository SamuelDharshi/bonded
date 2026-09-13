import { VAULT_ABI, addr, clients, explorerTx } from './chain.js';

/**
 * Confirm a held proposal, as the owner.
 *
 * This is the human gate. The vault requires the transaction to come FROM the
 * owner whose funds are at stake — no signature is accepted in its place,
 * because an earlier revision took one from the enforcer and that made the gate
 * the enforcer approving its own holds.
 *
 * Stands in for the browser flow while the console has no wallet connection.
 * The action is identical either way: one call, from the owner key.
 *
 * Usage:
 *   pnpm --filter @bonded/settlement owner-confirm [proposalHash]
 *
 * With no argument it reads the hash from .pending-proposal.json.
 */
import { readFileSync, existsSync } from 'node:fs';
import path from 'node:path';

const PENDING_FILE = path.join(process.cwd(), '.pending-proposal.json');

async function main(): Promise<void> {
  const { account, publicClient, walletClient } = clients();
  const vault = addr('BONDED_VAULT_ADDRESS');

  let hash = process.argv[2] as `0x${string}` | undefined;
  if (!hash) {
    if (!existsSync(PENDING_FILE)) {
      throw new Error('no proposalHash given and no .pending-proposal.json to read one from');
    }
    const pending = JSON.parse(readFileSync(PENDING_FILE, 'utf8')) as { proposal?: { id: `0x${string}` } };
    hash = pending.proposal?.id;
    if (!hash) throw new Error('.pending-proposal.json has no proposal to confirm');
  }

  console.log('\n=== BONDED - confirm a held proposal, as the owner ===\n');
  console.log(`  vault     ${vault}`);
  console.log(`  owner     ${account.address}`);
  console.log(`  proposal  ${hash}`);

  const [armed, confirmed, mustBe] = await Promise.all([
    publicClient.readContract({ address: vault, abi: VAULT_ABI, functionName: 'stepUpArmed', args: [hash] }),
    publicClient.readContract({ address: vault, abi: VAULT_ABI, functionName: 'stepUpConfirmed', args: [hash] }),
    publicClient.readContract({ address: vault, abi: VAULT_ABI, functionName: 'stepUpOwner', args: [hash] }),
  ]);

  if (!armed) throw new Error('that proposal is not armed — nothing to confirm');
  if (confirmed) {
    console.log('\n  already confirmed - nothing to do\n');
    return;
  }
  if (mustBe.toLowerCase() !== account.address.toLowerCase()) {
    throw new Error(
      `only ${mustBe} can confirm this hold, and this key is ${account.address}. ` +
        'That restriction is the gate.',
    );
  }

  const tx = await walletClient.writeContract({
    address: vault, abi: VAULT_ABI, functionName: 'confirmStepUp', args: [hash],
  });
  const receipt = await publicClient.waitForTransactionReceipt({ hash: tx });
  if (receipt.status !== 'success') throw new Error(`confirmStepUp reverted: ${tx}`);

  console.log(`\n  confirmed in block ${receipt.blockNumber}`);
  console.log(`    ${explorerTx(tx)}`);
  console.log('\n  The agent can now resubmit the identical proposal:');
  console.log('    pnpm --filter @bonded/settlement agent resume\n');
}

main().catch((err) => {
  console.error('\n  x', err instanceof Error ? err.message : err, '\n');
  process.exit(1);
});
