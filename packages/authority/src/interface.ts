import type { Verdict, Signature, Hash32 } from '@bonded/seam';

/**
 * IAuthority — abstract interface for the authority layer.
 *
 * This interface is identical regardless of whether Chainlink CRE or
 * Ledger is the implementation. The swap costs hours, not days.
 *
 * Current implementation: Chainlink CRE (handlerInTee)
 * Alternate:              Ledger Key Ring + DMK
 */
export interface IAuthority {
  /**
   * Sign a verdict using the enforcer's key (custodied inside the TEE).
   * Routine path — used for CLEARED and REFUSED verdicts.
   * Does not require human confirmation.
   */
  signVerdict(verdict: Verdict): Promise<Signature>;

  /**
   * Initiate a step-up confirmation for an irreversible action.
   * HELD_FOR_STEPUP path — requires out-of-band confirmation.
   * On Chainlink CRE: triggers workflow pause + confirmation gate.
   * On Ledger: triggers DMK WebHID session + device Clear Sign.
   *
   * Returns the confirmation signature once confirmed.
   */
  confirmStepUp(proposalHash: Hash32): Promise<Signature>;

  /**
   * Check if the authority layer is available and the key is accessible.
   */
  isAvailable(): Promise<boolean>;
}
