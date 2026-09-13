'use client';

import { useState } from 'react';
import { VAULT_ABI } from '@bonded/seam';
import { formatUSDC, parseUSDC, walletClient } from '../../../lib/bonded/wallet';
import { Button, Field, Input, Panel } from './primitives';
import { useOwner, type OwnerState } from './OwnerProvider';

const ERC20_ABI = [
  {
    type: 'function',
    name: 'approve',
    stateMutability: 'nonpayable',
    inputs: [
      { name: 'spender', type: 'address' },
      { name: 'amount', type: 'uint256' },
    ],
    outputs: [{ type: 'bool' }],
  },
] as const;

/**
 * Money in, money out, and what the week has used.
 *
 * Deposit is two transactions because ERC20 is: an approval, then the deposit
 * that pulls against it. Shown as two buttons rather than chained silently —
 * a wallet popping up twice with no warning is how people abandon a flow
 * halfway, leaving an approval granted and nothing deposited.
 */
export function FundsPanel({
  state,
  account,
  compact = false,
}: {
  state: OwnerState;
  account: `0x${string}`;
  /** Inside the wizard: deposit only, no withdrawal, no budget detail. */
  compact?: boolean;
}) {
  const { send, busy, setMessage } = useOwner();
  const [depositAmt, setDepositAmt] = useState('');
  const [withdrawAmt, setWithdrawAmt] = useState('');

  const credited = BigInt(state.funds.creditedToYou);
  const inWallet = BigInt(state.funds.inYourWallet);
  const allowance = BigInt(state.funds.allowanceToVault);
  const spent = BigInt(state.limits.spentThisPeriod);
  const budget = BigInt(state.limits.budgetMax);
  const disabled = busy !== null;

  function amountOr(input: string, onOk: (v: bigint) => void) {
    try {
      const v = parseUSDC(input);
      if (v === 0n) {
        setMessage({ kind: 'error', text: 'Enter an amount above zero.' });
        return;
      }
      onOk(v);
    } catch (err) {
      setMessage({ kind: 'error', text: (err as Error).message });
    }
  }

  return (
    <Panel
      title={compact ? 'Add spending money' : 'Funds'}
      note={
        compact
          ? 'Deposited USDC is credited to your address. Agents are never credited anything, so no agent key can withdraw it.'
          : 'Deposited USDC is credited to your address, and only your address can withdraw it — agents are never credited a balance, so there is no path from an agent key to your money. A plain transfer to the vault is credited to nobody and cannot be spent, which is why deposits go through deposit().'
      }
    >
      <Field label="credited to you" value={`${formatUSDC(credited)} USDC`} />
      <Field label="in your wallet" value={`${formatUSDC(inWallet)} USDC`} />
      <Field label="approved to the vault" value={`${formatUSDC(allowance)} USDC`} />
      {!compact && (
        <Field
          label="spent this 7-day period"
          value={`${formatUSDC(spent)} / ${formatUSDC(budget)} USDC`}
        />
      )}

      <div className={`grid gap-4 mt-4 ${compact ? '' : 'sm:grid-cols-2'}`}>
        <div className="space-y-2">
          <Input
            label="deposit"
            value={depositAmt}
            onChange={setDepositAmt}
            placeholder="5"
            hint={
              allowance > 0n
                ? `Approved so far: ${formatUSDC(allowance)} USDC. Approve again for more.`
                : 'Approve first — the vault can only pull what you have allowed.'
            }
          />
          <div className="flex gap-2">
            <Button
              disabled={disabled || depositAmt === ''}
              onClick={() =>
                amountOr(depositAmt, (amount) =>
                  void send('Approval', () =>
                    walletClient(account).writeContract({
                      address: state.usdc,
                      abi: ERC20_ABI,
                      functionName: 'approve',
                      args: [state.vault, amount],
                      chain: null,
                      account,
                    }),
                  ),
                )
              }
            >
              1 · Approve
            </Button>
            <Button
              tone="primary"
              disabled={disabled || depositAmt === ''}
              onClick={() =>
                amountOr(depositAmt, (amount) => {
                  if (amount > allowance) {
                    setMessage({
                      kind: 'error',
                      text: `Approve at least ${formatUSDC(amount)} USDC first — the vault can only pull what you allowed.`,
                    });
                    return;
                  }
                  if (amount > inWallet) {
                    setMessage({
                      kind: 'error',
                      text: `Your wallet holds ${formatUSDC(inWallet)} USDC.`,
                    });
                    return;
                  }
                  void send('Deposit', () =>
                    walletClient(account).writeContract({
                      address: state.vault,
                      abi: VAULT_ABI,
                      functionName: 'deposit',
                      args: [amount],
                      chain: null,
                      account,
                    }),
                  );
                })
              }
            >
              2 · Deposit
            </Button>
          </div>
        </div>

        {!compact && (
          <div className="space-y-2">
            <Input
              label="withdraw"
              value={withdrawAmt}
              onChange={setWithdrawAmt}
              placeholder="1"
              hint="Returns your own credited balance to your own address."
            />
            <div className="flex gap-2">
              <Button
                disabled={disabled || credited === 0n}
                onClick={() => setWithdrawAmt(formatUSDC(credited))}
              >
                All
              </Button>
              <Button
                disabled={disabled || withdrawAmt === '' || credited === 0n}
                onClick={() =>
                  amountOr(withdrawAmt, (amount) => {
                    if (amount > credited) {
                      setMessage({
                        kind: 'error',
                        text: `You are credited ${formatUSDC(credited)} USDC — cannot withdraw ${formatUSDC(amount)}.`,
                      });
                      return;
                    }
                    void send('Withdrawal', () =>
                      walletClient(account).writeContract({
                        address: state.vault,
                        abi: VAULT_ABI,
                        functionName: 'withdraw',
                        args: [amount],
                        chain: null,
                        account,
                      }),
                    );
                  })
                }
              >
                Withdraw
              </Button>
            </div>
          </div>
        )}
      </div>
    </Panel>
  );
}

export default FundsPanel;
