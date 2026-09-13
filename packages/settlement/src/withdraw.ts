import { formatUnits, parseUnits } from 'viem';
import { ERC20_ABI, VAULT_ABI, addr, clients, explorerTx } from './chain.js';

/**
 * Withdraw your own credited balance out of the vault.
 *
 * Not an escape hatch around the enforcer, which is why it can exist at all:
 * it returns a depositor's own funds to the depositor's own address, and an
 * agent key cannot reach it because agents are never credited a balance. There
 * is still no path by which anyone moves money *to a third party* without a
 * verdict.
 *
 * Replaces the legacy `recover` script for any vault with deposit accounting.
 *
 * Usage:
 *   pnpm --filter @bonded/settlement withdraw <amount-in-usdc>
 *   pnpm --filter @bonded/settlement withdraw all
 */
async function main(): Promise<void> {
  const amountArg = process.argv[2];
  if (!amountArg) {
    throw new Error('usage: withdraw <amount-in-usdc | all>, e.g. withdraw 2  |  withdraw all');
  }

  const { account, publicClient, walletClient } = clients();
  const vault = addr('BONDED_VAULT_ADDRESS');
  const usdc = addr('USDC_ADDRESS');

  const credited = await publicClient.readContract({
    address: vault, abi: VAULT_ABI, functionName: 'balanceOf', args: [account.address],
  });

  console.log('\n═══ BONDED — withdraw from the vault ═══\n');
  console.log(`  vault             ${vault}`);
  console.log(`  you               ${account.address}`);
  console.log(`  credited to you   ${formatUnits(credited, 6)} USDC`);

  if (credited === 0n) {
    console.log('\n  nothing credited to this address — nothing to withdraw\n');
    return;
  }

  const amount = amountArg === 'all' ? credited : parseUnits(amountArg, 6);
  if (amount > credited) {
    throw new Error(
      `you are credited ${formatUnits(credited, 6)} USDC, cannot withdraw ${formatUnits(amount, 6)}`,
    );
  }

  console.log(`  withdrawing       ${formatUnits(amount, 6)} USDC`);

  const hash = await walletClient.writeContract({
    address: vault, abi: VAULT_ABI, functionName: 'withdraw', args: [amount],
  });
  const receipt = await publicClient.waitForTransactionReceipt({ hash });
  if (receipt.status !== 'success') throw new Error(`withdraw reverted: ${hash}`);

  const [remaining, wallet] = await Promise.all([
    publicClient.readContract({
      address: vault, abi: VAULT_ABI, functionName: 'balanceOf', args: [account.address],
    }),
    publicClient.readContract({
      address: usdc, abi: ERC20_ABI, functionName: 'balanceOf', args: [account.address],
    }),
  ]);

  console.log(`\n  ✓ withdrawn`);
  console.log(`    still credited  ${formatUnits(remaining, 6)} USDC`);
  console.log(`    wallet now      ${formatUnits(wallet, 6)} USDC`);
  console.log(`    ${explorerTx(hash)}\n`);
}

main().catch((err) => { console.error('\n  ✗', err instanceof Error ? err.message : err, '\n'); process.exit(1); });
