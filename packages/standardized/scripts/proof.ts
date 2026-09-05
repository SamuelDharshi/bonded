/**
 * COMPOSABLE TRACK PROOF SCRIPT
 *
 * Runs the SAME query function against multiple Messari DEX-AMM
 * standardized subgraph deployment IDs. Zero protocol-specific code
 * changes between protocols.
 *
 * Output: console table + writes proof.json
 *
 * This script IS the Composable-track argument.
 * Screenshot the output for the README.
 *
 * Run: pnpm --filter @bonded/standardized proof
 */

import { writeFileSync } from 'fs';
import { fileURLToPath } from 'node:url';
import { executeQuery, parseUSDToScale18, type GatewayConfig } from '../src/gateway.js';
import { buildQuery, parseResponse, KNOWN_DEPLOYMENTS } from '../src/schemas/messari-dex-amm.js';

const GATEWAY_BASE_URL = process.env['GRAPH_GATEWAY_URL'] ?? 'https://gateway.thegraph.com/api';
const API_KEY          = process.env['GRAPH_API_KEY'];

if (!API_KEY) {
  console.error('ERROR: GRAPH_API_KEY not set. This must be decrypted from CRE at process start.');
  process.exit(1);
}

/**
 * Well-known pool IDs for each protocol (Ethereum mainnet).
 * Verify these are current before running.
 */
const POOL_IDS: Record<keyof typeof KNOWN_DEPLOYMENTS, string> = {
  'uniswap-v3-ethereum':  '0x88e6a0c2ddd26feeb64f039a2c41296fcb3f5640', // USDC/ETH 0.05%
  'curve-ethereum':       '0xbebc44055f52ea3fe848b70e396fa9e9a4d58aee', // 3pool
  'balancer-v2-ethereum': '0x96646936b91d6b9d7d0c47c496afbf3d6ec7b6f8', // USDC/WETH
};

interface ProofResult {
  protocol: string;
  subgraphId: string;
  poolId: string;
  field: 'liquidityPool.totalValueLockedUSD';
  rawValue: string | null;
  scaledValue: string | null;
  success: boolean;
  error?: string;
}

async function runProof(): Promise<void> {
  console.log('\n=== BONDED COMPOSABLE TRACK PROOF ===');
  console.log('One query function. Multiple protocols. Zero code changes.\n');

  const results: ProofResult[] = [];
  const field = 'liquidityPool.totalValueLockedUSD' as const;
  const query = buildQuery(field);

  for (const [protocol, subgraphId] of Object.entries(KNOWN_DEPLOYMENTS)) {
    const poolId = POOL_IDS[protocol as keyof typeof KNOWN_DEPLOYMENTS];
    const config: GatewayConfig = {
      gatewayBaseUrl: GATEWAY_BASE_URL,
      apiKey: API_KEY!,
      subgraphId,
    };

    let rawValue: string | null = null;
    let scaledValue: string | null = null;
    let success = false;
    let error: string | undefined;

    try {
      const data  = await executeQuery<unknown>(config, query, { id: poolId });
      rawValue    = parseResponse(field, data);
      scaledValue = rawValue ? parseUSDToScale18(rawValue) : null;
      success     = rawValue !== null;
    } catch (err) {
      error = err instanceof Error ? err.message : String(err);
    }

    const result: ProofResult = { protocol, subgraphId, poolId, field, rawValue, scaledValue, success, error };
    results.push(result);

    console.log(`Protocol: ${protocol}`);
    console.log(`  Subgraph: ${subgraphId}`);
    console.log(`  Pool:     ${poolId}`);
    console.log(`  TVL:      ${rawValue ?? 'NULL'} USD`);
    console.log(`  Scaled:   ${scaledValue ?? 'NULL'} (18-decimal)`);
    console.log(`  Status:   ${success ? '✓ OK' : `✗ FAILED: ${error}`}`);
    console.log();
  }

  const successCount = results.filter((r) => r.success).length;
  console.log(`Result: ${successCount}/${results.length} protocols resolved`);
  console.log('Zero protocol-specific code changed between queries.');
  console.log(`Line count: 1 buildQuery() call serves ${results.length} protocols.\n`);

  const proof = {
    generatedAt:   new Date().toISOString(),
    queryFunction: 'buildQuery("liquidityPool.totalValueLockedUSD")',
    note:          'Same function, same zero code changes, multiple protocols',
    summary: {
      total:         results.length,
      succeeded:     successCount,
      failed:        results.length - successCount,
    },
    results,
  };

  writeFileSync(
    fileURLToPath(new URL('../proof.json', import.meta.url)),
    JSON.stringify(proof, null, 2),
    'utf8',
  );
  console.log('Written: proof.json');
}

runProof().catch((err) => {
  console.error('Proof script failed:', err);
  process.exit(1);
});
