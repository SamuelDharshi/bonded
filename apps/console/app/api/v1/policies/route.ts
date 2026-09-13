import { NextResponse } from 'next/server';
import type { Policy } from '@bonded/seam';
import { publishPolicy } from '../../../../lib/bonded/policyStore';

export const dynamic = 'force-dynamic';

/**
 * POST /api/v1/policies
 *
 * Publish the policy artifact behind an on-chain commitment, so the enforcer
 * can read the policy it is asked to enforce.
 *
 * Body: { "owner": "0x…", "policy": { …artifact… } }
 *
 * Unauthenticated on purpose. The artifact is accepted only if it hashes to
 * exactly what `owner` already committed to BondedRegistry, which makes the
 * right artifact self-proving and the wrong one unusable no matter who sends
 * it. See lib/bonded/policyStore.ts.
 *
 * Commit first, publish second. A commitment with no published artifact leaves
 * the enforcer unable to evaluate anything for that owner, which it reports
 * plainly rather than falling back to a default policy — a default policy is
 * someone else's rules applied to your money.
 */
export async function POST(req: Request): Promise<NextResponse> {
  let body: { owner?: string; policy?: Policy };
  try {
    body = (await req.json()) as typeof body;
  } catch {
    return NextResponse.json({ error: 'body must be JSON' }, { status: 400 });
  }

  const { owner, policy } = body;

  if (!owner || !/^0x[0-9a-fA-F]{40}$/.test(owner)) {
    return NextResponse.json({ error: 'owner must be a 20-byte hex address' }, { status: 400 });
  }
  if (!policy || typeof policy !== 'object') {
    return NextResponse.json({ error: 'policy must be the artifact object' }, { status: 400 });
  }

  for (const field of ['version', 'budget', 'premises', 'forbid', 'irreversible_above'] as const) {
    if (!(field in policy)) {
      return NextResponse.json({ error: `policy is missing '${field}'` }, { status: 400 });
    }
  }

  let result: Awaited<ReturnType<typeof publishPolicy>>;
  try {
    result = await publishPolicy(owner, policy);
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : 'could not reach the registry' },
      { status: 502 },
    );
  }

  if (result.status === 'not-committed') {
    return NextResponse.json(
      {
        error: 'no policy committed on-chain for this owner',
        detail:
          'Call BondedRegistry.commitPolicy(policyHash) from the owner address first. ' +
          'Publishing an artifact that nothing on-chain vouches for would let this ' +
          'service choose your rules.',
      },
      { status: 409 },
    );
  }

  if (result.status === 'hash-mismatch') {
    return NextResponse.json(
      {
        error: 'artifact does not match the on-chain commitment',
        computedHash: result.computed,
        onchainHash: result.onchain,
        detail:
          'The artifact was not stored. Either it is not the one you committed, or the ' +
          'commitment is out of date — recommit the hash of this exact artifact.',
      },
      { status: 409 },
    );
  }

  return NextResponse.json({
    status: 'published',
    owner: owner.toLowerCase(),
    policyHash: result.policyHash,
    detail: 'Artifact matches the on-chain commitment and will be used for this owner.',
  });
}
