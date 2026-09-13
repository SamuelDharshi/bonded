import { mkdirSync, readFileSync, writeFileSync, existsSync } from 'node:fs';
import path from 'node:path';
import { hashPolicy } from '@bonded/enforcer';
import type { Policy } from '@bonded/seam';
import { REGISTRY, REGISTRY_ABI, publicClient } from './chain';

/**
 * Where an owner's policy artifact lives so the enforcer can read it.
 *
 * The registry commits a HASH, not the artifact. The enforcer needs the whole
 * thing — premises, thresholds, forbidden actions — so something has to hold
 * it. That something does not need to be trusted, because this store is
 * content-addressed against the chain: an artifact is only ever accepted, or
 * served, if it hashes to exactly what that owner committed on-chain. A
 * tampered artifact fails the hash check and is refused; a stale one fails the
 * moment the owner commits a new version.
 *
 * So publishing needs no authentication. Anyone may hand us an artifact; if it
 * matches the owner's commitment it is by definition the right artifact, and if
 * it does not, it is rejected regardless of who sent it. Asking for a signature
 * here would imply the store is trusted, which is the opposite of the design.
 *
 * Files on disk is the honest limitation: it does not survive a redeploy on
 * ephemeral hosting and does not scale past one node. The integrity property
 * does not come from the storage, so swapping this for Postgres, S3 or IPFS
 * changes durability and nothing else. The verification below stays identical.
 */

const DATA_DIR = process.env.BONDED_DATA_DIR ?? path.join(process.cwd(), '.data', 'policies');

export interface StoredPolicy {
  owner: string;
  policy: Policy;
  policyHash: `0x${string}`;
  publishedAt: string;
}

/** Verdict of comparing a stored artifact against the chain. */
export type PolicyLookup =
  | { status: 'ok'; stored: StoredPolicy; onchainHash: `0x${string}` }
  | { status: 'not-committed'; onchainHash: `0x${string}` }
  | { status: 'not-published'; onchainHash: `0x${string}` }
  | { status: 'stale'; stored: StoredPolicy; onchainHash: `0x${string}` };

const ZERO_HASH = `0x${'0'.repeat(64)}` as const;

function fileFor(owner: string): string {
  // Lowercased so a checksummed and an unchecksummed address are one owner.
  return path.join(DATA_DIR, `${owner.toLowerCase()}.json`);
}

export async function onchainPolicyHash(owner: string): Promise<`0x${string}`> {
  return publicClient().readContract({
    address: REGISTRY,
    abi: REGISTRY_ABI,
    functionName: 'currentPolicyHash',
    args: [owner as `0x${string}`],
  });
}

/**
 * Store an artifact for an owner, but only if it matches their commitment.
 *
 * Returns what happened rather than throwing, because every outcome here is a
 * normal API response: nothing committed yet, or a hash that does not match.
 */
export async function publishPolicy(
  owner: string,
  policy: Policy,
): Promise<
  | { status: 'published'; policyHash: `0x${string}` }
  | { status: 'not-committed' }
  | { status: 'hash-mismatch'; computed: `0x${string}`; onchain: `0x${string}` }
> {
  const onchain = await onchainPolicyHash(owner);
  if (onchain === ZERO_HASH) return { status: 'not-committed' };

  const computed = hashPolicy(policy);
  if (computed !== onchain) return { status: 'hash-mismatch', computed, onchain };

  const record: StoredPolicy = {
    owner: owner.toLowerCase(),
    policy,
    policyHash: computed,
    publishedAt: new Date().toISOString(),
  };

  mkdirSync(DATA_DIR, { recursive: true });
  writeFileSync(fileFor(owner), JSON.stringify(record, null, 2), 'utf8');

  return { status: 'published', policyHash: computed };
}

/**
 * Load an owner's artifact and re-verify it against the chain on every read.
 *
 * Verifying at read time and not only at write time is the point: the owner may
 * have committed a new policy since, in which case the stored one is stale and
 * must not be enforced. Silently enforcing a superseded policy would be the
 * worst failure this system could have — it would look like it was working.
 */
export async function loadPolicy(owner: string): Promise<PolicyLookup> {
  const onchainHash = await onchainPolicyHash(owner);
  if (onchainHash === ZERO_HASH) return { status: 'not-committed', onchainHash };

  const file = fileFor(owner);
  if (!existsSync(file)) return { status: 'not-published', onchainHash };

  const stored = JSON.parse(readFileSync(file, 'utf8')) as StoredPolicy;

  // Re-hash the artifact rather than trusting the hash recorded beside it.
  const recomputed = hashPolicy(stored.policy);
  if (recomputed !== onchainHash) {
    return { status: 'stale', stored: { ...stored, policyHash: recomputed }, onchainHash };
  }

  return { status: 'ok', stored: { ...stored, policyHash: recomputed }, onchainHash };
}
