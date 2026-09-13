'use client';

import { VAULT_ABI } from '@bonded/seam';
import { formatUSDC, walletClient } from '../../../lib/bonded/wallet';
import { Button, Field } from './primitives';
import { useOwner, type OwnerState } from './OwnerProvider';

/**
 * Push the committed policy's limits onto the vault.
 *
 * Two facts that nothing forced to agree: the policy artifact the enforcer reads,
 * and the limits the vault enforces. Change one without the other and the
 * enforcer clears a payment the vault then refuses — and that refusal arrives as
 * a bare `execution reverted` at settle time, with nothing pointing back at the
 * threshold that caused it.
 *
 * It happened here for real: a policy published with a 10 USDC threshold against
 * a vault still set to 1 USDC. The enforcer returned CLEARED for 2 USDC, the
 * settle reverted with IrreversibleNotConfirmed, and the two numbers were in
 * different systems with nothing reporting the gap.
 *
 * The vault stays authoritative — it is the thing holding the money, and it
 * should not take an off-chain artifact's word for its own limits. So this is an
 * explicit transaction from the owner, not an implicit sync.
 */
export function LimitsSync({ state, account }: { state: OwnerState; account: `0x${string}` }) {
  const { send, busy } = useOwner();

  const { policyIrreversibleAbove, policyBudgetMax, matchesPolicy } = state.limits;

  // Nothing published, or already in agreement.
  if (matchesPolicy !== false || !policyIrreversibleAbove || !policyBudgetMax) return null;

  return (
    <div className="border border-stamp/40 rounded-doc bg-stamp/5 px-5 py-5">
      <h2 className="font-mono text-small uppercase tracking-wide text-stamp">
        Your vault and your policy disagree
      </h2>

      <p className="text-body text-manifest/70 mt-2 max-w-2xl">
        The enforcer judges proposals against your policy; the vault decides what it will actually
        release. While these differ, a proposal can be cleared and then rejected on settlement — the
        agent sees <span className="font-mono">execution reverted</span> with nothing explaining why.
      </p>

      <div className="mt-4 grid gap-4 sm:grid-cols-2">
        <div>
          <p className="text-small text-manifest/50 mb-1">your policy says</p>
          <Field label="confirm above" value={`${formatUSDC(policyIrreversibleAbove)} USDC`} />
          <Field label="weekly budget" value={`${formatUSDC(policyBudgetMax)} USDC`} />
        </div>
        <div>
          <p className="text-small text-manifest/50 mb-1">the vault enforces</p>
          <Field label="confirm above" value={`${formatUSDC(state.limits.irreversibleAbove)} USDC`} />
          <Field label="weekly budget" value={`${formatUSDC(state.limits.budgetMax)} USDC`} />
        </div>
      </div>

      <div className="mt-5">
        <Button
          tone="primary"
          disabled={busy !== null}
          onClick={() =>
            void send('Limit update', () =>
              walletClient(account).writeContract({
                address: state.vault,
                abi: VAULT_ABI,
                functionName: 'setLimits',
                args: [BigInt(policyIrreversibleAbove), BigInt(policyBudgetMax)],
                chain: null,
                account,
              }),
            )
          }
        >
          Apply your policy&apos;s limits to the vault
        </Button>
      </div>

      <p className="text-small text-manifest/50 mt-3 max-w-2xl">
        One transaction from your wallet. The vault stays the authority on its own limits — it does
        not take an off-chain file&apos;s word for them, which is why this is a deliberate step
        rather than something the policy publish does quietly.
      </p>
    </div>
  );
}

export default LimitsSync;
