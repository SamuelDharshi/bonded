import { createHash } from 'crypto';
import type { Policy } from '@bonded/seam';

/**
 * Canonical JSON — sorted keys recursively, no floats, deterministic.
 * Same policy always produces the same bytes.
 */
export function canonicalJson(obj: unknown): string {
  if (obj === null) return 'null';
  if (typeof obj === 'boolean') return String(obj);
  if (typeof obj === 'number') {
    if (!Number.isInteger(obj)) {
      throw new Error(`canonicalJson: float detected (${obj}). All values must be string-encoded.`);
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
  if (typeof obj === 'object' && obj !== null) {
    const keys   = Object.keys(obj as Record<string, unknown>).sort();
    const fields = keys.map(
      (k) => `${JSON.stringify(k)}:${canonicalJson((obj as Record<string, unknown>)[k])}`,
    );
    return '{' + fields.join(',') + '}';
  }
  throw new Error(`canonicalJson: unsupported type ${typeof obj}`);
}

/**
 * Hash a policy using SHA-256 of its canonical JSON.
 *
 * ⚠️  NOTE: The on-chain BondedRegistry stores keccak256. For the hackathon
 * JS/TS path we use SHA-256 (available natively in Node without ethers).
 * Before committing to BondedRegistry, use:
 *   ethers.keccak256(ethers.toUtf8Bytes(canonicalJson(policy)))
 * This function matches the console client-side hash-match indicator.
 */
export function hashPolicy(policy: Policy): `0x${string}` {
  const json = canonicalJson(policy as unknown);
  const hash = createHash('sha256').update(json, 'utf8').digest('hex');
  return `0x${hash}`;
}

/**
 * Verify a downloaded policy artifact matches an expected hash.
 * Used by the console before rendering — mismatch = refuse to render.
 */
export function verifyPolicyHash(policy: Policy, expectedHash: `0x${string}`): boolean {
  return hashPolicy(policy) === expectedHash;
}
