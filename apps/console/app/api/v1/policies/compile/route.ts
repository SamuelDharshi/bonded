import { NextResponse } from 'next/server';
import { compilePolicy, type PolicyIntent } from '@bonded/compiler';
import { hashPolicy } from '@bonded/enforcer';

export const dynamic = 'force-dynamic';

/**
 * POST /api/v1/policies/compile
 *
 * Turn a policy intent into the canonical artifact and its hash, so the browser
 * can show the owner exactly what they are about to commit.
 *
 * Server-side because hashPolicy uses Node's crypto, but also because it should
 * be: the artifact the enforcer will read has to be produced by the same code
 * that reads it. A second implementation in the browser would be a second
 * definition of what a policy means, and the first time the two disagreed the
 * commitment would be for something nobody had seen.
 *
 * Computes and returns. It commits nothing, stores nothing, and needs no
 * authentication — committing is a transaction the owner sends from their own
 * wallet, and publishing is a separate call that checks the hash against what
 * the chain says.
 */

const FORBIDDABLE = ['approve_unlimited', 'delegatecall', 'selfdestruct'] as const;

interface CompileRequest {
  budgetUSDC?: string;
  budgetPeriod?: string;
  irreversibleAboveUSDC?: string;
  /** Minimum pool TVL in whole USD. */
  minTvlUSD?: string;
  /** Minimum pool age in days. */
  minPoolAgeDays?: string;
  toleranceBps?: number;
  forbiddenActions?: string[];
}

function bad(error: string, detail?: string): NextResponse {
  return NextResponse.json(detail ? { error, detail } : { error }, { status: 400 });
}

const DECIMAL = /^\d+(\.\d+)?$/;
const WHOLE = /^\d+$/;

export async function POST(req: Request): Promise<NextResponse> {
  let body: CompileRequest;
  try {
    body = (await req.json()) as CompileRequest;
  } catch {
    return bad('body must be JSON');
  }

  const {
    budgetUSDC = '500',
    budgetPeriod = '7d',
    irreversibleAboveUSDC = '1',
    minTvlUSD = '50000000',
    minPoolAgeDays = '30',
    toleranceBps = 200,
    forbiddenActions = [...FORBIDDABLE],
  } = body;

  // Validate before compiling so the caller gets the field name, not a stack.
  // Precision is checked here as well as in the compiler so the message names
  // the field the caller typed into. "could not compile" is accurate and useless
  // when it is one of two amount inputs on a form.
  const amountProblem = (label: string, value: string): string | null => {
    if (!DECIMAL.test(value)) return `${label} must be a decimal amount, e.g. "500" or "0.5"`;
    const frac = value.split('.')[1] ?? '';
    if (frac.length > 6) return `${label} has more precision than USDC's 6 decimal places`;
    return null;
  };

  const budgetProblem = amountProblem('budgetUSDC', budgetUSDC);
  if (budgetProblem) return bad(budgetProblem);

  const thresholdProblem = amountProblem('irreversibleAboveUSDC', irreversibleAboveUSDC);
  if (thresholdProblem) return bad(thresholdProblem);
  if (!WHOLE.test(minTvlUSD)) return bad('minTvlUSD must be a whole number of USD');
  if (!WHOLE.test(minPoolAgeDays)) return bad('minPoolAgeDays must be a whole number of days');
  if (!/^\d+d$/.test(budgetPeriod)) return bad('budgetPeriod must look like "7d"');
  if (!Number.isInteger(toleranceBps) || toleranceBps < 0 || toleranceBps > 10_000) {
    return bad('toleranceBps must be an integer between 0 and 10000');
  }

  const unknown = forbiddenActions.filter(
    (a) => !FORBIDDABLE.includes(a as (typeof FORBIDDABLE)[number]),
  );
  if (unknown.length > 0) {
    return bad(
      `unknown forbidden action(s): ${unknown.join(', ')}`,
      `Supported: ${FORBIDDABLE.join(', ')}. An action the enforcer does not recognise would ` +
        'sit in the artifact doing nothing, which is worse than being rejected.',
    );
  }

  if (BigInt(minPoolAgeDays) === 0n) {
    return bad(
      'minPoolAgeDays must be at least 1',
      'A zero age requirement accepts a pool created in the same block as the proposal, which is ' +
        'the shape most rug pulls take.',
    );
  }

  const intent: PolicyIntent = {
    budgetUSDC,
    budgetPeriod,
    premises: [
      {
        id: 'tvl',
        schema: 'messari-dex-amm',
        field: 'liquidityPool.totalValueLockedUSD',
        op: 'gte',
        value: minTvlUSD,
        toleranceBps,
      },
      {
        id: 'pool_age',
        schema: 'messari-dex-amm',
        field: 'liquidityPool.createdTimestamp',
        op: 'older_than',
        // Days to seconds, as an integer string. No floats on this path.
        value: (BigInt(minPoolAgeDays) * 86_400n).toString(),
      },
    ],
    forbiddenActions,
    irreversibleAboveUSDC,
  };

  let policy;
  try {
    policy = compilePolicy(intent);
  } catch (err) {
    return bad('could not compile', err instanceof Error ? err.message : undefined);
  }

  const policyHash = hashPolicy(policy);

  // A threshold above the budget ceiling is self-defeating: the budget stops
  // every payment before the confirmation gate can apply, so the gate never
  // fires and the owner believes they have one. Worth saying out loud rather
  // than refusing — it is their policy.
  const warnings: string[] = [];
  if (BigInt(policy.irreversible_above) > BigInt(policy.budget.max)) {
    warnings.push(
      'The confirmation threshold is above the budget ceiling, so the budget will refuse ' +
        'payments before the confirmation gate is ever reached.',
    );
  }
  if (BigInt(policy.irreversible_above) === 0n) {
    warnings.push(
      'A threshold of 0 means every payment, however small, waits for you to confirm by hand.',
    );
  }

  return NextResponse.json({
    policy,
    policyHash,
    warnings,
    next: [
      'Commit this hash to BondedRegistry.commitPolicy(policyHash) from your own wallet.',
      'Then publish the artifact to /api/v1/policies so the enforcer can read the rules behind it.',
    ],
  });
}
