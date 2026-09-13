import { formatUnits, parseUnits } from 'viem';
import { ERC20_ABI, VAULT_ABI, addr, clients, explorerTx } from './chain.js';

/**
 * Prepare the vault for settlement: credit a deposit to this address and make
 * sure it is an authorized agent.
 *
 * A raw USDC transfer into the vault is deliberately NOT credited to anyone —
 * the vault tracks per-owner balances so one owner's agent can never spend
 * another owner's funds, and an uncredited transfer has no owner to attribute.
 * That is why this goes through approve + deposit() instead of transfer().
 *
 * In this CLI one key is owner, agent and enforcer at once. That is a demo
 * convenience, not the model: in the product the owner is a human wallet, the
 * agent is a bot key the owner authorizes by address, and the enforcer signing
 * key is neither of them.
 *
 * Idempotent — safe to re-run. Usage:
 *   pnpm --filter @bonded/settlement fund-vault <amount-in-usdc>
 */

const ZERO = '0x0000000000000000000000000000000000000000';

async function main(): Promise<void> {
  const amountArg = process.argv[2];
  if (!amountArg) throw new Error('usage: fund-vault <amount-in-usdc>, e.g. fund-vault 5');

  const { account, publicClient, walletClient } = clients();
  const usdc = addr('USDC_ADDRESS');
  const vault = addr('BONDED_VAULT_ADDRESS');
  const amount = parseUnits(amountArg, 6);

  console.log('\n═══ BONDED — fund the vault ═══\n');
  console.log(`  vault   ${vault}`);
  console.log(`  owner   ${account.address}`);

  // ── 1. Authorize this address as an agent, if it is not already ───────────
  const recordedOwner = await publicClient.readContract({
    address: vault, abi: VAULT_ABI, functionName: 'ownerOf', args: [account.address],
  });

  if (recordedOwner === ZERO) {
    console.log('\n  authorizing this address as an agent of itself…');
    const authTx = await walletClient.writeContract({
      address: vault, abi: VAULT_ABI, functionName: 'authorizeAgent', args: [account.address],
    });
    const authReceipt = await publicClient.waitForTransactionReceipt({ hash: authTx });
    if (authReceipt.status !== 'success') throw new Error(`authorizeAgent reverted: ${authTx}`);
    console.log(`  ✓ authorized — ${explorerTx(authTx)}`);
  } else if (recordedOwner.toLowerCase() !== account.address.toLowerCase()) {
    throw new Error(
      `this address is already an agent of ${recordedOwner}, not of itself. ` +
        'Settling would draw on that owner’s balance; refusing.',
    );
  } else {
    console.log('\n  already an authorized agent — nothing to do');
  }

  // ── 2. Approve, then deposit ──────────────────────────────────────────────
  const walletBalance = await publicClient.readContract({
    address: usdc, abi: ERC20_ABI, functionName: 'balanceOf', args: [account.address],
  });
  console.log(`\n  wallet holds    ${formatUnits(walletBalance, 6)} USDC`);
  if (walletBalance < amount) {
    throw new Error(`wallet holds ${formatUnits(walletBalance, 6)} USDC, needs ${amountArg}`);
  }

  const allowance = await publicClient.readContract({
    address: usdc, abi: ERC20_ABI, functionName: 'allowance', args: [account.address, vault],
  });
  if (allowance < amount) {
    console.log(`  approving       ${formatUnits(amount, 6)} USDC to the vault…`);
    const approveTx = await walletClient.writeContract({
      address: usdc, abi: ERC20_ABI, functionName: 'approve', args: [vault, amount],
    });
    const approveReceipt = await publicClient.waitForTransactionReceipt({ hash: approveTx });
    if (approveReceipt.status !== 'success') throw new Error(`approve reverted: ${approveTx}`);
    console.log(`  ✓ approved — ${explorerTx(approveTx)}`);
  }

  console.log(`  depositing      ${formatUnits(amount, 6)} USDC…`);
  const hash = await walletClient.writeContract({
    address: vault, abi: VAULT_ABI, functionName: 'deposit', args: [amount],
  });
  const receipt = await publicClient.waitForTransactionReceipt({ hash });
  if (receipt.status !== 'success') throw new Error(`deposit reverted: ${hash}`);

  // ── 3. Report both numbers — they should agree ─────────────────────────────
  const [credited, held, uncredited] = await Promise.all([
    publicClient.readContract({
      address: vault, abi: VAULT_ABI, functionName: 'balanceOf', args: [account.address],
    }),
    publicClient.readContract({
      address: usdc, abi: ERC20_ABI, functionName: 'balanceOf', args: [vault],
    }),
    publicClient.readContract({
      address: vault, abi: VAULT_ABI, functionName: 'uncredited', args: [],
    }),
  ]);

  console.log(`\n  ✓ credited to you   ${formatUnits(credited, 6)} USDC`);
  console.log(`    vault holds       ${formatUnits(held, 6)} USDC`);
  if (uncredited > 0n) {
    console.log(
      `    uncredited        ${formatUnits(uncredited, 6)} USDC — arrived by raw transfer, ` +
        'not spendable and not withdrawable',
    );
  }
  console.log(`    ${explorerTx(hash)}\n`);
}

main().catch((err) => { console.error('\n  ✗', err instanceof Error ? err.message : err, '\n'); process.exit(1); });
