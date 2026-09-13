import { clients } from './chain.js';
import { POLICY } from './policy.js';

/**
 * Publish the policy artifact behind an on-chain commitment.
 *
 * The registry stores a hash. The enforcer needs the artifact itself, so it has
 * to be published somewhere readable — and because the service accepts an
 * artifact only if it hashes to what the owner already committed, publishing
 * needs no credential and the store needs no trust. Get the hash wrong and it
 * is refused; commit a new policy and the old artifact goes stale on the next
 * read.
 *
 * Run commit-policy first. Usage:
 *   pnpm --filter @bonded/settlement publish-policy
 *
 * BONDED_API_URL overrides the default http://localhost:3000.
 */

const API = process.env.BONDED_API_URL ?? 'http://localhost:3000';

async function main(): Promise<void> {
  const { account } = clients();

  console.log('\n═══ BONDED — publish the policy artifact ═══\n');
  console.log(`  api     ${API}`);
  console.log(`  owner   ${account.address}`);

  const res = await fetch(`${API}/api/v1/policies`, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ owner: account.address, policy: POLICY }),
  });

  const text = await res.text();
  if (!res.ok) {
    console.error(`\n  ✗ ${res.status}\n`);
    console.error(text, '\n');
    process.exit(1);
  }

  const body = JSON.parse(text) as { policyHash: string; detail: string };
  console.log(`\n  ✓ published`);
  console.log(`    policyHash ${body.policyHash}`);
  console.log(`    ${body.detail}\n`);

  // Read it back the way the enforcer will, so a success here means the
  // enforcer can actually use it rather than just that a file was written.
  const check = await fetch(`${API}/api/v1/policies/${account.address}`);
  const readBack = (await check.json()) as { status: string; onchainHash?: string };
  console.log(`  read back: ${readBack.status} (on-chain ${readBack.onchainHash ?? 'n/a'})\n`);
  if (readBack.status !== 'ok') process.exit(1);
}

main().catch((err) => {
  console.error('\n  ✗', err instanceof Error ? err.message : err, '\n');
  process.exit(1);
});
