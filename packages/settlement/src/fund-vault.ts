import { formatUnits, parseUnits } from 'viem';
import { ERC20_ABI, addr, clients, explorerTx } from './chain.js';

/**
 * Move USDC from the signer into BondedVault so a CLEARED verdict has funds to
 * release. Deliberately a separate, explicit step — the settle script will
 * refuse and tell you to run this rather than quietly topping the vault up as
 * a side effect of settling.
 *
 * Usage: pnpm --filter @bonded/settlement fund-vault <amount-in-usdc>
 */
async function main(): Promise<void> {
  const amountArg = process.argv[2];
  if (!amountArg) throw new Error('usage: fund-vault <amount-in-usdc>, e.g. fund-vault 5');

  const { account, publicClient, walletClient } = clients();
  const usdc = addr('USDC_ADDRESS');
  const vault = addr('BONDED_VAULT_ADDRESS');
  const amount = parseUnits(amountArg, 6);

  const balance = await publicClient.readContract({
    address: usdc, abi: ERC20_ABI, functionName: 'balanceOf', args: [account.address],
  });

  console.log('\n═══ BONDED — fund the vault ═══\n');
  console.log(`  signer balance  ${formatUnits(balance, 6)} USDC`);
  console.log(`  transferring    ${formatUnits(amount, 6)} USDC -> ${vault}`);

  if (balance < amount) throw new Error(`signer holds ${formatUnits(balance, 6)} USDC, needs ${amountArg}`);

  const hash = await walletClient.writeContract({
    address: usdc, abi: ERC20_ABI, functionName: 'transfer', args: [vault, amount],
  });
  const receipt = await publicClient.waitForTransactionReceipt({ hash });
  if (receipt.status !== 'success') throw new Error(`reverted: ${hash}`);

  const vaultBalance = await publicClient.readContract({
    address: usdc, abi: ERC20_ABI, functionName: 'balanceOf', args: [vault],
  });
  console.log(`\n  ✓ vault now holds ${formatUnits(vaultBalance, 6)} USDC`);
  console.log(`    ${explorerTx(hash)}\n`);
}

main().catch((err) => { console.error('\n  ✗', err instanceof Error ? err.message : err, '\n'); process.exit(1); });
