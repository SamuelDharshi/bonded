'use client';

import { VAULT_ABI } from '@bonded/seam';
import { formatUSDC, walletClient } from '../../../lib/bonded/wallet';
import { Addr, Button, Panel, TxLink } from './primitives';
import { useOwner, type OwnerState } from './OwnerProvider';

/**
 * The human gate.
 *
 * Its own page because it is the only thing in the product that is waiting on a
 * person, and burying it under four setup panels meant the one time-sensitive
 * item looked like the least important. The tab carries a count for the same
 * reason.
 *
 * Every figure shown was decoded from the arming transaction and checked against
 * the action hash the vault recorded, so an owner confirms a payment they can
 * actually see. Where that check fails it says so instead of showing a number it
 * cannot stand behind — confirming blind is how a confirmation step becomes
 * theatre.
 */
export function ApprovalsPanel({
  state,
  account,
}: {
  state: OwnerState;
  account: `0x${string}`;
}) {
  const { send, busy } = useOwner();
  const pending = state.holds.filter((h) => h.awaitingYourConfirmation);

  if (pending.length === 0) {
    return (
      <Panel title="Nothing waiting for you">
        <p className="text-small text-manifest/60 max-w-2xl">
          No payment is held. Anything above{' '}
          <span className="font-mono">{formatUSDC(state.limits.irreversibleAbove)} USDC</span> stops
          here and waits for your signature; smaller amounts settle on their own once every claimed
          fact has been re-derived and held up.
        </p>
      </Panel>
    );
  }

  return (
    <Panel
      title={`${pending.length} payment${pending.length > 1 ? 's' : ''} waiting for you`}
      note="Every premise passed — the amount is what held these. The vault will not release one until you confirm, and it accepts a confirmation only from your address: not a signature from the enforcer, and not from the agent. Confirming releases exactly the action shown and nothing else."
    >
      <div className="space-y-3">
        {pending.map((h) => (
          <div key={h.proposalHash} className="border border-hold/40 rounded-control bg-hold/5 px-4 py-3">
            <div className="flex flex-wrap items-baseline justify-between gap-3">
              <div className="text-small">
                <span className="font-mono text-manifest">
                  {h.valueUSDC ? `${formatUSDC(h.valueUSDC)} USDC` : 'amount unavailable'}
                </span>
                {h.recipient && (
                  <>
                    <span className="text-manifest/50"> to </span>
                    <Addr value={h.recipient} />
                  </>
                )}
                <span className="text-manifest/50">, proposed by </span>
                <Addr value={h.agent} />
              </div>
              <Button
                tone="primary"
                disabled={busy !== null}
                onClick={() =>
                  void send('Confirmation', () =>
                    walletClient(account).writeContract({
                      address: state.vault,
                      abi: VAULT_ABI,
                      functionName: 'confirmStepUp',
                      args: [h.proposalHash as `0x${string}`],
                      chain: null,
                      account,
                    }),
                  )
                }
              >
                Confirm this payment
              </Button>
            </div>

            {h.valueUSDC && h.amountVerifiedAgainstChain && (
              <p className="text-small text-manifest/50 mt-2">
                Amount and recipient were decoded from the arming transaction and matched against the
                action hash the vault recorded — this is what will move, and nothing else can.
              </p>
            )}
            {h.valueUSDC && !h.amountVerifiedAgainstChain && (
              <p className="text-small text-stamp mt-2">
                This amount could not be matched against the action hash the vault recorded, so treat
                it as unverified. Read the arming transaction before confirming.
              </p>
            )}

            <p className="text-small text-manifest/40 font-mono mt-2 break-all">
              {h.proposalHash}
              {h.armedTxHash && (
                <>
                  {' · '}
                  <TxLink hash={h.armedTxHash}>held in</TxLink>
                </>
              )}
            </p>
          </div>
        ))}
      </div>

      <p className="text-small text-manifest/50 mt-4 max-w-2xl">
        After you confirm, the agent resubmits the same proposal and settles it. The confirmation is
        bound to this exact action, so a different payment cannot ride on it.
      </p>
    </Panel>
  );
}

export default ApprovalsPanel;
