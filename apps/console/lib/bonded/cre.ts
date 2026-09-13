import { createHash } from 'node:crypto';
import { randomUUID } from 'node:crypto';
import type { PrivateKeyAccount } from 'viem/accounts';

/**
 * Client for the deployed Chainlink CRE confidential workflow.
 *
 * This is the call that makes the Authority layer real rather than merely
 * deployed. `requiresStepUp` asks the enclave "is this amount over the line?"
 * and receives only a boolean — the threshold itself stays inside an AWS Nitro
 * enclave, released there by the Vault DON and never returned. A threshold an
 * attacker can read is a threshold they can binary-search by probing with 0.9,
 * 1.0, 1.1 until the refusals change.
 *
 * Auth is a JWT signed with the agent key, not a bearer secret: the workflow's
 * `authorizedKeys` lists the enforcer's address, so the right to invoke it is
 * proven by signing rather than by possessing a token someone could copy.
 *
 * Endpoint and JWT shape per Chainlink's "Triggering Deployed Workflows" guide.
 * The workflow is registered on the on-chain registry, so the public gateway
 * applies; a private-registry deployment uses the enterprise host instead.
 */

const PUBLIC_GATEWAY = 'https://01.gateway.zone-a.cre.chain.link';

export interface StepUpAnswer {
  requiresStepUp: boolean;
  /** Echoed back by the workflow so a response cannot be paired with the wrong proposal. */
  proposalHash: string;
}

function base64url(input: Buffer | string): string {
  return Buffer.from(input)
    .toString('base64')
    .replace(/\+/g, '-')
    .replace(/\//g, '_')
    .replace(/=+$/, '');
}

/**
 * Serialize with keys in ascending lexicographic order, recursively.
 *
 * The gateway hashes the request body this way, so the digest inside the JWT
 * must be computed over the identical byte sequence. `JSON.stringify` preserves
 * insertion order, which would produce a different hash for the same object and
 * fail as an opaque 401.
 */
function canonicalize(value: unknown): unknown {
  if (Array.isArray(value)) return value.map(canonicalize);
  if (value && typeof value === 'object') {
    const out: Record<string, unknown> = {};
    for (const key of Object.keys(value as Record<string, unknown>).sort()) {
      out[key] = canonicalize((value as Record<string, unknown>)[key]);
    }
    return out;
  }
  return value;
}

/** The JWT the gateway accepts: ETH-algorithm, signed EIP-191 by an authorized key. */
async function buildJwt(account: PrivateKeyAccount, body: unknown): Promise<string> {
  const digest = `0x${createHash('sha256').update(JSON.stringify(canonicalize(body)), 'utf8').digest('hex')}`;

  const now = Math.floor(Date.now() / 1000);
  const header = base64url(JSON.stringify({ alg: 'ETH', typ: 'JWT' }));
  const payload = base64url(
    JSON.stringify({
      digest,
      iss: account.address,
      iat: now,
      // Short window: this token authorizes one call and should not outlive it.
      exp: now + 300,
      jti: randomUUID(),
    }),
  );

  const signature = await account.signMessage({ message: `${header}.${payload}` });
  return `${header}.${payload}.${base64url(Buffer.from(signature.slice(2), 'hex'))}`;
}

/**
 * Ask the enclave whether an amount needs human confirmation.
 *
 * Throws on any failure — unreachable gateway, rejected JWT, malformed reply.
 * That is deliberate and load-bearing: `enforce()` treats a throw from
 * `requiresStepUp` as ATTESTATION_MISSING and HOLDS the proposal. An enclave
 * that cannot be reached must never be able to clear a payment.
 */
export async function creRequiresStepUp(
  account: PrivateKeyAccount,
  proposalHash: string,
  valueUSDC: bigint,
): Promise<StepUpAnswer> {
  const workflowID = process.env.CRE_WORKFLOW_ID;
  if (!workflowID) throw new Error('CRE_WORKFLOW_ID is not set');

  const gateway = process.env.CRE_GATEWAY_URL ?? PUBLIC_GATEWAY;

  const body = {
    id: randomUUID(),
    jsonrpc: '2.0',
    method: 'workflows.execute',
    params: {
      input: {
        proposalHash,
        // 6-decimal fixed point as a string, matching the seam's money
        // discipline. The enclave compares BigInt to BigInt.
        proposalValueUSDC: valueUSDC.toString(),
      },
      workflow: { workflowID },
    },
  };

  const jwt = await buildJwt(account, body);

  const res = await fetch(gateway, {
    method: 'POST',
    headers: {
      'content-type': 'application/json',
      authorization: `Bearer ${jwt}`,
    },
    // The body must be the same bytes the digest was computed over.
    body: JSON.stringify(canonicalize(body)),
    cache: 'no-store',
  });

  const text = await res.text();
  if (!res.ok) {
    throw new Error(`CRE gateway ${res.status}: ${text.slice(0, 300)}`);
  }

  let parsed: {
    result?: { output?: unknown; Output?: unknown };
    error?: { message?: string };
  };
  try {
    parsed = JSON.parse(text);
  } catch {
    throw new Error(`CRE gateway returned non-JSON: ${text.slice(0, 200)}`);
  }
  if (parsed.error) throw new Error(`CRE workflow error: ${parsed.error.message ?? 'unknown'}`);

  // The workflow returns its JSON payload as a string; the envelope's casing has
  // varied between CLI versions, so both spellings are accepted rather than
  // guessing one and failing closed on a working call.
  const raw = parsed.result?.output ?? parsed.result?.Output;
  const answer = typeof raw === 'string' ? (JSON.parse(raw) as StepUpAnswer) : (raw as StepUpAnswer);

  if (!answer || typeof answer.requiresStepUp !== 'boolean') {
    // `workflows.execute` is ASYNCHRONOUS. A successful call returns
    // { status: "ACCEPTED", workflow_execution_id } and the result has to be
    // polled for separately — it is not in this response.
    //
    // That is a real obstacle for this use, not a detail: the enforcer needs the
    // answer before it will sign, so an accepted-then-poll shape adds latency to
    // every proposal and a timeout path that has to fail closed anyway.
    // Reported precisely rather than as "no verdict", which reads like the
    // workflow misbehaved when in fact the call succeeded.
    const status =
      (parsed as { result?: { status?: string; workflow_execution_id?: string } }).result?.status ??
      'unknown';
    const execution =
      (parsed as { result?: { workflow_execution_id?: string } }).result?.workflow_execution_id ?? '';
    throw new Error(
      `CRE returned ${status} without a verdict — workflows.execute is asynchronous` +
        (execution ? ` (execution ${execution.slice(0, 18)}…)` : '') +
        '. Inspect it with: cre execution status <id> --target staging-settings',
    );
  }

  // A reply about a different proposal is not an answer to this question.
  if (answer.proposalHash && answer.proposalHash.toLowerCase() !== proposalHash.toLowerCase()) {
    throw new Error(
      `CRE answered for ${answer.proposalHash}, asked about ${proposalHash} — refusing to use it`,
    );
  }

  return answer;
}

/** Whether the confidential path is configured at all. */
export function creConfigured(): boolean {
  return Boolean(process.env.CRE_WORKFLOW_ID);
}
