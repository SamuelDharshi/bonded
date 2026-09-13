import { NextResponse } from 'next/server';
import { VAULT_ABI } from '@bonded/seam';
import { VAULT, ZERO_ADDRESS, publicClient } from '../../../../../lib/bonded/chain';

export const dynamic = 'force-dynamic';

/**
 * GET /api/v1/verdicts/:proposalHash
 *
 * Where a proposal stands, read from the chain rather than from any record this
 * service keeps. An agent polls this to find out whether its settlement landed,
 * and whether a hold has been confirmed yet.
 *
 * Deliberately sourced only from vault state. A service-side cache of "what we
 * think happened" would be the thing to distrust; the vault is the only party
 * whose answer decides whether money moved.
 */
export async function GET(
  _req: Request,
  { params }: { params: Promise<{ hash: string }> },
): Promise<NextResponse> {
  const { hash } = await params;

  if (!/^0x[0-9a-fA-F]{64}$/.test(hash)) {
    return NextResponse.json({ error: 'proposalHash must be 32 bytes of hex' }, { status: 400 });
  }

  const proposalHash = hash as `0x${string}`;
  const client = publicClient();

  let settled: boolean;
  let armed: boolean;
  let confirmed: boolean;
  let stepUpOwner: `0x${string}`;

  try {
    [settled, armed, confirmed, stepUpOwner] = await Promise.all([
      client.readContract({ address: VAULT, abi: VAULT_ABI, functionName: 'settled', args: [proposalHash] }),
      client.readContract({ address: VAULT, abi: VAULT_ABI, functionName: 'stepUpArmed', args: [proposalHash] }),
      client.readContract({ address: VAULT, abi: VAULT_ABI, functionName: 'stepUpConfirmed', args: [proposalHash] }),
      client.readContract({ address: VAULT, abi: VAULT_ABI, functionName: 'stepUpOwner', args: [proposalHash] }),
    ]);
  } catch (err) {
    return NextResponse.json(
      { error: 'could not reach the vault', detail: err instanceof Error ? err.message : undefined },
      { status: 502 },
    );
  }

  const state = settled
    ? 'settled'
    : confirmed
      ? 'confirmed-awaiting-settlement'
      : armed
        ? 'held-awaiting-confirmation'
        : 'unknown';

  return NextResponse.json({
    proposalHash,
    vault: VAULT,
    state,
    settled,
    stepUp: {
      armed,
      confirmed,
      mustBeConfirmedBy: stepUpOwner === ZERO_ADDRESS ? null : stepUpOwner,
    },
    detail:
      state === 'settled'
        ? 'A verdict for this proposal has been settled. The vault will not accept it again.'
        : state === 'confirmed-awaiting-settlement'
          ? 'The owner has confirmed. Resubmit the proposal to receive a CLEARED verdict, then settle it.'
          : state === 'held-awaiting-confirmation'
            ? `Held. ${stepUpOwner} must call confirmStepUp(proposalHash) from their own wallet.`
            : 'The vault has no record of this proposal — it has not been submitted, or its settlement has not landed yet.',
  });
}
