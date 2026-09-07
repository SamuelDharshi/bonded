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
 * Used when running `cre simulate` locally.
 * Derives signatures from a local test key — NOT for production.
 * Document the cre simulate invocation in FEEDBACK/CHAINLINK.md.
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
