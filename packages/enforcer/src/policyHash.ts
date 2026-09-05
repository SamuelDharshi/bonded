import { createHash } from 'crypto';
import type { Policy } from '@bonded/seam';

/**
 * Canonical JSON serialization — sorted keys, no floats, deterministic output.
 * Same intent always produces same JSON. Used for policy hashing on both sides.
 */
export function canonicalJson(obj: unknown): string {
  if (obj === null) return 'null';
  if (typeof obj === 'boolean') return obj ? 'true' : 'false';
  if (typeof obj === 'number') {
    // No floats allowed in policy artifacts. Error loudly.
    if (!Number.isInteger(obj)) {
      throw new Error(`canonicalJson: float detected: ${obj}. Use string-encoded values.`);
    }
    return String(obj);
  }
  if (typeof obj === 'string') return JSON.stringify(obj);
  if (typeof obj === 'bigint') {
    throw new Error(`canonicalJson: BigInt not serializable. Convert to string first.`);
  }
  if (Array.isArray(obj)) {
    return '[' + obj.map(canonicalJson).join(',') + ']';
  }
  if (typeof obj === 'object') {
    const sorted = Object.keys(obj as Record<string, unknown>)
      .sort()
      .map((k) => `${JSON.stringify(k)}:${canonicalJson((obj as Record<string, unknown>)[k])}`)
      .join(',');
    return '{' + sorted + '}';
  }
  throw new Error(`canonicalJson: unsupported type: ${typeof obj}`);
}

/**
 * Hash a policy artifact using SHA-256.
 *
 * NOTE: Production uses keccak256 (as on the contract). For the hackathon
 * JS side we use SHA-256 via Node crypto. The contract uses keccak256 —
 * deploy-time you must use ethers.keccak256(toUtf8Bytes(canonicalJson(policy)))
 * and commit THAT hash to BondedRegistry. This function is for local verification
 * and the policy page hash-match indicator.
 *
 * TODO: Replace with ethers.keccak256 before mainnet.
 */
export function hashPolicy(policy: Policy): `0x${string}` {
  const canonical = canonicalJson(policy as unknown);
  const hash = createHash('sha256').update(canonical, 'utf8').digest('hex');
  return `0x${hash}`;
}

/**
 * Verify a downloaded policy artifact matches its expected hash.
 * Used by the console client-side before rendering policy.
 * Mismatch = refuse to render.
 */
export function verifyPolicyHash(policy: Policy, expectedHash: `0x${string}`): boolean {
  return hashPolicy(policy) === expectedHash;
}
