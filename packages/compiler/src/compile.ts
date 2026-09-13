import type { Policy, PolicyPremise, PremiseOp } from '@bonded/seam';

export interface PolicyIntent {
  /** Total USDC budget as whole number string, e.g. '500' */
  budgetUSDC: string;
  /** Budget period, e.g. '7d' */
  budgetPeriod: string;
  premises: IntentPremise[];
  forbiddenActions: string[];
  /** USDC threshold above which step-up is required, e.g. '100' */
  irreversibleAboveUSDC: string;
}

export interface IntentPremise {
  id: string;
  schema: string;
  field: string;
  op: PremiseOp;
  /** Human-readable value — converted to canonical form during compilation */
  value: string;
  toleranceBps?: number;
}

/**
 * Convert a USDC amount to a 6-decimal fixed-point string.
 * '500' → '500000000', '2.5' → '2500000', '0.25' → '250000'
 *
 * Never uses parseFloat. String arithmetic throughout, then BigInt.
 *
 * This previously kept only the part before the decimal point, so '2.5'
 * compiled to 2000000 — half a USDC silently gone from a spending limit, with
 * no error. Thresholds below one USDC compiled to zero, which would have made
 * every payment need confirmation while reading as if none did. Fractional
 * input is now exact, and anything finer than 6dp is rejected rather than
 * rounded, because a value the caller wrote but the artifact cannot express is
 * a mismatch they need to know about.
 */
function usdcToMicro(amount: string): string {
  const trimmed = amount.trim();
  if (!/^\d+(\.\d+)?$/.test(trimmed)) {
    throw new Error(`usdcToMicro: not a decimal USDC amount: ${amount}`);
  }

  const [whole = '0', frac = ''] = trimmed.split('.');
  if (frac.length > 6) {
    throw new Error(
      `usdcToMicro: ${amount} has more precision than USDC's 6 decimals`,
    );
  }

  return (BigInt(whole) * 1_000_000n + BigInt((frac + '000000').slice(0, 6))).toString();
}

/**
 * Convert a USD dollar amount to 18-decimal scaled integer string.
 * '50000000' (50M USD) → '50000000000000000000000000'
 */
function usdToScale18(dollarString: string): string {
  const parts  = dollarString.split('.');
  const whole  = BigInt(parts[0] ?? '0');
  return (whole * (10n ** 18n)).toString();
}

/**
 * Compile a plain-English policy intent into a canonical Policy artifact.
 *
 * Rules:
 * - All keys sorted (via canonicalJson in hash.ts)
 * - No floats — all amounts as string-encoded integers
 * - Deterministic: same intent → same artifact
 * - Version always starts at 1
 */
export function compilePolicy(intent: PolicyIntent): Policy {
  const premises: PolicyPremise[] = intent.premises.map((p) => {
    // For USD fields, the value should already be in 18-decimal form.
    // If it looks like a plain dollar amount (< 1e15), scale it.
    const isUSD = p.field.toLowerCase().includes('usd');
    const value = isUSD && !p.value.includes('e') && BigInt(p.value) < 10n ** 15n
      ? usdToScale18(p.value)
      : p.value;

    const premise: PolicyPremise = {
      id:     p.id,
      schema: p.schema,
      field:  p.field,
      op:     p.op,
      value,
    };
    if (p.toleranceBps !== undefined) {
      premise.tolerance_bps = p.toleranceBps;
    }
    return premise;
  });

  const policy: Policy = {
    version:          1,
    budget: {
      asset:  'USDC',
      period: intent.budgetPeriod,
      max:    usdcToMicro(intent.budgetUSDC),
    },
    premises,
    forbid:            [...intent.forbiddenActions].sort(),
    irreversible_above: usdcToMicro(intent.irreversibleAboveUSDC),
  };

  return policy;
}
