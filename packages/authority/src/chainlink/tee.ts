import type { IAuthority } from '../interface.js';
import type { Verdict, Signature, Hash32 } from '@bonded/seam';

/**
 * Chainlink CRE Authority — Confidential Workflow implementation.
 *
 * The enforcer's signing key exists ONLY inside the TEE.
 * Policy thresholds are evaluated confidentially — the thresholds themselves
 * are never exposed outside the enclave. A firewall whose rules are public
 * is a firewall you can binary-search.
 *
 * Two surfaces:
 * A. handlerInTee: confidential policy evaluation for routine CLEARED/REFUSED signing.
 *    The Graph API key and the enforcer signing key live here — never in .env.
 *
 * B. Workflow pause gate: for proposals above irreversibleAbove.
 *    The CRE workflow pauses and waits for human confirmation via CRE CLI
 *    before the TEE releases the step-up signature.
 *
 * Implementation note for hackathon:
 * - Use `cre simulate` to verify the handler before live deployment.
 * - The workflow ID and DON ID come from your CRE deployment config.
 * - Document the exact CRE CLI commands in FEEDBACK/CHAINLINK.md.
 */
export class ChainlinkCREAuthority implements IAuthority {
  // ── VERIFICATION STATUS — read before wiring this in ────────────────────
  //
  // VERIFIED (cre/stepup-threshold, simulated, both branches):
  //   The deployed workflow takes { proposalHash, proposalValueUSDC } over an
  //   HTTP trigger authorised by ECDSA EVM keys, reads the threshold as a
  //   Vault DON secret inside an AWS Nitro enclave, and returns
  //   { proposalHash, requiresStepUp } plus a signed DON report carrying
  //   (bytes32 proposalHash, bool requiresStepUp, uint64 evaluatedAt).
  //   requiresStepUp() below maps onto exactly that.
  //
  // NOT VERIFIED — the endpoints in signVerdict/confirmStepUp/isAvailable
  //   below were written ahead of deploy access and target paths
  //   (/api/v1/workflows/:id/sign, /stepup/arm, /stepup/status) that are NOT
  //   part of CRE's deployed HTTP-trigger surface. localhost:6688 is a
  //   Chainlink *node* operator port, not CRE's workflow invocation URL.
  //   Treat them as a sketch, not an integration.
  //
  // ARCHITECTURAL GAP, not just a wiring gap: signVerdict() cannot be
  //   satisfied by this workflow at all. The workflow computes a boolean; it
  //   never holds or uses the enforcer's verdict-signing key. Moving verdict
  //   signing into the enclave is a change to the workflow itself, not a
  //   configuration of this class. See docs/CRE_ADAPTATION.md.
  private readonly workflowId: string;
  private readonly donId: string;
  private readonly coreApiUrl: string;

  constructor(config: {
    workflowId: string;
    donId: string;
    coreApiUrl?: string;
  }) {
    this.workflowId  = config.workflowId;
    this.donId       = config.donId;
    this.coreApiUrl  = config.coreApiUrl ?? 'http://localhost:6688';
  }

  /**
   * The confidential threshold check — the one capability the deployed
   * workflow actually provides, shaped to drop straight into
   * EnforceContext.requiresStepUp in @bonded/enforcer.
   *
   * This is the whole point of the CRE layer: irreversible_above stays a
   * Vault DON secret inside the enclave, and only this boolean crosses back,
   * so the threshold cannot be binary-searched by probing the enforcer.
   *
   * Deliberately does NOT catch its own errors. enforce() treats a throw here
   * as ATTESTATION_MISSING and holds — an enclave that cannot be reached has
   * not said yes. Swallowing the error and returning false would convert an
   * outage into a silent auto-approval, which is the exact failure this
   * project exists to prevent.
   *
   * ONE THING TO FILL IN AT DEPLOY TIME: triggerUrl. Take it from
   * `cre workflow show stepup-threshold --target <target>` after deploying;
   * do not guess it. The request must be signed by a key listed in the
   * workflow's authorizedKeys (config.staging.json) or the trigger rejects it.
   */
  async requiresStepUp(input: {
    proposalHash: Hash32;
    valueUSDC: bigint;
  }): Promise<boolean> {
    const triggerUrl = this.httpTriggerUrl();

    const response = await fetch(triggerUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        proposalHash: input.proposalHash,
        // String, not a JS number: valueUSDC is 6-decimal fixed point and the
        // workflow parses it with BigInt(). JSON numbers would lose precision
        // above 2^53 and silently change which side of the threshold it lands.
        proposalValueUSDC: input.valueUSDC.toString(),
      }),
    });

    if (!response.ok) {
      throw new Error(
        `CRE stepup-threshold trigger failed: ${response.status} ${response.statusText}`,
      );
    }

    const body = (await response.json()) as { requiresStepUp?: boolean };
    if (typeof body.requiresStepUp !== 'boolean') {
      throw new Error('CRE stepup-threshold returned no boolean requiresStepUp');
    }
    return body.requiresStepUp;
  }

  /**
   * Not verified against a deployed workflow — see the VERIFICATION STATUS
   * block above. Kept as a single seam so there is exactly one place to
   * correct once `cre workflow show` gives the real trigger URL.
   */
  private httpTriggerUrl(): string {
    return `${this.coreApiUrl}/api/v1/workflows/${this.workflowId}/trigger`;
  }

  /**
   * Sign a verdict using the key custodied inside handlerInTee.
   *
   * In the live CRE implementation:
   * 1. The enforcer sends the verdict to the CRE workflow endpoint
   * 2. handlerInTee receives it, validates, and signs with the TEE-custodied key
   * 3. The signed verdict is returned and submitted to BondedVault.settle()
   *
   * For hackathon simulation: use cre simulate to run the handler locally.
   */
  async signVerdict(verdict: Verdict): Promise<Signature> {
    const response = await fetch(`${this.coreApiUrl}/api/v1/workflows/${this.workflowId}/sign`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        proposalHash:  verdict.proposalHash,
        policyHash:    verdict.policyHash,
        outcome:       verdict.outcome,
        reasonCode:    verdict.reasonCode,
        blockChecked:  verdict.blockChecked.toString(),
        logRef:        verdict.logRef,
      }),
    });

    if (!response.ok) {
      throw new Error(`CRE signVerdict failed: ${response.status} ${response.statusText}`);
    }

    const { signature } = (await response.json()) as { signature: string };
    return signature as Signature;
  }

  /**
   * Initiate a step-up confirmation gate.
   *
   * In the live CRE implementation:
   * 1. The CRE workflow pauses at the confirmation gate
   * 2. A human reviews the proposal via the console UI
   * 3. They confirm via CRE CLI: `cre workflow confirm <proposalHash>`
   * 4. The TEE releases the step-up signature
   *
   * This is the Chainlink equivalent of Ledger's DMK Clear Sign flow.
   */
  async confirmStepUp(proposalHash: Hash32): Promise<Signature> {
    // Arm the step-up gate in the CRE workflow
    const armResponse = await fetch(
      `${this.coreApiUrl}/api/v1/workflows/${this.workflowId}/stepup/arm`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ proposalHash }),
      },
    );

    if (!armResponse.ok) {
      throw new Error(`CRE stepup arm failed: ${armResponse.status}`);
    }

    // Poll for confirmation (in production: webhook or event-driven)
    // For hackathon: poll with backoff
    const confirmSig = await this.pollForConfirmation(proposalHash);
    return confirmSig;
  }

  private async pollForConfirmation(
    proposalHash: Hash32,
    maxAttempts = 60,
    intervalMs  = 5000,
  ): Promise<Signature> {
    for (let attempt = 0; attempt < maxAttempts; attempt++) {
      await new Promise((resolve) => setTimeout(resolve, intervalMs));

      const response = await fetch(
        `${this.coreApiUrl}/api/v1/workflows/${this.workflowId}/stepup/status/${proposalHash}`,
      );

      if (!response.ok) continue;

      const status = (await response.json()) as { confirmed: boolean; signature?: string };
      if (status.confirmed && status.signature) {
        return status.signature as Signature;
      }
    }

    throw new Error(`Step-up confirmation timed out for ${proposalHash}`);
  }

  async isAvailable(): Promise<boolean> {
    try {
      const response = await fetch(`${this.coreApiUrl}/api/v1/health`, {
        signal: AbortSignal.timeout(3000),
      });
      return response.ok;
    } catch {
      return false;
    }
  }
}

/**
 * CRE Simulation Mode
 *
 * WARNING — what this returns is NOT an ECDSA signature. It is an HMAC-SHA256
 * digest shaped like one. BondedVault.settle() and confirmStepUp() both call
 * ecrecover on their input, so anything produced here is rejected on-chain,
 * as it should be. This class is a placeholder for local flow-testing only;
 * it cannot be promoted to a real path by changing configuration, and nothing
 * that touches a real chain should accept its output.
 *
 * For the genuine local path, use `cre workflow simulate` against
 * cre/stepup-threshold — that exercises the real handler in the real SDK.
 */
export class CRESimulationAuthority implements IAuthority {
  private readonly signingKey: string;

  constructor(signingKey: string) {
    this.signingKey = signingKey;
  }

  async signVerdict(_verdict: Verdict): Promise<Signature> {
    // In simulation: sign the verdict digest with a local test key.
    // Replace with actual cre simulate integration.
    const { createHmac } = await import('crypto');
    const digest = createHmac('sha256', this.signingKey)
      .update(JSON.stringify({ ..._verdict, blockChecked: _verdict.blockChecked.toString() }))
      .digest('hex');
    return `0x${digest}` as Signature;
  }

  async confirmStepUp(proposalHash: Hash32): Promise<Signature> {
    const { createHmac } = await import('crypto');
    const digest = createHmac('sha256', this.signingKey)
      .update(`STEPUP:${proposalHash}`)
      .digest('hex');
    return `0x${digest}` as Signature;
  }

  async isAvailable(): Promise<boolean> {
    return true; // Always available in simulation
  }
}
