import { NextResponse } from 'next/server';
import { loadPolicy } from '../../../../../lib/bonded/policyStore';

export const dynamic = 'force-dynamic';

/**
 * GET /api/v1/policies/:owner
 *
 * What policy this service would enforce for an owner, and whether it still
 * agrees with the chain.
 *
 * The comparison is re-run on every read, not cached from publish time, because
 * the owner may have committed a new policy since. A stale artifact is reported
 * as stale and refused for enforcement rather than quietly used — silently
 * enforcing a superseded policy is the worst available failure, since it looks
 * like it is working.
 */
export async function GET(
  _req: Request,
  { params }: { params: Promise<{ owner: string }> },
): Promise<NextResponse> {
  const { owner } = await params;

  if (!/^0x[0-9a-fA-F]{40}$/.test(owner)) {
    return NextResponse.json({ error: 'owner must be a 20-byte hex address' }, { status: 400 });
  }

  let lookup: Awaited<ReturnType<typeof loadPolicy>>;
  try {
    lookup = await loadPolicy(owner);
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : 'could not reach the registry' },
      { status: 502 },
    );
  }

  switch (lookup.status) {
    case 'ok':
      return NextResponse.json({
        status: 'ok',
        owner: owner.toLowerCase(),
        policyHash: lookup.stored.policyHash,
        onchainHash: lookup.onchainHash,
        publishedAt: lookup.stored.publishedAt,
        policy: lookup.stored.policy,
      });

    case 'not-committed':
      return NextResponse.json(
        {
          status: 'not-committed',
          owner: owner.toLowerCase(),
          detail: 'This address has never committed a policy hash to BondedRegistry.',
        },
        { status: 404 },
      );

    case 'not-published':
      return NextResponse.json(
        {
          status: 'not-published',
          owner: owner.toLowerCase(),
          onchainHash: lookup.onchainHash,
          detail:
            'A policy is committed on-chain but its artifact has not been published here, ' +
            'so the enforcer cannot read the rules. POST it to /api/v1/policies.',
        },
        { status: 409 },
      );

    case 'stale':
      return NextResponse.json(
        {
          status: 'stale',
          owner: owner.toLowerCase(),
          storedHash: lookup.stored.policyHash,
          onchainHash: lookup.onchainHash,
          detail:
            'The published artifact no longer matches the on-chain commitment — the policy ' +
            'was changed. Publish the current artifact; nothing will be enforced until then.',
        },
        { status: 409 },
      );
  }
}
